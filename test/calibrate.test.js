'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MIN_SAMPLE, aggregateCorpus, wilsonLower } = require('../skills/godaudits/runtime/lib/calibrate');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { validAudit } = require('./helpers');

function seededCase(name, provenance = 'authored') {
  return {
    name,
    provenance,
    audit: compileAudit(validAudit()).audit,
    expected: {
      required_findings: [{ check: 'A-SEC-3', severity: 'Critical', path: 'src/boards.js' }],
      clean_checks: ['A-SEC-4']
    }
  };
}

function statFor(report, check = 'A-SEC-3') {
  return report.checks.find((item) => item.check === check);
}

test('a perfect small sample never reports a perfect rate', () => {
  // Three for three is not a 100% detector, and the lower bound says so.
  assert.ok(wilsonLower(3, 3) < 1);
  assert.ok(wilsonLower(3, 3) > 0);
  // More evidence for the same rate earns a tighter bound.
  assert.ok(wilsonLower(300, 300) > wilsonLower(3, 3));
  assert.strictEqual(wilsonLower(0, 0), 0);
});

test('authored fixtures never produce a detection rate, however many there are', () => {
  // The trap this closes: authored cases detect their own seeds by
  // construction, so a rate over them measures the fixture author, not the
  // detector. Ten of them must still report nothing.
  const cases = Array.from({ length: MIN_SAMPLE * 2 }, (item, index) => seededCase(`authored-${index}`));
  const report = aggregateCorpus(cases);
  const stat = statFor(report);
  assert.strictEqual(stat.cases, MIN_SAMPLE * 2);
  assert.strictEqual(stat.recorded_cases, 0);
  assert.strictEqual(stat.sample, 'authored-only');
  assert.strictEqual(stat.detection_rate, null);
  assert.strictEqual(stat.detection_rate_lower_bound, null);
  // They still earn their keep as regression coverage.
  assert.strictEqual(stat.detected, MIN_SAMPLE * 2);
  assert.strictEqual(report.passed, true);
});

test('a rate is withheld until enough independent recorded audits exist', () => {
  const cases = Array.from({ length: MIN_SAMPLE - 1 }, (item, index) => seededCase(`recorded-${index}`, 'recorded'));
  const report = aggregateCorpus(cases);
  const stat = statFor(report);
  assert.strictEqual(stat.recorded_cases, MIN_SAMPLE - 1);
  assert.strictEqual(stat.sample, 'insufficient');
  assert.strictEqual(stat.detection_rate, null);
});

test('a rate appears once enough recorded audits carry it, and stays honest about n', () => {
  const cases = Array.from({ length: MIN_SAMPLE }, (item, index) => seededCase(`recorded-${index}`, 'recorded'));
  const report = aggregateCorpus(cases);
  const stat = statFor(report);
  assert.strictEqual(stat.recorded_cases, MIN_SAMPLE);
  assert.strictEqual(stat.sample, 'reported');
  assert.strictEqual(stat.detection_rate, 1);
  // Even at the floor, the lower bound refuses to read as a perfect detector.
  assert.ok(stat.detection_rate_lower_bound < 1);
});

test('authored cases do not top up a recorded sample toward the floor', () => {
  // Mixing must not let fixtures push a real sample over the line.
  const cases = [
    ...Array.from({ length: MIN_SAMPLE - 1 }, (item, index) => seededCase(`recorded-${index}`, 'recorded')),
    ...Array.from({ length: 5 }, (item, index) => seededCase(`authored-${index}`))
  ];
  const report = aggregateCorpus(cases);
  const stat = statFor(report);
  assert.strictEqual(stat.cases, MIN_SAMPLE - 1 + 5);
  assert.strictEqual(stat.recorded_cases, MIN_SAMPLE - 1);
  assert.strictEqual(stat.sample, 'insufficient');
  assert.strictEqual(stat.detection_rate, null);
});

test('a case without declared provenance is rejected rather than assumed', () => {
  const orphan = seededCase('no-provenance');
  delete orphan.provenance;
  assert.throws(() => aggregateCorpus([orphan]), /needs provenance authored or recorded/);
});

test('a detector that stops detecting a seeded defect fails the corpus', () => {
  const broken = seededCase('regressed');
  broken.audit.findings = [];
  const report = aggregateCorpus([broken]);
  assert.strictEqual(report.passed, false);
  assert.strictEqual(report.missed.length, 1);
  assert.strictEqual(report.missed[0].check, 'A-SEC-3');
});

test('a detector that falsely flags a declared clean check fails the corpus', () => {
  // Over-detection is the regression a recall-only gate can never catch: an
  // auditor that flags everything scores perfect recall forever.
  const noisy = seededCase('over-flagging');
  noisy.audit.findings.push({
    id: 'F-SEC-2',
    domain: 'security',
    title: 'False alarm raised against a check the corpus declares clean',
    severity: 'Medium',
    confidence: 'Tentative',
    effort: 'S',
    status: 'open',
    evidence: ['E-2'],
    impact: 'None; the control is present.',
    fix: 'Withdraw the finding.',
    verify: 'node --test test/security.test.js',
    checks: ['A-SEC-4'],
    remediation: []
  });
  const report = aggregateCorpus([noisy]);
  assert.strictEqual(report.passed, false);
  assert.strictEqual(report.false_alarms.length, 1);
  assert.ok(report.false_alarms[0].clean_control_rate < 1);
  // The seeded defect is still detected, so recall alone would have stayed green.
  assert.deepStrictEqual(report.missed, []);
});

test('the corpus states its scope and claims nothing about unseen repositories', () => {
  const report = aggregateCorpus([seededCase('one')]);
  assert.match(report.scope, /not a reliability estimate for unseen repositories/);
  assert.match(report.scope, /never feeds a per-repo score/);
  assert.match(report.scope, /never from authored fixtures/);
});
