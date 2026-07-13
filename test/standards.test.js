'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');
const { initAudit } = require('../skills/godaudits/runtime/lib/init');

const root = path.resolve(__dirname, '..');

function initializedAudit() {
  const catalog = buildCatalog(root);
  return {
    catalog,
    audit: initAudit(catalog, {
      name: 'standards-fixture',
      archetype: 'web-application',
      scale: 'funded-product',
      riskProfile: 'balanced',
      applicable: 'all',
      root,
      date: '2026-07-13'
    })
  };
}

test('standards ledger is complete and backward compatible', () => {
  const { audit, catalog } = initializedAudit();
  assert.deepEqual(compileAudit(audit, { catalog }).errors, []);
  delete audit.standards;
  assert.deepEqual(compileAudit(audit, { catalog }).errors, []);
});

test('standards dispositions require evidence and exact catalog coverage', () => {
  const { audit, catalog } = initializedAudit();
  audit.standards[0].status = 'pass';
  assert.ok(compileAudit(audit, { catalog }).errors.some((error) => error.includes('pass disposition requires evidence')));
  audit.standards.pop();
  assert.ok(compileAudit(audit, { catalog }).errors.some((error) => error.includes('standards ledger is missing')));
});
