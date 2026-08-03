'use strict';
const http = require('http');
const crypto = require('crypto');
const { primary, reader, timeouts } = require('./db');
const { listArticles, getArticle, renameArticle } = require('./articles');
const { send } = require('./reply');
const log = require('./log');

const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY_BYTES = 64 * 1024;
const DETAIL_PATH = /^\/articles\/([A-Za-z0-9_-]{1,64})$/;
const TITLE_PATH = /^\/articles\/([A-Za-z0-9_-]{1,64})\/title$/;

function traceIdFor(req) {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.length > 0 && header.length <= 64) {
    return header;
  }
  return crypto.randomUUID();
}

function authorized(req) {
  const expected = process.env.HELPCENTER_EDITOR_TOKEN || '';
  const header = req.headers.authorization || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (expected.length === 0 || presented.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('request body over ' + MAX_BODY_BYTES + ' bytes'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Opens a round trip to each endpoint the request paths use; a failure on
// either one answers 503 rather than a constant ok.
async function health(res, traceId) {
  try {
    await primary.ping({ timeoutMs: timeouts.primary });
    await reader.ping({ timeoutMs: timeouts.reader });
    send(res, 200, { status: 'ok' });
  } catch (error) {
    log.error('healthz.store_unreachable', { traceId, reason: error.message });
    send(res, 503, { status: 'degraded' });
  }
}

async function handle(req, res, traceId) {
  const url = new URL(req.url, 'http://helpcenter-cms');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    await health(res, traceId);
    return;
  }

  if (!authorized(req)) {
    log.warn('request.rejected', { traceId, method: req.method, path: url.pathname });
    send(res, 401, { error: 'editor token required' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/articles') {
    await listArticles(res, { traceId, query: url.searchParams });
    return;
  }

  const detail = DETAIL_PATH.exec(url.pathname);
  if (req.method === 'GET' && detail) {
    await getArticle(res, { traceId, articleId: detail[1] });
    return;
  }

  const title = TITLE_PATH.exec(url.pathname);
  if (req.method === 'PATCH' && title) {
    let raw;
    try {
      raw = await readBody(req);
    } catch (error) {
      log.warn('request.body_rejected', { traceId, path: url.pathname, reason: error.message });
      send(res, 413, { error: 'body over ' + MAX_BODY_BYTES + ' bytes' });
      return;
    }
    await renameArticle(res, { traceId, articleId: title[1], raw });
    return;
  }

  send(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  const traceId = traceIdFor(req);
  handle(req, res, traceId).catch((error) => {
    log.error('request.failed', { traceId, method: req.method, reason: error.message });
    send(res, 503, { error: 'store unavailable' }, { 'Retry-After': '5' });
  });
});

server.listen(PORT);

module.exports = { server, handle };
