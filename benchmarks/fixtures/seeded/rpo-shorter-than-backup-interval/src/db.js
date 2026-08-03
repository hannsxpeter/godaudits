'use strict';

// Client for orders-postgres, the managed instance declared in
// infra/database.tf. The fixture ships no driver, so the rows live in a bounded
// map here while every call keeps the deadline a real client would carry.

const QUERY_TIMEOUT_MS = 400;
const MAX_RESIDENT_ROWS = 500;

const rows = new Map();

// Bound on the resident map: oldest insertion leaves first once the ceiling is
// crossed, so the module-level collection cannot grow without limit.
function evictOldest() {
  while (rows.size > MAX_RESIDENT_ROWS) {
    const oldest = rows.keys().next();
    if (oldest.done) {
      return;
    }
    rows.delete(oldest.value);
  }
}

function rowKey(tenantId, orderId) {
  return tenantId + '/' + orderId;
}

// Explicit deadline on every call that leaves this process.
function withDeadline(work) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    const timer = setTimeout(function () {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('orders-postgres exceeded the ' + QUERY_TIMEOUT_MS + ' ms deadline'));
    }, QUERY_TIMEOUT_MS);
    timer.unref();

    Promise.resolve()
      .then(work)
      .then(
        function (value) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      );
  });
}

function ping() {
  return withDeadline(function () {
    return { reachable: true, residentRows: rows.size };
  });
}

function insertOrder(tenantId, order) {
  return withDeadline(function () {
    const row = {
      orderId: order.orderId,
      tenantId: tenantId,
      totalCents: order.totalCents,
      placedAt: order.placedAt
    };
    rows.set(rowKey(tenantId, row.orderId), row);
    evictOldest();
    return row;
  });
}

function findOrder(tenantId, orderId) {
  return withDeadline(function () {
    const row = rows.get(rowKey(tenantId, orderId));
    return row === undefined ? null : row;
  });
}

module.exports = { QUERY_TIMEOUT_MS, MAX_RESIDENT_ROWS, ping, insertOrder, findOrder };
