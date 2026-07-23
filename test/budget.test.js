'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { compileAudit, validateAudit } = require('../skills/godaudits/runtime/lib/audit');
const { buildCatalog, BEHAVIORAL_CHECKS, DEEP_CHECKS } = require('../skills/godaudits/runtime/lib/catalog');
const { initAudit } = require('../skills/godaudits/runtime/lib/init');

const root = path.resolve(__dirname, '..');

function mediumAudit(catalog) {
  return initAudit(catalog, {
    name: 'medium-fixture',
    archetype: 'api-service',
    scale: 'side-project',
    riskProfile: 'balanced',
    applicable: 'all',
    budget: 'medium',
    root,
    date: '2026-07-22'
  });
}

test('catalog assigns a cost tier to every check and behavioral checks are deep-trace', () => {
  const catalog = buildCatalog(root);
  for (const check of catalog.checks) assert.ok(['deep-trace', 'screening'].includes(check.cost_tier), check.id);
  for (const id of BEHAVIORAL_CHECKS) assert.ok(DEEP_CHECKS.has(id), `${id} behavioral but not deep`);
  assert.ok(DEEP_CHECKS.size > 0 && DEEP_CHECKS.size < catalog.check_count);
});

test('medium budget keeps the full ledger and validates clean', () => {
  const catalog = buildCatalog(root);
  const audit = mediumAudit(catalog);
  assert.equal(audit.audit.budget, 'medium');
  const ledger = audit.domains.flatMap((domain) => domain.checks).map((check) => check.id);
  assert.deepEqual(new Set(ledger), new Set(catalog.checks.map((check) => check.id)));
  assert.equal(ledger.length, catalog.check_count);
  for (const domain of audit.domains) {
    for (const check of domain.checks) {
      const definition = catalog.checks.find((item) => item.id === check.id);
      if (definition.cost_tier === 'deep-trace') assert.equal(check.outcome, 'unknown');
    }
  }
  assert.deepEqual(compileAudit(audit, { catalog }).errors, []);
});

test('default init records medium budget and keeps the full ledger', () => {
  const catalog = buildCatalog(root);
  const audit = initAudit(catalog, {
    name: 'full-fixture',
    archetype: 'api-service',
    scale: 'side-project',
    riskProfile: 'balanced',
    applicable: 'all',
    root,
    date: '2026-07-22'
  });
  assert.equal(audit.audit.budget, 'medium');
  assert.equal(audit.domains.flatMap((domain) => domain.checks).length, catalog.check_count);
});

test('unknown budget values are rejected at init and at validation', () => {
  const catalog = buildCatalog(root);
  assert.throws(() => initAudit(catalog, {
    name: 'x', archetype: 'api-service', scale: 'side-project', riskProfile: 'balanced',
    applicable: 'all', budget: 'quick', root, date: '2026-07-22'
  }), /unknown budget: quick/);
  const audit = mediumAudit(catalog);
  audit.audit.budget = 'quick';
  assert.ok(validateAudit(audit, { catalog }).some((error) => /invalid audit\.budget/.test(error)));
});

test('a deep-trace verdict contradicts a recorded medium budget', () => {
  const catalog = buildCatalog(root);
  const audit = mediumAudit(catalog);
  const deep = catalog.checks.find((check) => check.cost_tier === 'deep-trace');
  audit.domains.find((domain) => domain.id === deep.domain).checks.find((check) => check.id === deep.id).outcome = 'pass';
  const errors = validateAudit(audit, { catalog });
  assert.ok(errors.some((error) => error.includes('must stay unknown at a medium budget')));
});

test('a missing screening check still fails the scoped ledger', () => {
  const catalog = buildCatalog(root);
  const audit = mediumAudit(catalog);
  const security = audit.domains.find((domain) => domain.id === 'security');
  const dropped = security.checks.find((check) => check.id === 'A-SEC-13');
  security.checks = security.checks.filter((check) => check.id !== dropped.id);
  const errors = validateAudit(audit, { catalog });
  assert.ok(errors.some((error) => error.includes(`ledger is missing ${dropped.id}`)));
});

test('a complete screening pass leaves deep-trace checks unknown and caps coverage', () => {
  const catalog = buildCatalog(root);
  const audit = mediumAudit(catalog);
  audit.evidence.push({
    id: 'E-1',
    type: 'source',
    path: 'src/index.js',
    line: 1,
    quote: 'screening evidence',
    sha256: 'a'.repeat(64),
    redacted: false
  });
  for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
    for (const check of domain.checks) {
      const definition = catalog.checks.find((item) => item.id === check.id);
      if (definition.cost_tier === 'deep-trace') continue;
      check.outcome = 'pass';
      check.confidence = 'Firm';
      check.evidence = ['E-1'];
    }
  }
  const { audit: compiled, errors } = compileAudit(audit, { catalog });
  assert.deepEqual(errors, []);
  assert.ok(compiled.computed.coverage.percent < 100);
  assert.equal(compiled.computed.coverage.unknown, DEEP_CHECKS.size);
  assert.ok(compiled.computed.overall.coverage_cap < 100);
  assert.equal(compiled.computed.overall.score, compiled.computed.overall.coverage_cap);
});

test('full budget can evaluate both cost tiers', () => {
  const catalog = buildCatalog(root);
  const audit = initAudit(catalog, {
    name: 'full-fixture',
    archetype: 'api-service',
    scale: 'side-project',
    riskProfile: 'balanced',
    applicable: 'all',
    budget: 'full',
    root,
    date: '2026-07-22'
  });
  audit.evidence.push({
    id: 'E-1',
    type: 'source',
    path: 'src/index.js',
    line: 1,
    quote: 'full evidence',
    sha256: 'a'.repeat(64),
    redacted: false
  });
  for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
    for (const check of domain.checks) {
      check.outcome = 'pass';
      check.confidence = 'Firm';
      check.evidence = ['E-1'];
    }
  }
  const { audit: compiled, errors } = compileAudit(audit, { catalog });
  assert.deepEqual(errors, []);
  assert.equal(compiled.computed.coverage.percent, 100);
  assert.equal(compiled.computed.overall.coverage_cap, 100);
});
