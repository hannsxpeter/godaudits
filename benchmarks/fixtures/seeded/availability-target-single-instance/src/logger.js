'use strict';

// The only log sink in this service. Nothing else writes to stdout or
// stderr, so every line on the stream is exactly one JSON object.
const SERVICE = 'meter-readings-api';
const LEVELS = new Set(['info', 'warn', 'error']);

function emit(level, event, fields) {
  const record = {
    timestamp: new Date().toISOString(),
    service: SERVICE,
    level: LEVELS.has(level) ? level : 'info',
    event: event,
    trace_id: (fields && fields.trace_id) || 'unassigned'
  };

  if (fields) {
    for (const key of Object.keys(fields)) {
      if (key !== 'trace_id') {
        record[key] = fields[key];
      }
    }
  }

  process.stdout.write(JSON.stringify(record) + '\n');
}

module.exports = {
  info: (event, fields) => emit('info', event, fields),
  warn: (event, fields) => emit('warn', event, fields),
  error: (event, fields) => emit('error', event, fields)
};
