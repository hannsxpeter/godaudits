'use strict';

// Recovery objectives recorded for orders-postgres, the one durable store this
// service owns. The mechanism that produces recovery points is declared in
// infra/database.tf; this module only publishes the recorded numbers.
const ORDERS_POSTGRES = {
  store: 'orders-postgres',
  rpoMinutes: 5,
  rtoMinutes: 60,
  backupPlanName: 'orders-postgres-snapshots',
  backupVaultName: 'orders-postgres',
  lastRestoreDrillDate: '2026-06-18',
  lastRestoreDrillMinutes: 47
};

function objectivesFor(store) {
  return store === ORDERS_POSTGRES.store ? ORDERS_POSTGRES : null;
}

module.exports = { ORDERS_POSTGRES, objectivesFor };
