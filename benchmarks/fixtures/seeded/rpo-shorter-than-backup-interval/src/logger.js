'use strict';

const SERVICE = 'orders-api';

// One JSON object per line on stdout. This is the only place in the service
// that writes to a stream, so no module reaches for console directly.
function emit(level, event, fields) {
  const record = Object.assign(
    {
      timestamp: new Date().toISOString(),
      service: SERVICE,
      level: level,
      event: event
    },
    fields || {}
  );
  process.stdout.write(JSON.stringify(record) + '\n');
}

module.exports = {
  info: function (event, fields) {
    emit('info', event, fields);
  },
  warn: function (event, fields) {
    emit('warn', event, fields);
  },
  error: function (event, fields) {
    emit('error', event, fields);
  }
};
