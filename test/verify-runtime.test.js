'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { planProbes, applyResults, isBehavioral } = require('../skills/godaudits/runtime/lib/verify-runtime');

const audit = {
  audit: { commit: 'abc123' },
  findings: [
    { id: 'F-SEC-9', status: 'open', severity: 'High', confidence: 'Tentative', title: 'MFA is a page gate only', impact: 'bypass', fix: 'enforce acr at the tier', verify: 'call the token endpoint pre-MFA', checks: ['A-SEC-29'] },
    { id: 'F-SEC-10', status: 'open', severity: 'Medium', confidence: 'Firm', title: 'Consent fires before opt-in', checks: ['A-SEC-31'] },
    { id: 'F-PRD-1', status: 'open', severity: 'Low', confidence: 'Firm', title: 'PRD framing is thin', checks: ['A-PRD-1'] },
    { id: 'F-DB-2', status: 'accepted-risk', severity: 'High', confidence: 'Firm', title: 'Money flow does not reconcile', checks: ['A-DB-24'] }
  ]
};

test('planProbes selects only behavioral findings and carries the probe', () => {
  const plan = planProbes(audit);
  const ids = plan.probes.map((p) => p.finding).sort();
  assert.deepEqual(ids, ['F-DB-2', 'F-SEC-10', 'F-SEC-9']); // A-PRD-1 is not behavioral
  assert.equal(plan.commit, 'abc123');
  const mfa = plan.probes.find((p) => p.finding === 'F-SEC-9');
  assert.equal(mfa.probe.steps, 'call the token endpoint pre-MFA');
  assert.equal(mfa.probe.expected_defect, 'bypass');
});

test('isBehavioral respects an explicit runtime_probe', () => {
  assert.equal(isBehavioral({ checks: ['A-PRD-1'], runtime_probe: { steps: 'x' } }), true);
  assert.equal(isBehavioral({ checks: ['A-PRD-1'] }), false);
});

test('applyResults raises confidence on confirm and marks refute, without mutating scores', () => {
  const report = applyResults(audit, { results: [
    { finding: 'F-SEC-9', outcome: 'confirmed', observed: 'token accepted pre-MFA' },
    { finding: 'F-SEC-10', outcome: 'refuted', observed: 'consent gated correctly' }
  ] });
  const mfa = report.dispositions.find((d) => d.finding === 'F-SEC-9');
  assert.equal(mfa.was_confidence, 'Tentative');
  assert.equal(mfa.now_confidence, 'Firm');
  assert.equal(mfa.disposition, 'confirmed-at-runtime');
  assert.equal(mfa.runtime_evidence.type, 'runtime');
  const consent = report.dispositions.find((d) => d.finding === 'F-SEC-10');
  assert.equal(consent.disposition, 'refuted-at-runtime');
  // AUDIT.json findings are not mutated by the report.
  assert.equal(audit.findings[0].confidence, 'Tentative');
});
