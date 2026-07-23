'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { planRefutations, applyRefutations } = require('../skills/godaudits/runtime/lib/refute');

const audit = {
  audit: { commit: 'abc123' },
  evidence: [
    { id: 'E-1', type: 'source', path: 'src/boards.js', line: 8, quote: 'db.boards.findOne({ id })', sha256: 'a'.repeat(64) },
    { id: 'E-2', type: 'source', path: 'src/router.js', line: 4, quote: 'router.use(authorize)', sha256: 'b'.repeat(64) },
    { id: 'E-3', type: 'absence', scope: 'repo', command: 'grep -r rls', quote: 'no row-level security' }
  ],
  findings: [
    { id: 'F-SEC-1', status: 'open', severity: 'Critical', title: 'Board lookup omits the tenant predicate', impact: 'cross-tenant read', fix: 'bind the tenant predicate in the query', evidence: ['E-1', 'E-3'], checks: ['A-SEC-3'] },
    { id: 'F-SEC-9', status: 'open', severity: 'High', title: 'MFA is a page gate only', impact: 'bypass', fix: 'enforce acr at the tier', evidence: ['E-2'], checks: ['A-SEC-29'] },
    { id: 'F-PRD-1', status: 'open', severity: 'Low', title: 'PRD framing is thin', evidence: [], checks: ['A-PRD-1'] },
    { id: 'F-DB-2', status: 'resolved', severity: 'Critical', title: 'Money flow does not reconcile', evidence: [], checks: ['A-DB-24'] }
  ]
};

test('planRefutations briefs only open Critical and High findings', () => {
  const plan = planRefutations(audit);
  const ids = plan.briefs.map((b) => b.finding).sort();
  // F-PRD-1 is Low, F-DB-2 is resolved: neither gets a brief.
  assert.deepEqual(ids, ['F-SEC-1', 'F-SEC-9']);
  assert.equal(plan.commit, 'abc123');
});

test('a brief carries the claim, check, expected behavior, and only source citations', () => {
  const plan = planRefutations(audit);
  const brief = plan.briefs.find((b) => b.finding === 'F-SEC-1');
  assert.equal(brief.claim, 'Board lookup omits the tenant predicate');
  assert.deepEqual(brief.checks, ['A-SEC-3']);
  assert.equal(brief.expected_behavior, 'bind the tenant predicate in the query');
  // Only the source evidence is a citation; the absence record is not.
  assert.equal(brief.citations.length, 1);
  assert.equal(brief.citations[0].path, 'src/boards.js');
  assert.equal(brief.citations[0].sha256, 'a'.repeat(64));
  // Originating reasoning is stripped: no impact narrative on the brief.
  assert.equal('impact' in brief, false);
});

test('applyRefutations records dispositions and never mutates the finding', () => {
  const report = applyRefutations(audit, { results: [
    { finding: 'F-SEC-1', outcome: 'refuted', guard: { path: 'src/repo.js', line: 12, quote: 'scoped(query, tenant)' }, note: 'a repository layer injects the tenant' },
    { finding: 'F-SEC-9', outcome: 'weakened', guard: { path: 'src/mfa.js', line: 3 }, note: 'holds only for the legacy path' }
  ] });
  const refuted = report.dispositions.find((d) => d.finding === 'F-SEC-1');
  assert.equal(refuted.disposition, 'refuted');
  assert.equal(refuted.guard.path, 'src/repo.js');
  // A refuted finding's guard may support a strength or the check pass, never the finding.
  assert.equal(refuted.guard_supports, 'strength-or-check-pass');
  const weakened = report.dispositions.find((d) => d.finding === 'F-SEC-9');
  assert.equal(weakened.disposition, 'weakened');
  assert.equal(weakened.guard_supports, 'narrowed-finding');
  // No mutation: the source finding still has no evidence added and its severity stands.
  assert.equal(audit.findings[0].severity, 'Critical');
  assert.deepEqual(audit.findings[0].evidence, ['E-1', 'E-3']);
});

test('an unknown outcome degrades to no-refutation and drops any guard', () => {
  const report = applyRefutations(audit, { results: [
    { finding: 'F-SEC-1', outcome: 'invented', guard: { path: 'src/repo.js', line: 12 } }
  ] });
  const d = report.dispositions[0];
  assert.equal(d.disposition, 'no-refutation');
  assert.equal(d.guard, null);
  assert.equal(d.guard_supports, null);
});
