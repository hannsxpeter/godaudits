'use strict';

// Wayfinding: the remediation plan read as a navigable map.
//
// Borrowed from the wayfinder skill (mattpocock/skills, MIT), which charts work
// too large for one agent session as a shared map and works its frontier one
// item at a time. godaudits already builds the graph wayfinder assembles by
// hand: AUDIT.json carries a dependency-ordered task DAG, a complete check
// ledger with explicit unknown and not-applicable outcomes, and excluded
// domains with reasons. What it did not carry was the reader's view of that
// graph. Five wayfinder disciplines close that gap, and each lands on state
// godaudits already records:
//
//   destination   the final re-audit gate states the target, but it is the last
//                 task in the plan, so nothing orients to it before choosing.
//   frontier      open tasks whose every dependency is closed. Phases and waves
//                 are an authoring order; neither answers "what can I start
//                 now" once some tasks are done.
//   claim         parallel remediation is supported and file-isolated, but
//                 nothing stopped two sessions from taking the same task.
//   fog of war    unknown checks are in scope and lower coverage;
//                 not_yet_specified holds what the audit can see coming but
//                 cannot yet phrase as a check. Sharpness separates them: a
//                 question stateable now is a check, one that is not is fog.
//   out of scope  not-applicable checks and excluded domains. Scope, not
//                 sharpness, lands work here, and it never graduates inside
//                 this audit, so it stays out of the route actually walked.
//
// Wayfinder's refer-by-name rule applies throughout: a task or finding appears
// as its title with its id inside, never as a bare id. A wall of ids is
// illegible; a name reads at a glance and the id still rides along.
//
// Read-only by contract. This module never mutates AUDIT.json and never writes
// derived score state. The frontier is recomputed from task status on every
// call, so marking a task done moves the frontier without a recompile, and a
// stale frontier can never be committed into the audit record.

// A task is closed for dependency purposes when it can no longer become open.
// Superseded counts: a replaced task will never complete, so waiting on it
// would strand every dependent forever.
const CLOSED = new Set(['done', 'superseded']);

// Refer by name, never by a bare id. The id rides inside the name so machine
// traceability survives while the human-facing line stays readable.
function named(record) {
  if (!record) return null;
  return `${record.title} (${record.id})`;
}

function compareWave(left, right) {
  const a = String(left || '0.0').split('.').map(Number);
  const b = String(right || '0.0').split('.').map(Number);
  return (a[0] - b[0]) || (a[1] - b[1]);
}

function compareTask(left, right) {
  return (left.phase - right.phase) || compareWave(left.wave, right.wave) || left.id.localeCompare(right.id);
}

// The final gate depends on every remediation task by validation rule, so it is
// the destination rather than a member of the route. Counting it as an ordinary
// blocked task would add one meaningless blocker to every listing and add one
// meaningless unblocks credit to every task.
function isFinalGate(task) {
  return task.final_gate === true;
}

function taskIndex(audit) {
  return new Map((audit.tasks || []).map((task) => [task.id, task]));
}

// Open blockers only. A dependency on a missing task is reported rather than
// silently treated as satisfied: validation rejects it, but wayfind runs
// against whatever state exists, including a half-written plan.
function openBlockers(task, byId) {
  return (task.depends_on || []).map((id) => {
    const blocker = byId.get(id);
    if (!blocker) return { id, name: `${id} (missing task)`, missing: true };
    if (CLOSED.has(blocker.status)) return null;
    return { id, name: named(blocker), missing: false };
  }).filter(Boolean);
}

// How many other tasks this one directly releases. The final gate is excluded
// because it depends on everything, so including it would credit every task
// with the same one release and erase the ordering signal entirely.
function unblockCount(task, audit) {
  return (audit.tasks || []).filter((item) => !isFinalGate(item)
    && item.status === 'open'
    && (item.depends_on || []).includes(task.id)).length;
}

// Two frontier tasks touching the same file cannot be worked concurrently even
// when both are marked parallel. Validation already rejects that overlap inside
// one wave; across waves it is legal state, so the map has to say it out loud
// before a second session claims the conflicting task.
function fileConflicts(task, frontier) {
  const files = new Set(task.files || []);
  return frontier
    .filter((other) => other.id !== task.id && (other.files || []).some((file) => files.has(file)))
    .map((other) => named(other));
}

function claimOf(task) {
  if (!task.claim || !task.claim.owner) return null;
  return { owner: task.claim.owner, claimed: task.claim.claimed || null };
}

function describeTask(task, audit, byId, frontier) {
  const findings = new Map((audit.findings || []).map((finding) => [finding.id, finding]));
  return {
    id: task.id,
    name: named(task),
    phase: task.phase,
    wave: task.wave,
    parallel: task.parallel === true,
    claim: claimOf(task),
    files: task.files || [],
    verify: task.verify || null,
    fixes: (task.fixes || []).map((id) => named(findings.get(id)) || `${id} (missing finding)`),
    blocked_by: openBlockers(task, byId).map((item) => item.name),
    unblocks: unblockCount(task, audit),
    conflicts_with: frontier ? fileConflicts(task, frontier) : []
  };
}

// The destination fixes the scope, so it is read before any task is chosen.
// godaudits states it twice over: audit.destination in prose, and the final
// re-audit gate's acceptance conditions as the machine-checkable form. An audit
// written before this field existed still gets the gate half.
function destinationOf(audit) {
  const gate = (audit.tasks || []).find((task) => isFinalGate(task) && task.status !== 'superseded');
  const stated = typeof audit.audit.destination === 'string' && audit.audit.destination.trim().length > 0;
  return {
    stated,
    statement: stated ? audit.audit.destination : null,
    gate: gate ? named(gate) : null,
    gate_acceptance: gate ? (gate.acceptance || []) : [],
    gate_verify: gate ? gate.verify || null : null,
    gate_status: gate ? gate.status : null,
    note: stated
      ? null
      : 'No destination is stated. Record audit.destination so every remediation session orients to the same target before choosing a task.'
  };
}

// Fog of war: what this audit can see but has not resolved. Two shapes, split
// by sharpness rather than importance. An unknown check is a question already
// phrased precisely by the catalog and left unanswered. A not_yet_specified
// entry is the dimmer view: a lead the catalog cannot phrase as a check, which
// graduates into checks or findings only once the frontier reaches it.
function fogOf(audit) {
  const unknown = [];
  for (const domain of audit.domains || []) {
    if (domain.status === 'excluded') continue;
    for (const check of domain.checks || []) {
      if (check.outcome !== 'unknown') continue;
      unknown.push({
        domain: domain.id,
        check: check.id,
        weight: check.weight,
        question: check.question || null
      });
    }
  }
  const withQuestion = unknown.filter((item) => item.question).length;
  const coverage = (audit.computed && audit.computed.coverage) || null;
  return {
    not_yet_specified: (audit.not_yet_specified || []).map((item) => ({
      domain: item.domain,
      gist: item.gist,
      revisit_when: item.revisit_when || null,
      checks: item.checks || []
    })),
    unknown_checks: unknown,
    unknown_total: unknown.length,
    unknown_with_question: withQuestion,
    // Naming the cost keeps fog honest: an unknown is not a neutral gap, it is
    // coverage the verdict is already being capped for.
    coverage_cost: coverage
      ? {
        applicable: coverage.applicable,
        evaluated: coverage.evaluated,
        unknown: coverage.unknown,
        percent: coverage.percent,
        cap: audit.computed.overall.coverage_cap
      }
      : null
  };
}

// Out of scope: ruled beyond this audit's destination. Distinct from fog, which
// is in scope and merely unresolved. Out-of-scope work never graduates inside
// this audit; redrawing the scope is a fresh audit, not a resumption. It stays
// out of the route actually walked, so it is reported separately from findings.
function outOfScopeOf(audit) {
  const excludedDomains = (audit.domains || [])
    .filter((domain) => domain.status === 'excluded')
    .map((domain) => ({
      domain: domain.id,
      reason: domain.reason || 'No reason recorded.'
    }));
  const notApplicable = [];
  for (const domain of audit.domains || []) {
    if (domain.status === 'excluded') continue;
    for (const check of domain.checks || []) {
      if (check.outcome !== 'not-applicable') continue;
      notApplicable.push({ domain: domain.id, check: check.id, evidence: check.evidence || [] });
    }
  }
  const byDomain = new Map();
  for (const item of notApplicable) {
    byDomain.set(item.domain, (byDomain.get(item.domain) || 0) + 1);
  }
  return {
    excluded_domains: excludedDomains,
    not_applicable_checks: notApplicable,
    not_applicable_total: notApplicable.length,
    not_applicable_by_domain: [...byDomain.entries()].map(([domain, count]) => ({ domain, count }))
  };
}

// Read-only: derive the map from an AUDIT.json object. Nothing here consults
// the catalog or the repository, so the map is exactly as current as the audit
// state it is handed.
function planWayfinding(audit) {
  const byId = taskIndex(audit);
  const active = (audit.tasks || []).filter((task) => task.status !== 'superseded');
  const route = active.filter((task) => !isFinalGate(task));
  const open = route.filter((task) => task.status === 'open');

  const unblocked = open.filter((task) => openBlockers(task, byId).length === 0).sort(compareTask);
  const frontierTasks = unblocked.filter((task) => !claimOf(task));
  const claimedTasks = unblocked.filter((task) => claimOf(task));
  const blockedTasks = open.filter((task) => openBlockers(task, byId).length > 0).sort(compareTask);
  const doneTasks = route.filter((task) => task.status === 'done').sort(compareTask);

  const frontier = frontierTasks.map((task) => describeTask(task, audit, byId, frontierTasks));
  const destination = destinationOf(audit);

  return {
    schema_version: '1.0',
    generated_from: 'AUDIT.json',
    commit: audit.audit && audit.audit.commit,
    project: audit.audit && audit.audit.name,
    note: 'Read-only view of the remediation plan. The frontier is the set of open tasks whose every dependency is closed. Claim a task before starting work so a concurrent session skips it, then re-run wayfind after each task closes. Fog is in scope and unresolved; out of scope was ruled beyond this audit and never graduates inside it.',
    destination,
    frontier,
    claimed: claimedTasks.map((task) => describeTask(task, audit, byId, null)),
    blocked: blockedTasks.map((task) => describeTask(task, audit, byId, null)),
    done: doneTasks.map((task) => ({ id: task.id, name: named(task), phase: task.phase, wave: task.wave })),
    counts: {
      route_total: route.length,
      frontier: frontier.length,
      claimed: claimedTasks.length,
      blocked: blockedTasks.length,
      done: doneTasks.length
    },
    fog: fogOf(audit),
    out_of_scope: outOfScopeOf(audit),
    // The human lane. Some decisions do not resolve by reading code, and an
    // agent that answers its own open question has not resolved it, it has
    // stood in for the person who owns it.
    open_questions: (audit.open_questions || []).map((item) => ({
      question: item.question,
      owner: item.owner,
      due: item.due,
      default: item.default
    }))
  };
}

function bullet(lines, text, indent = '  ') {
  lines.push(`${indent}${text}`);
}

function section(lines, title) {
  lines.push('', title);
}

// Terminal-facing rendering. ASCII only, no table alignment tricks: this is
// read in a scrollback buffer, often by an agent pasting it into a fresh
// context, so it stays greppable rather than pretty.
function renderWayfinding(map) {
  const lines = [];
  lines.push(`godaudits wayfinding map: ${map.project || 'unnamed audit'}`);
  lines.push(`Commit ${map.commit || 'unrecorded'}. ${map.counts.done} of ${map.counts.route_total} remediation tasks closed.`);

  section(lines, 'DESTINATION');
  if (map.destination.statement) bullet(lines, map.destination.statement);
  else bullet(lines, map.destination.note);
  if (map.destination.gate) {
    bullet(lines, `Gate: ${map.destination.gate} [${map.destination.gate_status}]`);
    for (const condition of map.destination.gate_acceptance) bullet(lines, `- ${condition}`, '    ');
    if (map.destination.gate_verify) bullet(lines, `Verify: ${map.destination.gate_verify}`, '    ');
  } else {
    bullet(lines, 'No active final re-audit gate. The plan has no stated end.');
  }

  section(lines, `FRONTIER (${map.counts.frontier} takeable now)`);
  if (!map.frontier.length) {
    bullet(lines, (map.counts.blocked || map.counts.claimed)
      ? 'Nothing is takeable. Every open task is already blocked or claimed; close a blocker or release a claim first.'
      : 'Nothing is takeable. The route is walked; run the final re-audit gate.');
  }
  map.frontier.forEach((task, index) => {
    bullet(lines, `${index + 1}. ${task.name}`);
    bullet(lines, `phase ${task.phase}, wave ${task.wave}, ${task.parallel ? 'parallel-safe' : 'serial'}, unblocks ${task.unblocks}`, '     ');
    if (task.fixes.length) bullet(lines, `fixes: ${task.fixes.join('; ')}`, '     ');
    if (task.files.length) bullet(lines, `files: ${task.files.join(', ')}`, '     ');
    if (task.verify) bullet(lines, `verify: ${task.verify}`, '     ');
    if (task.conflicts_with.length) bullet(lines, `do not run beside: ${task.conflicts_with.join('; ')}`, '     ');
  });

  section(lines, `CLAIMED (${map.counts.claimed})`);
  if (!map.claimed.length) bullet(lines, 'None. An open unclaimed task is free to take.');
  for (const task of map.claimed) {
    bullet(lines, `${task.name} claimed by ${task.claim.owner}${task.claim.claimed ? ` on ${task.claim.claimed}` : ''}`);
  }

  section(lines, `BLOCKED (${map.counts.blocked})`);
  if (!map.blocked.length) bullet(lines, 'None.');
  for (const task of map.blocked) {
    bullet(lines, `${task.name}`);
    bullet(lines, `waiting on: ${task.blocked_by.join('; ')}`, '     ');
  }

  section(lines, `CLOSED (${map.counts.done} of ${map.counts.route_total})`);
  if (!map.done.length) bullet(lines, 'None.');
  for (const task of map.done) bullet(lines, task.name);

  section(lines, 'NOT YET SPECIFIED (in scope, not yet sharp enough to check)');
  if (!map.fog.not_yet_specified.length) bullet(lines, 'Nothing recorded.');
  for (const item of map.fog.not_yet_specified) {
    bullet(lines, `${item.domain}: ${item.gist}`);
    if (item.revisit_when) bullet(lines, `revisit when: ${item.revisit_when}`, '     ');
    if (item.checks.length) bullet(lines, `would sharpen: ${item.checks.join(', ')}`, '     ');
  }

  section(lines, `UNKNOWN CHECKS (${map.fog.unknown_total}, ${map.fog.unknown_with_question} carrying a stated question)`);
  if (map.fog.coverage_cost) {
    bullet(lines, `Coverage ${map.fog.coverage_cost.percent}% (${map.fog.coverage_cost.evaluated} of ${map.fog.coverage_cost.applicable} evaluated); the verdict is capped at ${map.fog.coverage_cost.cap}.`);
  }
  const questioned = map.fog.unknown_checks.filter((item) => item.question);
  if (!questioned.length) bullet(lines, 'No unknown check states the question that would resolve it.');
  for (const item of questioned.slice(0, 20)) bullet(lines, `${item.check} (${item.domain}): ${item.question}`);
  if (questioned.length > 20) bullet(lines, `... and ${questioned.length - 20} more stated questions.`);

  section(lines, 'OUT OF SCOPE (ruled beyond this audit; never graduates here)');
  if (!map.out_of_scope.excluded_domains.length && !map.out_of_scope.not_applicable_total) {
    bullet(lines, 'Nothing ruled out of scope.');
  }
  for (const item of map.out_of_scope.excluded_domains) bullet(lines, `domain ${item.domain}: ${item.reason}`);
  for (const item of map.out_of_scope.not_applicable_by_domain) {
    bullet(lines, `${item.domain}: ${item.count} not-applicable checks, each with evidence in the ledger.`);
  }

  section(lines, `OPEN QUESTIONS (${map.open_questions.length}, human-owned)`);
  if (!map.open_questions.length) bullet(lines, 'None.');
  for (const item of map.open_questions) {
    bullet(lines, `${item.question}`);
    bullet(lines, `owner ${item.owner}, due ${item.due}, default if unanswered: ${item.default}`, '     ');
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { CLOSED, named, planWayfinding, renderWayfinding, destinationOf, fogOf, outOfScopeOf };
