'use strict';

// Dynamic verification closes the static ceiling: godaudits can suspect a
// behavioral defect (a race, a dead control, an early state transition, an authz
// gap on a non-primary path) but not prove it without running the app. This
// module turns those findings into a runtime-probe handoff and folds executed
// results back as a verification report. Execution itself is delegated to an
// authorized harness (Godpowers god-browser-tester or a project Playwright
// suite); this stays static and never runs the app or the network.

// Behavioral check ids: findings citing these are candidates for runtime proof.
// The catalog owns the verifiability axis; importing it keeps one source of
// truth and fails the catalog build if an id here stops existing.
const { BEHAVIORAL_CHECKS } = require('./catalog');

const CONFIDENCE_UP = { Tentative: 'Firm', Firm: 'Certain', Certain: 'Certain' };

function isBehavioral(finding) {
  if (finding.runtime_probe) return true;
  return (finding.checks || []).some((id) => BEHAVIORAL_CHECKS.has(id));
}

// Read-only: build the probe handoff from an AUDIT.json object.
function planProbes(audit) {
  const findings = (audit.findings || [])
    .filter((finding) => ['open', 'accepted-risk'].includes(finding.status) && isBehavioral(finding));
  return {
    schema_version: '1.0',
    generated_from: 'AUDIT.json',
    commit: audit.audit && audit.audit.commit,
    note: 'Runtime verification handoff for behavioral findings. Execute each probe against an AUTHORIZED non-production runtime (Godpowers god-browser-tester or a project Playwright suite), then feed a results file back with `godaudits verify-runtime apply`. Never run against production.',
    probes: findings.map((finding) => ({
      finding: finding.id,
      title: finding.title,
      severity: finding.severity,
      confidence: finding.confidence,
      checks: finding.checks || [],
      probe: finding.runtime_probe || {
        steps: finding.verify || null,
        expected_defect: finding.impact || null,
        fix_if_confirmed: finding.fix || null
      }
    }))
  };
}

// Read-only: fold executed results into a verification report. Does not mutate
// AUDIT.json (its scores are compiled, never hand-edited); a re-audit or the
// remediating agent applies these dispositions.
function applyResults(audit, results) {
  const list = Array.isArray(results) ? results : (results.results || []);
  const byId = new Map((audit.findings || []).map((finding) => [finding.id, finding]));
  const dispositions = [];
  for (const result of list) {
    const finding = byId.get(result.finding);
    if (!finding) continue;
    const outcome = result.outcome;
    const runtimeEvidence = {
      type: 'runtime',
      tool: result.tool || 'god-browser-tester',
      tool_version: result.tool_version || 'runtime',
      command: result.command || 'runtime probe',
      result: result.observed || outcome,
      provenance: 'runtime'
    };
    let confidence = finding.confidence;
    let disposition = 'unchanged';
    if (outcome === 'confirmed') {
      confidence = CONFIDENCE_UP[finding.confidence] || finding.confidence;
      disposition = 'confirmed-at-runtime';
    } else if (outcome === 'refuted') {
      disposition = 'refuted-at-runtime';
    }
    dispositions.push({
      finding: finding.id,
      title: finding.title,
      was_confidence: finding.confidence,
      now_confidence: confidence,
      disposition,
      runtime_evidence: runtimeEvidence
    });
  }
  return {
    schema_version: '1.0',
    generated_from: 'RESULTS.json',
    note: 'Runtime verification dispositions. confirmed-at-runtime raises confidence; refuted-at-runtime marks the finding for removal on the next re-audit. AUDIT.json scores are compiled, so apply these in a re-audit rather than hand-editing.',
    dispositions
  };
}

module.exports = { planProbes, applyResults, isBehavioral, BEHAVIORAL_CHECKS };
