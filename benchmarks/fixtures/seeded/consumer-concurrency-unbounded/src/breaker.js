'use strict';

function createBreaker(options) {
  const state = { failures: 0, openedAt: 0 };

  function isOpen(now) {
    if (state.openedAt === 0) {
      return false;
    }
    if (now - state.openedAt >= options.openMs) {
      state.openedAt = 0;
      state.failures = 0;
      return false;
    }
    return true;
  }

  function recordSuccess() {
    state.failures = 0;
    state.openedAt = 0;
  }

  function recordFailure(now) {
    state.failures += 1;
    if (state.openedAt === 0 && state.failures >= options.failureThreshold) {
      state.openedAt = now;
      return true;
    }
    return false;
  }

  return { isOpen, recordSuccess, recordFailure };
}

module.exports = { createBreaker };
