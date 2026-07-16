'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MIN_SAMPLE, aggregateCorpus, wilsonLower } = require('../skills/godaudits/runtime/lib/calibrate');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { validAudit } = require('./helpers');

function seededCase(name) {
  return {
    name,
    audit: compileAudit(validAudit()).audit,
    expected: {
      required_findings: [{ check: 'A-SEC-3', severity: 'Critical', path: 'src/boards.js' }],
      clean_checks: ['A-SEC-4']
    }
  };
}

test('a perfect small sample never reports a perfect rate', () => {
  // Three for three is not a 100% detector, and the lower bound says so.
  assert.ok(wilsonLower(3, 3) < 1);
  assert.ok(wilsonLower(3, 3) > 0);
  // More evidence for the same rate earns a tighter bound.
  assert.ok(wilsonLower(300, 300) > wilsonLower(3, 3));
  assert.strictEqual(wilsonLower(0, 0), 0);
});

test('a rate is withheld until the sample can carry one', () => {
  const report = aggregateCorpus([seededCase('one')]);
  const stat = report.checks.find((item) => item.check === 'A-SEC-3');
  assert.strictEqual(stat.seeded, 1);
  assert.strictEqual(stat.detected, 1);
  assert.strictEqual(stat.sample, 'insufficient');
  // One case must not render as "100% detection".
  assert.strictEqual(stat.detection_rate, null);
  assert.strictEqual(stat.detection_rate_lower_bound, null);
});

test('a rate appears once the sample reaches the reporting floor', () => {
  const cases = Array.from({ length: MIN_SAMPLE }, (item, index) => seededCase(`case-${index}`));
  const report = aggregateCorpus(cases);
  const stat = report.checks.find((item) => item.check === 'A-SEC-3');
  assert.strictEqual(stat.seeded, MIN_SAMPLE);
  assert.strictEqual(stat.sample, 'reported');
  assert.strictEqual(stat.detection_rate, 1);
  // Even at a reported sample, the lower bound stays honest about small n.
  assert.ok(stat.detection_rate_lower_bound < 1);
  assert.strictEqual(report.passed, true);
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
});
