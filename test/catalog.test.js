'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');

const root = path.resolve(__dirname, '..');

test('catalog extracts every domain and unique check id', () => {
  const catalog = buildCatalog(root);
  assert.equal(catalog.domains.length, 18);
  assert.equal(catalog.check_count, 424);
  assert.equal(new Set(catalog.checks.map((check) => check.id)).size, 424);
  assert.ok(catalog.checks.every((check) => check.title && check.module && check.look && check.fail));
  for (const profile of Object.values(catalog.profiles)) {
    assert.equal(Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0), 100);
  }
  for (const domain of catalog.domains) {
    const weight = catalog.checks.filter((check) => check.domain === domain.id).reduce((sum, check) => sum + check.default_weight, 0);
    assert.ok(Math.abs(weight - 100) < 0.001, `${domain.id} weights sum to ${weight}`);
  }
});

test('catalog maps every OWASP Web Top 10:2025 category to known checks', () => {
  const catalog = buildCatalog(root);
  const framework = catalog.standards.frameworks['owasp-web-2025'];
  assert.equal(framework.categories.length, 10);
  assert.deepEqual(framework.categories.map((category) => category.id), [
    'A01:2025', 'A02:2025', 'A03:2025', 'A04:2025', 'A05:2025',
    'A06:2025', 'A07:2025', 'A08:2025', 'A09:2025', 'A10:2025'
  ]);
  assert.ok(framework.categories.every((category) => category.checks.length > 0));
  assert.ok(catalog.checks.find((check) => check.id === 'A-SEC-28').standards.includes('owasp-web-2025/A10:2025'));
});

test('catalog records inspection and failure guidance', () => {
  const catalog = buildCatalog(root);
  const check = catalog.checks.find((item) => item.id === 'A-SEC-3');
  assert.ok(check);
  assert.match(check.look, /route|handler|middleware/i);
  assert.match(check.fail, /Critical|High|authorization|tenant/i);
});
