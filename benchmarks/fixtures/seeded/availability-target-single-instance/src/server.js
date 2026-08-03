'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const log = require('./logger');
const snapshot = require('./snapshot');

const PORT = Number(process.env.PORT) || 8080;

function send(res, status, body, traceId) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-Request-Id': traceId
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const headerId = req.headers['x-request-id'];
  const traceId = typeof headerId === 'string' && headerId ? headerId : randomUUID();
  const url = new URL(req.url, 'http://meter-readings-api');

  if (url.pathname === '/readyz') {
    snapshot
      .probe()
      .then((result) => {
        if (!result.ok) {
          log.warn('readiness_empty_snapshot', {
            trace_id: traceId,
            on_disk: result.onDisk,
            in_memory: result.inMemory
          });
          send(res, 503, { status: 'unready', reason: 'snapshot empty' }, traceId);
          return;
        }
        send(
          res,
          200,
          { status: 'ready', devices: result.inMemory, generation: result.generation },
          traceId
        );
      })
      .catch((err) => {
        log.error('readiness_snapshot_unreadable', { trace_id: traceId, reason: err.message });
        send(res, 503, { status: 'unready', reason: 'snapshot unreadable' }, traceId);
      });
    return;
  }

  if (url.pathname === '/readings') {
    const totals = snapshot.siteTotals();
    if (!totals.devices) {
      log.info('reading_miss', { trace_id: traceId });
      send(res, 503, { error: 'snapshot not loaded' }, traceId);
      return;
    }
    log.info('reading_served', { trace_id: traceId, devices: totals.devices });
    send(res, 200, totals, traceId);
    return;
  }

  send(res, 404, { error: 'not found' }, traceId);
});

snapshot
  .load()
  .then((result) => {
    log.info('snapshot_loaded', {
      loaded: result.loaded,
      evicted: result.evicted,
      generation: result.generation,
      max_devices: snapshot.MAX_DEVICES
    });
    server.listen(PORT, () => log.info('listening', { port: PORT }));
  })
  .catch((err) => {
    log.error('snapshot_load_failed', { reason: err.message, path: snapshot.SNAPSHOT_PATH });
    process.exitCode = 1;
  });

module.exports = { server };
