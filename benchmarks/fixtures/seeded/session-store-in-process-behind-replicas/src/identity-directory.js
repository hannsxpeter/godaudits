'use strict';

const config = require('../config/service.json');
const log = require('./log');

// Stub stand-in for the identity directory client. The deployed build swaps in
// the HTTP client for config.identityDirectoryUrl; both shapes resolve a signed
// login assertion to the account it belongs to, and both are called through
// callWithTimeout so no call can hang a request handler. The directory checks
// the assertion signature; this service holds no verifying key of its own.
const ASSERTION_PREFIX = 'assert-';

function callWithTimeout(work, timeoutMs, operation) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('identity directory ' + operation + ' exceeded ' + timeoutMs + ' ms'));
    }, timeoutMs);
    Promise.resolve()
      .then(work)
      .then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
  });
}

function lookupAccount(assertion, options) {
  const timeoutMs = options.timeoutMs;
  const traceId = options.traceId;
  log.info('identity_directory_lookup', {
    trace_id: traceId,
    url: config.identityDirectoryUrl,
    timeout_ms: timeoutMs
  });
  return callWithTimeout(
    () => {
      const trimmed = String(assertion).trim();
      if (!trimmed.startsWith(ASSERTION_PREFIX) || trimmed.length === ASSERTION_PREFIX.length) {
        return null;
      }
      return { accountId: trimmed.slice(ASSERTION_PREFIX.length) };
    },
    timeoutMs,
    'lookup'
  );
}

function ping(options) {
  const timeoutMs = options.timeoutMs;
  const traceId = options.traceId;
  log.info('identity_directory_ping', {
    trace_id: traceId,
    url: config.identityDirectoryUrl,
    timeout_ms: timeoutMs
  });
  return callWithTimeout(() => ({ status: 'up' }), timeoutMs, 'status');
}

module.exports = { lookupAccount, ping };
