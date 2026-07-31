'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compileAudit, validateAudit } = require('../skills/godaudits/runtime/lib/audit');
const { planWayfinding, renderWayfinding } = require('../skills/godaudits/runtime/lib/wayfind');
const { renderAudit } = require('../skills/godaudits/runtime/lib/render');
const { validAudit } = require('./helpers');

// A two-step route with a real dependency edge. The base fixture has one
// remediation task and a final gate, which cannot show a frontier moving.
function routedAudit() {
  const audit = validAudit();
  audit.domains[0].checks[1].weight = 40;
  audit.tasks.splice(1, 0, {
    id: 'GA-102',
    phase: 2,
    wave: '2.1',
    title: 'Add a cross-tenant regression guard in CI',
    parallel: true,
    files: ['.github/workflows/lint.yml'],
    depends_on: ['GA-101'],
    reuses: 'the existing lint workflow',
    fixes: ['F-SEC-1'],
    acceptance: ['CI fails when a query omits the tenant predicate.', 'The guard runs on every pull request.'],
    verify: 'gh workflow view lint',
    checks: ['A-SEC-3'],
    status: 'open'
  });
  audit.findings[0].remediation.push('GA-102');
  audit.tasks[2].depends_on.push('GA-102');
  return audit;
}

function compiled(audit) {
  const result = compileAudit(audit);
  assert.deepEqual(result.errors, [], 'fixture must compile clean');
  return result.audit;
}

test('the frontier is only the open tasks whose every dependency is closed', () => {
  const map = planWayfinding(compiled(routedAudit()));
  assert.deepEqual(map.frontier.map((task) => task.id), ['GA-101']);
  assert.deepEqual(map.blocked.map((task) => task.id), ['GA-102']);
  // The final gate depends on every task by validation rule. Counting it as an
  // ordinary blocked task would put a permanently unreachable entry in every
  // map and credit every task with the same meaningless unblock.
  assert.ok(!map.blocked.some((task) => task.id === 'GA-601'));
  assert.equal(map.frontier[0].unblocks, 1);
});

test('closing a task advances the frontier without recompiling derived state', () => {
  const audit = compiled(routedAudit());
  const before = planWayfinding(audit);
  assert.deepEqual(before.frontier.map((task) => task.id), ['GA-101']);
  audit.tasks.find((task) => task.id === 'GA-101').status = 'done';
  const after = planWayfinding(audit);
  assert.deepEqual(after.frontier.map((task) => task.id), ['GA-102']);
  assert.deepEqual(after.done.map((task) => task.id), ['GA-101']);
  assert.equal(after.counts.blocked, 0);
});

test('a superseded blocker never strands its dependents', () => {
  // A superseded task will never complete, so waiting on it would hold every
  // dependent open forever. It is closed for dependency purposes.
  const audit = compiled(routedAudit());
  const gate = audit.tasks.find((task) => task.id === 'GA-601');
  gate.depends_on = ['GA-102'];
  audit.tasks.find((task) => task.id === 'GA-101').status = 'superseded';
  const map = planWayfinding(audit);
  assert.deepEqual(map.frontier.map((task) => task.id), ['GA-102']);
});

test('a claimed task leaves the frontier so a concurrent session skips it', () => {
  const audit = routedAudit();
  audit.tasks[0].claim = { owner: 'remediation-session-a', claimed: '2026-07-13' };
  const map = planWayfinding(compiled(audit));
  assert.deepEqual(map.frontier.map((task) => task.id), []);
  assert.deepEqual(map.claimed.map((task) => task.id), ['GA-101']);
  assert.equal(map.claimed[0].claim.owner, 'remediation-session-a');
});

test('a claim is rejected once the task it holds is no longer open', () => {
  const audit = routedAudit();
  audit.tasks[0].status = 'done';
  audit.tasks[0].claim = { owner: 'remediation-session-a', claimed: '2026-07-13' };
  assert.ok(validateAudit(audit).some((error) => /GA-101 is done but still carries a claim/.test(error)));
});

test('a claim without an owner or an ISO date is rejected', () => {
  const missingOwner = routedAudit();
  missingOwner.tasks[0].claim = { owner: '  ', claimed: '2026-07-13' };
  assert.ok(validateAudit(missingOwner).some((error) => /GA-101\.claim\.owner is required/.test(error)));
  const badDate = routedAudit();
  badDate.tasks[0].claim = { owner: 'session-a', claimed: 'yesterday' };
  assert.ok(validateAudit(badDate).some((error) => /GA-101\.claim\.claimed must be an ISO date/.test(error)));
});

test('frontier tasks sharing a file are named as a concurrency conflict', () => {
  // Validation only rejects parallel file overlap inside one wave. Across
  // waves the overlap is legal state, so the map has to say it out loud before
  // a second session claims the conflicting task.
  const audit = routedAudit();
  audit.tasks[1].depends_on = [];
  audit.tasks[1].files = ['src/boards.js'];
  const map = planWayfinding(compiled(audit));
  assert.equal(map.counts.frontier, 2);
  assert.match(map.frontier[0].conflicts_with.join(' '), /GA-102/);
  assert.match(map.frontier[1].conflicts_with.join(' '), /GA-101/);
});

test('every reference in the map is a name carrying its id, never a bare id', () => {
  const map = planWayfinding(compiled(routedAudit()));
  assert.equal(map.frontier[0].name, 'Scope board lookups to the tenant (GA-101)');
  assert.deepEqual(map.frontier[0].fixes, ['Board lookup omits the tenant predicate (F-SEC-1)']);
  assert.deepEqual(map.blocked[0].blocked_by, ['Scope board lookups to the tenant (GA-101)']);
  assert.equal(map.destination.gate, 'Re-run godaudits (GA-601)');
});

test('an unstated destination is reported as missing rather than silently omitted', () => {
  const map = planWayfinding(compiled(routedAudit()));
  assert.equal(map.destination.stated, false);
  assert.match(map.destination.note, /No destination is stated/);
  assert.deepEqual(map.destination.gate_acceptance, ['Security reaches 85 or better with no open Critical findings.']);
});

test('a stated destination is carried through to the map and the report', () => {
  const audit = routedAudit();
  audit.audit.destination = 'Security reaches 85 with no open Critical finding and coverage above 95 percent, confirmed by a re-audit at this commit.';
  const state = compiled(audit);
  const map = planWayfinding(state);
  assert.equal(map.destination.stated, true);
  assert.match(renderAudit(state), /### Destination\n\nSecurity reaches 85 with no open Critical finding/);
});

test('a destination too short to orient anyone to is rejected', () => {
  const audit = routedAudit();
  audit.audit.destination = 'done';
  assert.ok(validateAudit(audit).some((error) => /audit\.destination must state in prose/.test(error)));
});

test('fog and out of scope are separated by scope, not by sharpness', () => {
  const audit = routedAudit();
  audit.domains[0].checks[1].weight = 35;
  audit.domains[0].checks.push({
    id: 'A-SEC-9',
    outcome: 'unknown',
    confidence: 'Tentative',
    weight: 5,
    evidence: [],
    finding_ids: [],
    question: 'Does the export handler bind the tenant id, or is it reachable only through the reporting route?'
  });
  audit.not_yet_specified = [{
    domain: 'security',
    gist: 'The background job runner reads the same models as the API but was not traced.',
    revisit_when: 'after the tenant predicate lands',
    checks: ['A-SEC-9']
  }];
  const map = planWayfinding(compiled(audit));
  assert.equal(map.fog.unknown_total, 1);
  assert.equal(map.fog.unknown_with_question, 1);
  assert.equal(map.fog.not_yet_specified.length, 1);
  // The excluded seo domain is scope, not fog: it never graduates here.
  assert.deepEqual(map.out_of_scope.excluded_domains.map((item) => item.domain), ['seo']);
  assert.equal(map.fog.coverage_cost.percent, 67);
});

test('a resolving question is rejected on any outcome other than unknown', () => {
  const audit = routedAudit();
  audit.domains[0].checks[1].question = 'Is the middleware mounted before the router?';
  assert.ok(validateAudit(audit).some((error) => /A-SEC-4 states a resolving question but its outcome is pass/.test(error)));
});

test('fog naming a resolved check is rejected as fog that graduated and was never cleared', () => {
  const audit = routedAudit();
  audit.not_yet_specified = [{ domain: 'security', gist: 'Something unclear about the query layer.', checks: ['A-SEC-3'] }];
  assert.ok(validateAudit(audit).some((error) => /names resolved check A-SEC-3/.test(error)));
});

test('fog may not gather in a domain this audit ruled out of scope', () => {
  const audit = routedAudit();
  audit.not_yet_specified = [{ domain: 'seo', gist: 'Sitemap generation was never inspected.' }];
  assert.ok(validateAudit(audit).some((error) => /fog only gathers toward the destination/.test(error)));
  const unknownDomain = routedAudit();
  unknownDomain.not_yet_specified = [{ domain: 'wayfinding', gist: 'Not a domain at all.' }];
  assert.ok(validateAudit(unknownDomain).some((error) => /not an applicable domain/.test(error)));
});

test('an audit written before wayfinding existed still produces a map', () => {
  // Every wayfinding field is optional by design: the committed dogfood and
  // detector artifacts are evidence records and must keep validating untouched.
  const audit = validAudit();
  assert.deepEqual(validateAudit(audit), []);
  const map = planWayfinding(compiled(audit));
  assert.equal(map.destination.stated, false);
  assert.deepEqual(map.fog.not_yet_specified, []);
  assert.equal(map.fog.unknown_with_question, 0);
});

test('the rendered report names dependencies and fixes instead of listing bare ids', () => {
  const mdx = renderAudit(compiled(routedAudit()));
  assert.match(mdx, /- Depends on: Scope board lookups to the tenant \(GA-101\)\n/);
  assert.match(mdx, /- Fixes: Board lookup omits the tenant predicate \(F-SEC-1\)\n/);
  // Check ids stay bare: their titles live in the catalog, not in AUDIT.json,
  // and the plan-aware mirror renders an R-id in that slot.
  assert.match(mdx, /- Checks: A-SEC-3\n/);
});

test('the report leads the remediation plan with the destination and the frontier', () => {
  const mdx = renderAudit(compiled(routedAudit()));
  const plan = mdx.indexOf('## Remediation plan');
  const destination = mdx.indexOf('### Destination');
  const frontier = mdx.indexOf('### Frontier: 1 takeable now');
  const firstPhase = mdx.indexOf('## Phase 1');
  assert.ok(plan < destination && destination < frontier && frontier < firstPhase);
  assert.match(mdx, /## Not yet specified/);
  assert.match(mdx, /## Out of scope/);
  assert.match(mdx, /\| domain seo \| all checks excluded \| private API with no public crawlable surface \|/);
});

test('the text map is pure ASCII so it survives the repository unicode gate', () => {
  const audit = routedAudit();
  audit.audit.destination = 'Security reaches 85 with no open Critical finding, confirmed by a re-audit at this commit.';
  const text = renderWayfinding(planWayfinding(compiled(audit)));
  assert.ok(!/[^\x00-\x7F]/.test(text), 'wayfinding text must not contain a byte above 0x7F');
  assert.match(text, /FRONTIER \(1 takeable now\)/);
  assert.match(text, /OUT OF SCOPE/);
});

test('an empty frontier distinguishes a walked route from a stalled one', () => {
  const stalled = compiled(routedAudit());
  stalled.tasks.find((task) => task.id === 'GA-101').claim = { owner: 'session-a', claimed: '2026-07-13' };
  assert.match(renderWayfinding(planWayfinding(stalled)), /already blocked or claimed/);

  const walked = compiled(routedAudit());
  for (const task of walked.tasks) if (!task.final_gate) task.status = 'done';
  assert.match(renderWayfinding(planWayfinding(walked)), /The route is walked; run the final re-audit gate/);
});

test('planWayfinding never mutates the audit it reads', () => {
  // The map is a read. If deriving it could edit task state, a report command
  // would silently become a write to the machine source of truth.
  const audit = compiled(routedAudit());
  const before = structuredClone(audit);
  planWayfinding(audit);
  assert.deepStrictEqual(audit, before);
});

test('a dependency on a task that does not exist is named as missing, not skipped', () => {
  const audit = compiled(routedAudit());
  audit.tasks.find((task) => task.id === 'GA-102').depends_on = ['GA-999'];
  const map = planWayfinding(audit);
  assert.deepEqual(map.blocked.map((task) => task.id), ['GA-102']);
  assert.deepEqual(map.blocked[0].blocked_by, ['GA-999 (missing task)']);
});
