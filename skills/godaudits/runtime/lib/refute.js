'use strict';

// The generator and critic must be different acts, not the same context asked to
// second-guess itself. Phase 4 already asks each finding to be disproved, but by
// the reasoning that produced it. This module serializes that step to disk: it
// emits a refutation brief per open Critical or High finding, stripped of the
// originating reasoning so an independent pass forms its own view, then folds the
// returned verdicts into a disposition report. It stays static and never mutates
// AUDIT.json; a re-audit or the remediating agent applies the dispositions.
//
// This is not a second evidence path. A refutation either cites a guard (in
// which case the finding drops and there is nothing to corroborate) or returns
// no-refutation (no citation at all). A refuted finding's guard citation may back
// a STRENGTH or the owning check's pass, never the refuted finding itself.

const DISPOSITIONS = new Set(['refuted', 'weakened', 'no-refutation']);

// Only source evidence carries a location a refuter can go read; other evidence
// types (absence, tool, runtime, human) are not a code citation to re-examine.
function sourceCitations(finding, evidenceById) {
  return (finding.evidence || [])
    .map((id) => evidenceById.get(id))
    .filter((item) => item && item.type === 'source')
    .map((item) => ({ path: item.path, line: item.line, quote: item.quote, sha256: item.sha256 }));
}

// Read-only: build the refutation handoff from an AUDIT.json object. One brief
// per open Critical or High finding. The brief carries the claim, the citation,
// the owning check, and the behavior the finding says is missing, and nothing
// else: no impact narrative, no root-cause reasoning, so the refuter cannot
// anchor on the auditor's account and must read the code fresh.
function planRefutations(audit) {
  const evidenceById = new Map((audit.evidence || []).map((item) => [item.id, item]));
  const findings = (audit.findings || [])
    .filter((finding) => finding.status === 'open' && ['Critical', 'High'].includes(finding.severity));
  return {
    schema_version: '1.0',
    generated_from: 'AUDIT.json',
    commit: audit.audit && audit.audit.commit,
    note: 'Independent refutation handoff. For each brief, try to DISPROVE the claim by reading the cited code fresh, without the audit\'s reasoning. Return one verdict per brief: refuted (a guard makes the defect unreachable), weakened (the claim holds but narrower than stated), or no-refutation (the claim stands). Cite a guard path and line only when refuting or weakening. Feed the verdicts back with `godaudits refute apply`. This does not add evidence to any finding.',
    briefs: findings.map((finding) => ({
      finding: finding.id,
      claim: finding.title,
      severity: finding.severity,
      checks: finding.checks || [],
      expected_behavior: finding.fix || null,
      citations: sourceCitations(finding, evidenceById)
    }))
  };
}

// Read-only: fold refutation verdicts into a disposition report. Never mutates
// AUDIT.json (its scores are compiled). A guard citation is recorded against the
// disposition, explicitly not attached to the finding's evidence, because a
// refutation is not corroboration of the finding it refutes.
function applyRefutations(audit, results) {
  const list = Array.isArray(results) ? results : (results.results || []);
  const byId = new Map((audit.findings || []).map((finding) => [finding.id, finding]));
  const dispositions = [];
  for (const result of list) {
    const finding = byId.get(result.finding);
    if (!finding) continue;
    const disposition = DISPOSITIONS.has(result.outcome) ? result.outcome : 'no-refutation';
    const guard = (disposition !== 'no-refutation' && result.guard && result.guard.path)
      ? { path: result.guard.path, line: result.guard.line || null, quote: result.guard.quote || null }
      : null;
    dispositions.push({
      finding: finding.id,
      claim: finding.title,
      was_severity: finding.severity,
      disposition,
      guard,
      // Where the guard citation is allowed to land. Never the refuted finding.
      guard_supports: guard ? (disposition === 'refuted' ? 'strength-or-check-pass' : 'narrowed-finding') : null,
      rationale: result.note || null
    });
  }
  return {
    schema_version: '1.0',
    generated_from: 'RESULTS.json',
    note: 'Refutation dispositions. refuted marks the finding for removal on the next re-audit; weakened flags the claim for a narrower restatement and a possible severity revision; no-refutation leaves it standing. A guard cited by a refuted verdict may support a strength or the owning check\'s pass on re-audit, never the finding it refuted. This report adds no evidence to AUDIT.json; apply it in a re-audit rather than hand-editing.',
    dispositions
  };
}

module.exports = { planRefutations, applyRefutations, DISPOSITIONS };
