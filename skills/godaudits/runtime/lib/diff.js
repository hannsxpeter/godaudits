'use strict';

function mapById(items) {
  return new Map((items || []).map((item) => [item.id, item]));
}

function sorted(values) {
  return values.sort((left, right) => left.localeCompare(right));
}

function checks(audit) {
  return (audit.domains || []).flatMap((domain) => domain.checks || []);
}

function movement(previous, current) {
  const result = { previous, current };
  result.delta = previous === null || current === null ? null : current - previous;
  return result;
}

function diffAudits(previous, current) {
  const before = mapById(previous.findings);
  const after = mapById(current.findings);
  const added = [];
  const resolved = [];
  const reopened = [];
  const changed = [];
  const statusChanges = [];

  for (const [id, finding] of after) {
    const old = before.get(id);
    if (!old) {
      added.push(id);
      continue;
    }
    if (old.status === 'open' && finding.status === 'resolved') resolved.push(id);
    if (old.status === 'resolved' && finding.status === 'open') reopened.push(id);
    if (old.status !== finding.status) statusChanges.push({ id, status: [old.status, finding.status] });
    if (old.severity !== finding.severity || old.confidence !== finding.confidence || old.title !== finding.title) {
      changed.push({
        id,
        severity: [old.severity, finding.severity],
        confidence: [old.confidence, finding.confidence],
        title_changed: old.title !== finding.title
      });
    }
  }

  const beforeChecks = mapById(checks(previous));
  const checkChanges = [];
  for (const [id, check] of mapById(checks(current))) {
    const old = beforeChecks.get(id);
    if (old && (old.outcome !== check.outcome || old.confidence !== check.confidence)) {
      checkChanges.push({
        id,
        outcome: [old.outcome, check.outcome],
        confidence: [old.confidence, check.confidence]
      });
    }
  }

  const beforeTasks = mapById(previous.tasks);
  const afterTasks = mapById(current.tasks);
  const addedTasks = [...afterTasks.keys()].filter((id) => !beforeTasks.has(id));
  const completedTasks = [...afterTasks].filter(([id, task]) => beforeTasks.has(id) && beforeTasks.get(id).status !== 'done' && task.status === 'done').map(([id]) => id);
  const reopenedTasks = [...afterTasks].filter(([id, task]) => beforeTasks.has(id) && beforeTasks.get(id).status === 'done' && task.status === 'open').map(([id]) => id);
  const removedTasks = [...beforeTasks.keys()].filter((id) => !afterTasks.has(id));

  const beforeEvidence = mapById(previous.evidence);
  const evidenceChanges = [];
  for (const [id, evidence] of mapById(current.evidence)) {
    const old = beforeEvidence.get(id);
    if (old && ((old.sha256 || null) !== (evidence.sha256 || null) || old.path !== evidence.path || old.line !== evidence.line)) {
      evidenceChanges.push({
        id,
        sha256: [old.sha256 || null, evidence.sha256 || null],
        location: [old.path ? `${old.path}:${old.line || 1}` : null, evidence.path ? `${evidence.path}:${evidence.line || 1}` : null]
      });
    }
  }

  const previousScore = previous.computed ? previous.computed.overall.score : null;
  const currentScore = current.computed ? current.computed.overall.score : null;
  const previousCoverage = previous.computed ? previous.computed.coverage.percent : null;
  const currentCoverage = current.computed ? current.computed.coverage.percent : null;
  const removed = sorted([...before.keys()].filter((id) => !after.has(id)));
  const violations = [];
  if (previous.audit.name !== current.audit.name) violations.push('audit project names do not match');
  if (current.audit.mode !== 're-audit') violations.push('current audit mode must be re-audit');
  if (current.audit.audit_version <= previous.audit.audit_version) violations.push('current audit_version must be greater than previous audit_version');
  if (removed.length) violations.push(`historical finding ids were removed: ${removed.join(', ')}`);
  if (removedTasks.length) violations.push(`historical task ids were removed: ${sorted([...removedTasks]).join(', ')}`);
  return {
    audit: {
      previous_version: previous.audit.audit_version,
      current_version: current.audit.audit_version,
      previous_commit: previous.audit.commit,
      current_commit: current.audit.commit
    },
    added: sorted(added),
    resolved: sorted(resolved),
    reopened: sorted(reopened),
    status_changes: statusChanges.sort((left, right) => left.id.localeCompare(right.id)),
    changed: changed.sort((left, right) => left.id.localeCompare(right.id)),
    removed,
    check_changes: checkChanges.sort((left, right) => left.id.localeCompare(right.id)),
    tasks: {
      added: sorted(addedTasks),
      completed: sorted(completedTasks),
      reopened: sorted(reopenedTasks),
      removed: sorted(removedTasks)
    },
    evidence_changes: evidenceChanges.sort((left, right) => left.id.localeCompare(right.id)),
    score: movement(previousScore, currentScore),
    coverage: movement(previousCoverage, currentCoverage),
    valid: violations.length === 0,
    violations
  };
}

module.exports = { diffAudits };
