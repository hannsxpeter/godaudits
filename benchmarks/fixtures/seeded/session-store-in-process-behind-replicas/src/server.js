'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const config = require('../config/service.json');
const log = require('./log');
const identity = require('./identity-directory');
const {
  createSession,
  readSession,
  allowRequest,
  SESSION_TTL_MS
} = require('./session-store');

const MAX_LOGIN_BODY_BYTES = 1024;

function send(res, status, body, traceId) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'x-trace-id': traceId
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_LOGIN_BODY_BYTES) {
        req.destroy();
        reject(new Error('login body over ' + MAX_LOGIN_BODY_BYTES + ' bytes'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// POST /login: the identity directory resolves the assertion to an account and
// the session id handed back is what GET /me is asked to present.
async function handleLogin(req, res, traceId) {
  // The login route is throttled before it does any work, keyed by the calling
  // address because no account is known yet.
  const caller = req.socket.remoteAddress || 'unknown';
  if (!allowRequest(`login:${caller}`)) {
    log.warn('login_throttled', { trace_id: traceId, caller: caller });
    send(res, 429, { error: 'too many login attempts' }, traceId);
    return;
  }

  let assertion = '';
  try {
    const raw = await readBody(req);
    assertion = String(JSON.parse(raw || '{}').assertion || '');
  } catch (error) {
    log.warn('login_body_rejected', { trace_id: traceId, reason: error.message });
    send(res, 400, { error: 'malformed login body' }, traceId);
    return;
  }
  if (!assertion) {
    send(res, 400, { error: 'assertion required' }, traceId);
    return;
  }

  let account = null;
  try {
    account = await identity.lookupAccount(assertion, {
      timeoutMs: config.identityLookupTimeoutMs,
      traceId: traceId
    });
  } catch (error) {
    // Degradation path: no session is created and nothing is queued for later.
    log.error('identity_directory_unavailable', { trace_id: traceId, reason: error.message });
    send(res, 503, { error: 'identity directory unavailable' }, traceId);
    return;
  }

  if (!account) {
    log.warn('login_rejected', { trace_id: traceId });
    send(res, 401, { error: 'assertion not accepted' }, traceId);
    return;
  }

  const sessionId = createSession(account.accountId);
  log.info('session_created', { trace_id: traceId, account_id: account.accountId });
  send(
    res,
    201,
    { sessionId: sessionId, expiresInSeconds: SESSION_TTL_MS / 1000 },
    traceId
  );
}

// GET /me: the signed-in read path. It calls no other process.
function handleMe(req, res, traceId) {
  const sessionId = req.headers['x-session-id'];
  const session = sessionId ? readSession(String(sessionId)) : null;
  if (!session) {
    log.warn('session_not_found', { trace_id: traceId });
    send(res, 401, { error: 'unauthenticated' }, traceId);
    return;
  }
  if (!allowRequest(session.accountId)) {
    log.warn('rate_limited', { trace_id: traceId, account_id: session.accountId });
    send(res, 429, { error: 'rate limited' }, traceId);
    return;
  }
  send(res, 200, { accountId: session.accountId }, traceId);
}

// Readiness pings the identity directory rather than answering from nothing,
// so a replica that cannot reach it leaves rotation instead of taking logins
// it cannot finish.
async function handleReadyz(res, traceId) {
  const startedAt = Date.now();
  try {
    const status = await identity.ping({
      timeoutMs: config.identityPingTimeoutMs,
      traceId: traceId
    });
    send(
      res,
      200,
      { ready: true, identityDirectory: status.status, pingMs: Date.now() - startedAt },
      traceId
    );
  } catch (error) {
    log.error('readiness_failed', { trace_id: traceId, reason: error.message });
    send(res, 503, { ready: false, reason: 'identity directory unreachable' }, traceId);
  }
}

const server = http.createServer((req, res) => {
  const traceId = String(req.headers['x-request-id'] || randomUUID());
  const url = new URL(req.url, 'http://checkout-session-api');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    // Liveness answers from process state alone. A directory outage must not
    // restart replicas, so the dependency ping lives on /readyz instead.
    const accepting = server.listening;
    send(res, accepting ? 200 : 503, { accepting: accepting }, traceId);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/readyz') {
    handleReadyz(res, traceId).catch((error) => {
      log.error('readiness_error', { trace_id: traceId, reason: error.message });
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    handleLogin(req, res, traceId).catch((error) => {
      log.error('login_error', { trace_id: traceId, reason: error.message });
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/me') {
    handleMe(req, res, traceId);
    return;
  }

  send(res, 404, { error: 'not found' }, traceId);
});

server.listen(config.port);

module.exports = { server };
