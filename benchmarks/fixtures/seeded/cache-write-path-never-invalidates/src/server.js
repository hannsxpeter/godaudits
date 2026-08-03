'use strict';

const http = require('node:http');
const { randomUUID, createHmac, timingSafeEqual } = require('node:crypto');
const log = require('./logger');
const clients = require('./clients');
const catalog = require('./catalog');

const PORT = Number(process.env.PORT) || 8080;
const REQUIRED_ENV = ['REDIS_URL', 'DATABASE_URL', 'MERCHANDISING_WEBHOOK_SECRET'];

// A change body is a few hundred bytes. Anything past this is refused while it
// streams, so no caller can grow the process with one request.
const MAX_BODY_BYTES = 65536;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,31}$/;
const READ_ROUTE = /^\/(products|inventory)\/([^/]+)$/;

// Change ids already applied, so a redelivery is applied once. Bounded, with
// the oldest id dropped when the ceiling is reached.
const MAX_APPLIED_IDS = 10000;
const appliedChangeIds = new Map();

function rememberChange(changeId) {
  if (!appliedChangeIds.has(changeId) && appliedChangeIds.size >= MAX_APPLIED_IDS) {
    const oldest = appliedChangeIds.keys().next();
    if (!oldest.done) {
      appliedChangeIds.delete(oldest.value);
    }
  }
  appliedChangeIds.set(changeId, Date.now());
}

function send(res, status, body, traceId) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Request-Id': traceId
  });
  res.end(payload);
}

function run(work, res, traceId) {
  work.catch((err) => {
    log.error('request_failed', { trace_id: traceId, reason: err.message });
    if (!res.headersSent) {
      send(res, 500, { error: 'internal error' }, traceId);
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let seen = 0;
    req.on('data', (chunk) => {
      seen += chunk.length;
      if (seen > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('change body over ' + MAX_BODY_BYTES + ' bytes'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// The one authenticated boundary in this service: merchandising signs the raw
// change body and nothing reaches a write path without a matching signature.
function signatureMatches(raw, header) {
  if (typeof header !== 'string' || header.length === 0) {
    return false;
  }
  const expected = createHmac('sha256', process.env.MERCHANDISING_WEBHOOK_SECRET)
    .update(raw)
    .digest();
  const offered = Buffer.from(header, 'hex');
  return offered.length === expected.length && timingSafeEqual(offered, expected);
}

function validChange(change) {
  if (change === null || typeof change !== 'object') {
    return false;
  }
  if (typeof change.changeId !== 'string' || change.changeId.length === 0) {
    return false;
  }
  if (typeof change.sku !== 'string' || !SKU_PATTERN.test(change.sku)) {
    return false;
  }
  if (change.type === 'price') {
    return Number.isInteger(change.priceCents) && change.priceCents >= 0;
  }
  if (change.type === 'inventory') {
    return Number.isInteger(change.onHand) && change.onHand >= 0;
  }
  return false;
}

async function handleRead(kind, sku, res, traceId) {
  if (!SKU_PATTERN.test(sku)) {
    send(res, 400, { error: 'malformed sku' }, traceId);
    return;
  }
  try {
    const row =
      kind === 'products'
        ? await catalog.getProduct(sku, traceId)
        : await catalog.getInventory(sku, traceId);
    if (row === null) {
      send(res, 404, { error: 'unknown sku' }, traceId);
      return;
    }
    send(res, 200, row, traceId);
  } catch (err) {
    if (err.name === 'OverloadedError') {
      log.warn('read_shed', { trace_id: traceId, sku: sku, reason: err.message });
      send(res, 503, { error: 'catalog busy' }, traceId);
      return;
    }
    log.error('read_failed', { trace_id: traceId, sku: sku, reason: err.message });
    send(res, 503, { error: 'catalog unavailable' }, traceId);
  }
}

async function handleChange(req, res, traceId) {
  let raw = null;
  try {
    raw = await readBody(req);
  } catch (err) {
    log.warn('change_body_refused', { trace_id: traceId, reason: err.message });
    send(res, 413, { error: 'change body too large' }, traceId);
    return;
  }

  if (!signatureMatches(raw, req.headers['x-merchandising-signature'])) {
    log.warn('change_signature_rejected', { trace_id: traceId });
    send(res, 401, { error: 'signature rejected' }, traceId);
    return;
  }

  let change = null;
  try {
    change = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    send(res, 400, { error: 'malformed change' }, traceId);
    return;
  }
  if (!validChange(change)) {
    send(res, 400, { error: 'malformed change' }, traceId);
    return;
  }

  if (appliedChangeIds.has(change.changeId)) {
    log.info('change_already_applied', { trace_id: traceId, change_id: change.changeId });
    send(res, 200, { applied: false, reason: 'already applied' }, traceId);
    return;
  }

  try {
    const row =
      change.type === 'price'
        ? await catalog.applyPriceChange(change.sku, change.priceCents, traceId)
        : await catalog.applyInventoryChange(change.sku, change.onHand, traceId);
    if (row === null) {
      send(res, 404, { error: 'unknown sku' }, traceId);
      return;
    }
    rememberChange(change.changeId);
    send(res, 200, { applied: true, changeId: change.changeId }, traceId);
  } catch (err) {
    log.error('change_apply_failed', {
      trace_id: traceId,
      change_id: change.changeId,
      sku: change.sku,
      reason: err.message
    });
    send(res, 503, { error: 'change not applied' }, traceId);
  }
}

// Both dependencies are touched on every call. Nothing here returns a cached
// verdict and nothing answers 200 without both answering first.
async function handleHealth(res, traceId) {
  const checks = { redis: false, postgres: false };
  try {
    await clients.redis.ping();
    checks.redis = true;
  } catch (err) {
    log.error('health_redis_failed', { trace_id: traceId, reason: err.message });
  }
  try {
    await clients.postgres.liveness();
    checks.postgres = true;
  } catch (err) {
    log.error('health_postgres_failed', { trace_id: traceId, reason: err.message });
  }
  const healthy = checks.redis && checks.postgres;
  send(
    res,
    healthy ? 200 : 503,
    { status: healthy ? 'ok' : 'degraded', checks: checks, resident_keys: clients.redis.residentKeys() },
    traceId
  );
}

const server = http.createServer((req, res) => {
  const headerId = req.headers['x-request-id'];
  const traceId =
    typeof headerId === 'string' && headerId.length > 0 && headerId.length <= 64
      ? headerId
      : randomUUID();
  const url = new URL(req.url, 'http://catalog-service');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    run(handleHealth(res, traceId), res, traceId);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/changes') {
    run(handleChange(req, res, traceId), res, traceId);
    return;
  }

  const match = req.method === 'GET' ? url.pathname.match(READ_ROUTE) : null;
  if (match !== null) {
    run(handleRead(match[1], match[2], res, traceId), res, traceId);
    return;
  }

  send(res, 404, { error: 'not found' }, traceId);
});

server.headersTimeout = 3000;
server.requestTimeout = 5000;
server.keepAliveTimeout = 5000;

function start() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    log.error('startup_refused', { missing_env: missing.join(',') });
    process.exitCode = 1;
    return;
  }
  server.listen(PORT, () => log.info('listening', { port: PORT }));
}

if (require.main === module) {
  start();
}

module.exports = { server, start };
