'use strict';

const http = require('http');
const crypto = require('crypto');

const db = require('./db');
const log = require('./logger');
const objectives = require('./recovery/objectives');

const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY_BYTES = 8192;
const ORDER_ID = /^[A-Za-z0-9-]{1,64}$/;

function reply(res, ctx, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    'x-trace-id': ctx.traceId
  });
  res.end(payload);
  log.info('request_completed', {
    trace_id: ctx.traceId,
    method: ctx.method,
    path: ctx.path,
    status: status,
    duration_ms: Date.now() - ctx.startedAt
  });
}

// Per-request buffer with an explicit ceiling; a body past the ceiling is
// refused rather than accumulated.
function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;

    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('body over ' + MAX_BODY_BYTES + ' bytes'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function parseOrder(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  if (body === null || typeof body !== 'object') {
    return null;
  }
  if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)) {
    return null;
  }
  if (!Number.isInteger(body.totalCents) || body.totalCents < 0) {
    return null;
  }
  return { orderId: body.orderId, totalCents: body.totalCents, placedAt: new Date().toISOString() };
}

async function route(req, res, ctx) {
  if (ctx.method === 'GET' && ctx.path === '/healthz') {
    const probe = await db.ping();
    reply(res, ctx, 200, { status: 'ok', store: 'orders-postgres', residentRows: probe.residentRows });
    return;
  }

  if (ctx.method === 'GET' && ctx.path === '/recovery') {
    const record = objectives.objectivesFor('orders-postgres');
    if (record === null) {
      reply(res, ctx, 404, { error: 'unknown store' });
      return;
    }
    reply(res, ctx, 200, record);
    return;
  }

  const tenantId = req.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    reply(res, ctx, 401, { error: 'tenant required' });
    return;
  }

  if (ctx.method === 'POST' && ctx.path === '/orders') {
    let raw;
    try {
      raw = await readBody(req);
    } catch (err) {
      log.warn('body_rejected', { trace_id: ctx.traceId, path: ctx.path, reason: err.message });
      reply(res, ctx, 413, { error: 'body too large' });
      return;
    }
    const order = parseOrder(raw);
    if (order === null) {
      reply(res, ctx, 400, { error: 'orderId and totalCents required' });
      return;
    }
    const row = await db.insertOrder(tenantId, order);
    reply(res, ctx, 201, { orderId: row.orderId, totalCents: row.totalCents, placedAt: row.placedAt });
    return;
  }

  const parts = ctx.path.split('/');
  if (ctx.method === 'GET' && parts.length === 3 && parts[1] === 'orders' && ORDER_ID.test(parts[2])) {
    const row = await db.findOrder(tenantId, parts[2]);
    if (row === null) {
      reply(res, ctx, 404, { error: 'unknown order' });
      return;
    }
    reply(res, ctx, 200, { orderId: row.orderId, totalCents: row.totalCents, placedAt: row.placedAt });
    return;
  }

  reply(res, ctx, 404, { error: 'not found' });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://orders-api');
  const ctx = {
    traceId: crypto.randomUUID(),
    method: req.method,
    path: url.pathname,
    startedAt: Date.now()
  };

  route(req, res, ctx).catch(function (err) {
    log.error('store_unavailable', {
      trace_id: ctx.traceId,
      method: ctx.method,
      path: ctx.path,
      store: 'orders-postgres',
      reason: err.message
    });
    if (!res.headersSent) {
      reply(res, ctx, 503, { error: 'orders-postgres unavailable', retryAfterSeconds: 5 });
    }
  });
});

server.listen(PORT, function () {
  log.info('listening', { trace_id: 'boot', port: PORT });
});

module.exports = { server };
