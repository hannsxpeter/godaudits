'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');
const { initAudit } = require('../skills/godaudits/runtime/lib/init');
const { fingerprintRepository } = require('../skills/godaudits/runtime/lib/evidence');

const root = path.resolve(__dirname, '..');

test('initializer creates a complete unknown ledger that passes strict catalog validation', () => {
  const catalog = buildCatalog(root);
  const audit = initAudit(catalog, {
    name: 'full-fixture',
    archetype: 'saas-dashboard',
    scale: 'funded-product',
    riskProfile: 'balanced',
    applicable: 'all',
    root,
    date: '2026-07-13'
  });
  assert.equal(audit.domains.length, 18);
  assert.equal(audit.domains.flatMap((domain) => domain.checks).length, 427);
  assert.equal(audit.standards.length, 53);
  const result = compileAudit(audit, { catalog });
  assert.deepEqual(result.errors, []);
  assert.equal(result.audit.computed.coverage.percent, 0);
  assert.equal(result.audit.computed.overall.score, 0);
});

test('initializer preserves evidence-bound project context', () => {
  const catalog = buildCatalog(root);
  const evidence = fingerprintRepository(path.join(root, 'benchmarks/fixtures/node-api'));
  const audit = initAudit(catalog, {
    name: 'context-fixture',
    archetype: evidence.project_context.project_forms.primary.id,
    scale: 'side-project',
    riskProfile: 'balanced',
    applicable: 'all',
    root,
    date: '2026-07-13',
    evidence
  });
  assert.equal(audit.audit.project_form, 'api-service');
  assert.equal(audit.audit.evidence_fingerprint_sha256, evidence.fingerprint_sha256);
  assert.equal(audit.audit.evidence_commit, evidence.commit);
  assert.deepEqual(compileAudit(audit, { catalog }).errors, []);
});
