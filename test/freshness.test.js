'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');
const { fingerprintRepository } = require('../skills/godaudits/runtime/lib/evidence');
const { initAudit } = require('../skills/godaudits/runtime/lib/init');

const root = path.resolve(__dirname, '..');

function withEvidence(evidence) {
  const catalog = buildCatalog(root);
  const audit = initAudit(catalog, {
    name: 'freshness-fixture',
    archetype: 'cli-tool',
    scale: 'side-project',
    riskProfile: 'balanced',
    applicable: 'all',
    root,
    date: '2026-07-13',
    evidence
  });
  return { audit, catalog };
}

test('freshness gate accepts the exact repository fingerprint', () => {
  const currentEvidence = fingerprintRepository(root);
  const { audit, catalog } = withEvidence(currentEvidence);
  const result = compileAudit(audit, { catalog, requireFreshEvidence: true, currentEvidence });
  assert.deepEqual(result.errors, []);
});

test('freshness gate fails closed for missing and stale evidence', () => {
  const currentEvidence = fingerprintRepository(root);
  const without = withEvidence(null);
  assert.ok(compileAudit(without.audit, {
    catalog: without.catalog,
    requireFreshEvidence: true,
    currentEvidence
  }).errors.some((error) => error.includes('fingerprint_sha256 is required')));

  const staleEvidence = { ...currentEvidence, fingerprint_sha256: '0'.repeat(64), commit: 'stale-commit' };
  const stale = withEvidence(staleEvidence);
  const errors = compileAudit(stale.audit, { catalog: stale.catalog, requireFreshEvidence: true, currentEvidence }).errors;
  assert.ok(errors.some((error) => error.includes('fingerprint is stale')));
  assert.ok(errors.some((error) => error.includes('evidence commit is stale')));
});
