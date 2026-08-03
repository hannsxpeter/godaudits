'use strict';

function createProcessedIds(maxEntries) {
  const seen = new Map();

  function has(id) {
    return seen.has(id);
  }

  function remember(id, at) {
    if (seen.has(id)) {
      seen.delete(id);
    }
    seen.set(id, at);
    while (seen.size > maxEntries) {
      const oldest = seen.keys().next().value;
      seen.delete(oldest);
    }
  }

  function size() {
    return seen.size;
  }

  return { has, remember, size };
}

module.exports = { createProcessedIds };
