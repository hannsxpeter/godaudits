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
    budget: 'full',
    applicable: 'all',
    root,
    date: '2026-07-13'
  });
  // Derive from the catalog, never hard-code counts: the seeded audit mirrors it.
  const standardsCategories = Object.values(catalog.standards.frameworks)
    .reduce((sum, framework) => sum + framework.categories.length, 0);
  assert.equal(audit.domains.length, catalog.domains.length);
  assert.equal(audit.domains.flatMap((domain) => domain.checks).length, catalog.check_count);
  assert.equal(audit.standards.length, standardsCategories);
  const result = compileAudit(audit, { catalog });
  assert.deepEqual(result.errors, []);
  assert.equal(result.audit.computed.coverage.percent, 0);
  assert.equal(result.audit.computed.overall.score, 0);
});

test('medium budget keeps the complete ledger and leaves deep-trace work unknown', () => {
  const catalog = buildCatalog(root);
  const audit = initAudit(catalog, {
    name: 'medium-fixture',
    archetype: 'saas-dashboard',
    scale: 'funded-product',
    riskProfile: 'balanced',
    budget: 'medium',
    applicable: ['security', 'build'],
    root,
    date: '2026-07-22'
  });
  assert.equal(audit.audit.budget, 'medium');
  const applicable = audit.domains.filter((domain) => domain.status === 'applicable');
  const expectedCount = catalog.checks.filter((check) => ['security', 'build'].includes(check.domain)).length;
  assert.equal(applicable.flatMap((domain) => domain.checks).length, expectedCount);
  for (const domain of applicable) {
    for (const check of domain.checks) {
      const definition = catalog.checks.find((item) => item.id === check.id);
      if (definition.cost_tier === 'deep-trace') assert.equal(check.outcome, 'unknown');
    }
  }
  assert.deepEqual(compileAudit(audit, { catalog }).errors, []);
});

test('medium budget rejects a deep-trace verdict instead of overstating coverage', () => {
  const catalog = buildCatalog(root);
  const audit = initAudit(catalog, {
    name: 'budget-violation',
    archetype: 'api-service',
    scale: 'side-project',
    riskProfile: 'balanced',
    budget: 'medium',
    applicable: ['security'],
    root,
    date: '2026-07-22'
  });
  const check = audit.domains.find((domain) => domain.id === 'security').checks.find((item) => {
    const definition = catalog.checks.find((candidate) => candidate.id === item.id);
    return definition.cost_tier === 'deep-trace';
  });
  check.outcome = 'pass';
  assert.ok(compileAudit(audit, { catalog }).errors.some((error) => error.includes('must stay unknown at a medium budget')));
});

test('initializer preserves evidence-bound project context', () => {
  const catalog = buildCatalog(root);
  const evidence = fingerprintRepository(path.join(root, 'benchmarks/fixtures/node-api'));
  const audit = initAudit(catalog, {
    name: 'context-fixture',
    archetype: evidence.project_context.project_forms.primary.id,
    scale: 'side-project',
    riskProfile: 'balanced',
    budget: 'full',
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
