'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');

const root = path.resolve(__dirname, '..');

test('catalog extracts every domain and unique check id', () => {
  const catalog = buildCatalog(root);
  // Invariants, not magic numbers: the catalog is self-consistent and every
  // domain's check ids are contiguous. Growing a domain must never edit this test.
  assert.equal(catalog.domains.length, catalog.domain_count);
  assert.equal(catalog.domains.length, new Set(catalog.checks.map((check) => check.domain)).size);
  assert.equal(catalog.check_count, catalog.checks.length);
  assert.equal(new Set(catalog.checks.map((check) => check.id)).size, catalog.checks.length);
  for (const domain of catalog.domains) {
    const numbers = catalog.checks
      .filter((check) => check.domain === domain.id)
      .map((check) => Number(check.id.slice(check.id.lastIndexOf('-') + 1)))
      .sort((a, b) => a - b);
    assert.equal(numbers.length, domain.check_count, `${domain.id} check_count matches its checks`);
    assert.deepEqual(numbers, numbers.map((_, index) => index + 1), `${domain.id} check ids are contiguous 1..N`);
  }
  assert.ok(catalog.checks.every((check) => check.title && check.module && check.look && check.fail));
  for (const profile of Object.values(catalog.profiles)) {
    assert.equal(Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0), 100);
  }
  for (const domain of catalog.domains) {
    const weight = catalog.checks.filter((check) => check.domain === domain.id).reduce((sum, check) => sum + check.default_weight, 0);
    assert.ok(Math.abs(weight - 100) < 0.001, `${domain.id} weights sum to ${weight}`);
  }
});

test('catalog derives audit_only from each module cross-verified mirror boundary', () => {
  const catalog = buildCatalog(root);
  for (const domain of catalog.domains) {
    assert.ok(Number.isInteger(domain.mirror_boundary), `${domain.id} declares a mirror boundary`);
    assert.ok(domain.mirror_boundary >= 1 && domain.mirror_boundary <= domain.check_count, `${domain.id} boundary is in range`);
    // Cross-verification invariant: the boundary never claims more mirrored
    // checks than godplans actually defines for the domain.
    assert.ok(domain.godplans_requirements >= domain.mirror_boundary, `${domain.id} boundary stays within the godplans R-catalog`);
    const domainChecks = catalog.checks.filter((check) => check.domain === domain.id);
    for (const check of domainChecks) {
      const number = Number(check.id.slice(check.id.lastIndexOf('-') + 1));
      assert.equal(check.audit_only, number > domain.mirror_boundary, `${check.id} audit_only reflects the boundary`);
    }
    assert.equal(domainChecks.filter((check) => check.audit_only).length, domain.audit_only_count, `${domain.id} audit_only_count agrees with the checks`);
  }
  // A mirrored check substitutes to a real godplans R-id; an inserted audit-only
  // one (money reconciliation lands at A-DB-24, shifting the boundary to 22) does not.
  assert.equal(catalog.checks.find((check) => check.id === 'A-DB-22').audit_only, false);
  assert.equal(catalog.checks.find((check) => check.id === 'A-DB-23').audit_only, true);
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
