'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { fingerprintRepository } = require('../skills/godaudits/runtime/lib/evidence');
const { isCopySurfacePath } = require('../skills/godaudits/runtime/lib/copy-signals');

const fixture = path.join(__dirname, '..', 'benchmarks', 'fixtures', 'copy-signals');

test('copy signals cover high-confidence categories on reader-facing paths', () => {
  const fingerprint = fingerprintRepository(fixture);
  const kinds = new Set(fingerprint.signals.map((signal) => signal.kind));
  assert.equal(fingerprint.schema_version, '1.2');
  assert.deepEqual([...kinds].filter((kind) => kind.startsWith('copy-')).sort(), [
    'copy-chatbot-residue',
    'copy-filler',
    'copy-formula',
    'copy-generic-conclusion',
    'copy-hedging',
    'copy-promotional',
    'copy-puffery',
    'copy-vague-attribution'
  ]);
  assert.ok(fingerprint.signals.some((signal) => signal.path === 'src/components/Hero.tsx'));
});

test('copy signals exclude technical source, release history, code fences, and precise technical terms', () => {
  const fingerprint = fingerprintRepository(fixture);
  const copySignals = fingerprint.signals.filter((signal) => signal.kind.startsWith('copy-'));
  assert.ok(copySignals.every((signal) => signal.path !== 'src/technical.js'));
  assert.ok(copySignals.every((signal) => signal.path !== 'CHANGELOG.md'));
  assert.ok(copySignals.every((signal) => !signal.quote.includes('fenced example')));
  assert.ok(copySignals.every((signal) => !signal.quote.includes('API surface')));
  assert.equal(isCopySurfacePath('README.md'), true);
  assert.equal(isCopySurfacePath('src/components/Hero.tsx'), true);
  assert.equal(isCopySurfacePath('src/technical.js'), false);
  assert.equal(isCopySurfacePath('tests/copy.test.tsx'), false);
});
