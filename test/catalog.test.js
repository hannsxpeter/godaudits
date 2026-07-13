'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');

const root = path.resolve(__dirname, '..');

test('catalog extracts every domain and unique check id', () => {
  const catalog = buildCatalog(root);
  assert.equal(catalog.domains.length, 18);
  assert.equal(catalog.check_count, 414);
  assert.equal(new Set(catalog.checks.map((check) => check.id)).size, 414);
  assert.ok(catalog.checks.every((check) => check.title && check.module && check.look && check.fail));
  for (const profile of Object.values(catalog.profiles)) {
    assert.equal(Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0), 100);
  }
  for (const domain of catalog.domains) {
    const weight = catalog.checks.filter((check) => check.domain === domain.id).reduce((sum, check) => sum + check.default_weight, 0);
    assert.ok(Math.abs(weight - 100) < 0.001, `${domain.id} weights sum to ${weight}`);
  }
});

test('catalog records inspection and failure guidance', () => {
  const catalog = buildCatalog(root);
  const check = catalog.checks.find((item) => item.id === 'A-SEC-3');
  assert.ok(check);
  assert.match(check.look, /route|handler|middleware/i);
  assert.match(check.fail, /Critical|High|authorization|tenant/i);
});
