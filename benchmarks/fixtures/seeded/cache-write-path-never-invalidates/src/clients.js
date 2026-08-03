'use strict';

const { withTimeout } = require('./timeout');

// Cutoffs for the two network dependencies. Nothing in this file issues a call
// without one.
const REDIS_TIMEOUT_MS = 20;
const POSTGRES_TIMEOUT_MS = 60;

// The recorded ceiling is 900000 SKUs across two keys, so the connection keeps
// at most that many keys resident and drops the oldest one when the ceiling is
// reached.
const MAX_RESIDENT_KEYS = 1800000;

// The Redis connection this process holds. The fixture ships no driver, so the
// keyspace lives in a bounded map here. Values are stored encoded and the
// connection expires a key on read once its TTL has passed.
function connectRedis(url) {
  const resident = new Map();

  function evictOldest() {
    const oldest = resident.keys().next();
    if (!oldest.done) {
      resident.delete(oldest.value);
    }
  }

  function readResident(key) {
    const entry = resident.get(key);
    if (entry === undefined) {
      return null;
    }
    if (entry.expiresAtMs <= Date.now()) {
      resident.delete(key);
      return null;
    }
    return JSON.parse(entry.encoded);
  }

  return {
    url: url,
    get(key) {
      return withTimeout(Promise.resolve(readResident(key)), REDIS_TIMEOUT_MS, 'redis get');
    },
    set(key, value, ttlSeconds) {
      if (!resident.has(key) && resident.size >= MAX_RESIDENT_KEYS) {
        evictOldest();
      }
      resident.set(key, {
        encoded: JSON.stringify(value),
        expiresAtMs: Date.now() + ttlSeconds * 1000
      });
      return withTimeout(Promise.resolve(true), REDIS_TIMEOUT_MS, 'redis set');
    },
    del(key) {
      const removed = resident.delete(key);
      return withTimeout(Promise.resolve(removed), REDIS_TIMEOUT_MS, 'redis del');
    },
    ping() {
      return withTimeout(Promise.resolve('PONG'), REDIS_TIMEOUT_MS, 'redis ping');
    },
    residentKeys() {
      return resident.size;
    }
  };
}

// The Postgres connection this process holds. The fixture ships no driver, so
// the rows live in a bounded map here. Every statement it issues is a point
// read or a single-row update matched on the primary key, parameterised by
// SKU, and cut off at POSTGRES_TIMEOUT_MS.
function connectPostgres(url) {
  function point(name, row) {
    return withTimeout(Promise.resolve(row), POSTGRES_TIMEOUT_MS, 'postgres ' + name);
  }

  return {
    url: url,
    selectProduct(sku) {
      return point('select_product', {
        sku: sku,
        name: 'Catalog item ' + sku,
        description: 'Storefront copy for ' + sku,
        priceCents: 1999
      });
    },
    selectInventory(sku) {
      return point('select_inventory', { sku: sku, onHand: 12 });
    },
    updatePrice(sku, priceCents) {
      return point('update_price', { sku: sku, priceCents: priceCents });
    },
    updateOnHand(sku, onHand) {
      return point('update_on_hand', { sku: sku, onHand: onHand });
    },
    liveness() {
      return point('liveness', true);
    }
  };
}

const redis = connectRedis(process.env.REDIS_URL);
const postgres = connectPostgres(process.env.DATABASE_URL);

module.exports = {
  redis: redis,
  postgres: postgres,
  REDIS_TIMEOUT_MS: REDIS_TIMEOUT_MS,
  POSTGRES_TIMEOUT_MS: POSTGRES_TIMEOUT_MS,
  MAX_RESIDENT_KEYS: MAX_RESIDENT_KEYS
};
