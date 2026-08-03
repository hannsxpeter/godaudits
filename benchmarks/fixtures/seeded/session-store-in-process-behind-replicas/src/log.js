'use strict';

// One JSON object per line, written to stdout. Every line carries the same
// five fields so the collector can index them: timestamp, service, level,
// event, trace_id. Call sites add their own fields on top.
const SERVICE = 'checkout-session-api';

function emit(level, event, fields) {
  const record = {
    timestamp: new Date().toISOString(),
    service: SERVICE,
    level: level,
    event: event,
    trace_id: (fields && fields.trace_id) || 'unset'
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
  info(event, fields) {
    emit('info', event, fields);
  },
  warn(event, fields) {
    emit('warn', event, fields);
  },
  error(event, fields) {
    emit('error', event, fields);
  }
};
