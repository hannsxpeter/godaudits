'use strict';

const SERVICE = 'ingest-worker';

function write(level, event, traceId, fields) {
  const record = Object.assign(
    {
      timestamp: new Date().toISOString(),
      service: SERVICE,
      level: level,
      event: event,
      trace_id: traceId
    },
    fields || {}
  );
  process.stdout.write(JSON.stringify(record) + '\n');
}

function info(event, traceId, fields) {
  write('info', event, traceId, fields);
}

function warn(event, traceId, fields) {
  write('warn', event, traceId, fields);
}

function error(event, traceId, fields) {
  write('error', event, traceId, fields);
}

module.exports = { info, warn, error };
