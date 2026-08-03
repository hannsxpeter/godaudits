'use strict';

const { randomUUID } = require('node:crypto');

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 5000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 100;
const MAX_RATE_COUNTERS = 5000;

// Both maps are capacity bounded. A write that finds its map at the maximum
// first drops every entry whose TTL or rate window has already passed, then
// drops oldest-inserted keys until the map is back under the maximum. Map
// iteration order is insertion order, so keys().next() is the oldest key.
// Neither map can pass its maximum, and a write that finds room scans nothing.
const sessions = new Map();
const rateCounters = new Map();

function makeRoom(map, maxEntries, isStale, now) {
  if (map.size < maxEntries) {
    return;
  }
  for (const [key, entry] of map) {
    if (isStale(entry, now)) {
      map.delete(key);
    }
  }
  while (map.size >= maxEntries) {
    const oldest = map.keys().next();
    if (oldest.done) {
      return;
    }
    map.delete(oldest.value);
  }
}

function sessionExpired(entry, now) {
  return entry.expiresAt <= now;
}

function windowClosed(entry, now) {
  return entry.windowStart + RATE_WINDOW_MS <= now;
}

function createSession(accountId) {
  const now = Date.now();
  makeRoom(sessions, MAX_SESSIONS, sessionExpired, now);
  const id = randomUUID();
  sessions.set(id, { accountId: accountId, expiresAt: now + SESSION_TTL_MS });
  return id;
}

function readSession(id) {
  const entry = sessions.get(id);
  if (!entry) {
    return null;
  }
  if (sessionExpired(entry, Date.now())) {
    sessions.delete(id);
    return null;
  }
  return entry;
}

function allowRequest(accountId) {
  const now = Date.now();
  const counter = rateCounters.get(accountId);
  if (!counter || windowClosed(counter, now)) {
    makeRoom(rateCounters, MAX_RATE_COUNTERS, windowClosed, now);
    rateCounters.set(accountId, { windowStart: now, hits: 1 });
    return true;
  }
  counter.hits += 1;
  return counter.hits <= RATE_LIMIT_PER_WINDOW;
}

module.exports = {
  createSession,
  readSession,
  allowRequest,
  SESSION_TTL_MS,
  RATE_LIMIT_PER_WINDOW
};
