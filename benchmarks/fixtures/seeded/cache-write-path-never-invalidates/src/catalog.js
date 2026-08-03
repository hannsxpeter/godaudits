'use strict';

const clients = require('./clients');
const log = require('./logger');

// Redis key shapes and their TTLs. Both keys are public catalog values
// addressed by SKU alone.
const PRODUCT_TTL_SECONDS = 604800;
const INVENTORY_TTL_SECONDS = 15;

// One loader per key at a time, so a cold or expired key sends a single
// Postgres read instead of one per waiting request. The map holds only keys
// being loaded right now and each entry is removed when its load settles; past
// MAX_INFLIGHT_KEYS a read is shed rather than queued.
const MAX_INFLIGHT_KEYS = 512;
const inflight = new Map();

class OverloadedError extends Error {
  constructor(key) {
    super('loads already in flight for ' + MAX_INFLIGHT_KEYS + ' keys');
    this.name = 'OverloadedError';
    this.key = key;
  }
}

function productKey(sku) {
  return 'product:' + sku;
}

function inventoryKey(sku) {
  return 'inventory:' + sku;
}

function singleFlight(key, load) {
  const pending = inflight.get(key);
  if (pending !== undefined) {
    return pending;
  }
  if (inflight.size >= MAX_INFLIGHT_KEYS) {
    return Promise.reject(new OverloadedError(key));
  }
  const settled = load().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, settled);
  return settled;
}

// A Redis failure on the read path degrades to a Postgres read rather than an
// error, so an unreachable cache costs latency and not availability.
async function cacheRead(key, traceId) {
  try {
    return await clients.redis.get(key);
  } catch (err) {
    log.warn('cache_read_failed', { trace_id: traceId, key: key, reason: err.message });
    return null;
  }
}

async function cacheFill(key, value, ttlSeconds, traceId) {
  try {
    await clients.redis.set(key, value, ttlSeconds);
    log.info('cache_filled', { trace_id: traceId, key: key, ttl_seconds: ttlSeconds });
  } catch (err) {
    log.warn('cache_fill_failed', { trace_id: traceId, key: key, reason: err.message });
  }
}

async function readThrough(key, ttlSeconds, loadRow, traceId) {
  const cached = await cacheRead(key, traceId);
  if (cached !== null) {
    log.info('cache_hit', { trace_id: traceId, key: key });
    return cached;
  }
  return singleFlight(key, async () => {
    const row = await loadRow();
    if (row === null) {
      return null;
    }
    await cacheFill(key, row, ttlSeconds, traceId);
    return row;
  });
}

function getProduct(sku, traceId) {
  return readThrough(
    productKey(sku),
    PRODUCT_TTL_SECONDS,
    () => clients.postgres.selectProduct(sku),
    traceId
  );
}

function getInventory(sku, traceId) {
  return readThrough(
    inventoryKey(sku),
    INVENTORY_TTL_SECONDS,
    () => clients.postgres.selectInventory(sku),
    traceId
  );
}

async function applyPriceChange(sku, priceCents, traceId) {
  const row = await clients.postgres.updatePrice(sku, priceCents);
  if (row === null) {
    return null;
  }
  log.info('price_change_applied', { trace_id: traceId, sku: sku, price_cents: priceCents });
  return row;
}

async function applyInventoryChange(sku, onHand, traceId) {
  const row = await clients.postgres.updateOnHand(sku, onHand);
  if (row === null) {
    return null;
  }
  // The delete is not swallowed: if it fails the change is answered 503 and
  // merchandising redelivers it, because the change id is recorded only after
  // this function returns.
  await clients.redis.del(inventoryKey(sku));
  log.info('inventory_change_applied', { trace_id: traceId, sku: sku, on_hand: onHand });
  return row;
}

module.exports = {
  getProduct,
  getInventory,
  applyPriceChange,
  applyInventoryChange,
  productKey,
  inventoryKey,
  PRODUCT_TTL_SECONDS,
  INVENTORY_TTL_SECONDS,
  MAX_INFLIGHT_KEYS
};
