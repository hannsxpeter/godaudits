'use strict';

const SERVICE = 'helpcenter-cms';

function emit(level, event, fields) {
  const record = {
    timestamp: new Date().toISOString(),
    service: SERVICE,
    level,
    event,
    trace_id: fields.traceId
  };
  for (const key of Object.keys(fields)) {
    if (key !== 'traceId') {
      record[key] = fields[key];
    }
  }
  process.stdout.write(JSON.stringify(record) + '\n');
}

module.exports = {
  info: (event, fields) => emit('info', event, fields),
  warn: (event, fields) => emit('warn', event, fields),
  error: (event, fields) => emit('error', event, fields)
};
