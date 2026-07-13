'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { fingerprintRepository } = require('../skills/godaudits/runtime/lib/evidence');

const fixture = path.join(__dirname, 'fixtures', 'sample-repo');

test('fingerprint is deterministic, redacts secrets, and records absences', () => {
  const first = fingerprintRepository(fixture);
  const second = fingerprintRepository(fixture);
  assert.deepEqual(first, second);
  assert.equal(first.archetype.primary, 'api-service');
  assert.ok(first.files.some((file) => file.path === 'src/server.js'));
  const secret = first.signals.find((signal) => signal.kind === 'possible-secret');
  assert.ok(secret);
  assert.doesNotMatch(secret.quote, /fixture-secret-value/);
  assert.doesNotMatch(JSON.stringify(first), /fixture-env-password/);
  assert.ok(first.files.some((file) => file.path === '.env.fixture' && !file.binary));
  assert.equal(secret.redacted, true);
  assert.ok(first.absence_evidence.some((entry) => entry.subject === 'continuous-integration'));
});
