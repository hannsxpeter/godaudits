'use strict';

class DeadlineError extends Error {
  constructor(label, ms) {
    super(label + ' did not answer within ' + ms + ' ms');
    this.name = 'DeadlineError';
    this.label = label;
    this.timeoutMs = ms;
  }
}

function withDeadline(label, ms, start) {
  let timer = null;
  const expiry = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(label, ms)), ms);
  });
  return Promise.race([start(), expiry]).finally(() => clearTimeout(timer));
}

module.exports = { withDeadline, DeadlineError };
