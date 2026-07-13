'use strict';

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 1;
}

function validEvidence(item) {
  if (!item || !item.quote) return false;
  if (item.type === 'source') return item.path && Number.isInteger(item.line) && item.line > 0 && /^[a-f0-9]{64}$/.test(item.sha256 || '');
  if (item.type === 'absence') return item.scope && item.command;
  if (item.type === 'tool' || item.type === 'runtime') return item.command && item.tool && item.tool_version;
  return item.type === 'human' && item.recorded_by;
}

function validateExpected(expected) {
  if (!expected || !Array.isArray(expected.required_findings) || !Array.isArray(expected.clean_checks)) {
    throw new Error('expected benchmark must contain required_findings and clean_checks arrays');
  }
  const keys = expected.required_findings.map((item) => `${item.check}\u0000${item.path || ''}`);
  if (new Set(keys).size !== keys.length) throw new Error('required_findings contains a duplicate check and path pair');
  if (new Set(expected.clean_checks).size !== expected.clean_checks.length) throw new Error('clean_checks must be unique');
  for (const item of expected.required_findings) {
    if (!/^A-[A-Z]+-\d+$/.test(item.check || '') || !['Critical', 'High', 'Medium', 'Low'].includes(item.severity) || typeof item.path !== 'string') {
      throw new Error('each required finding needs a valid check, severity, and path');
    }
  }
}

function evaluateAudit(audit, expected) {
  validateExpected(expected);
  const required = expected.required_findings || [];
  const evidence = new Map((audit.evidence || []).map((item) => [item.id, item]));
  const tasks = audit.tasks || [];
  const activeFindings = (audit.findings || []).filter((finding) => ['open', 'accepted-risk'].includes(finding.status));
  const matches = required.map((item) => {
    const candidates = activeFindings.filter((candidate) => (candidate.checks || []).includes(item.check));
    const finding = candidates.find((candidate) => {
      if (!item.path) return true;
      return (candidate.evidence || []).map((id) => evidence.get(id)).filter(Boolean).some((entry) => entry.path === item.path);
    }) || null;
    return { expected: item, finding };
  });
  const matchedFindingIds = new Set(matches.filter((match) => match.finding).map((match) => match.finding.id));
  const truePositive = matches.filter((match) => match.finding).length;
  const severityCorrect = matches.filter((match) => match.finding && match.finding.severity === match.expected.severity).length;
  const citationValid = activeFindings.filter((finding) =>
    (finding.evidence || []).length > 0 && finding.evidence.every((id) => validEvidence(evidence.get(id)))
  ).length;
  const closure = activeFindings.filter((finding) =>
    !['Critical', 'High'].includes(finding.severity)
      || tasks.some((task) => task.status !== 'superseded' && (task.fixes || []).includes(finding.id))
  ).length;
  const cleanChecks = new Set(expected.clean_checks || []);
  const violatedCleanChecks = new Set();
  for (const finding of activeFindings) {
    for (const check of finding.checks || []) if (cleanChecks.has(check)) violatedCleanChecks.add(check);
  }
  const metrics = {
    recall: ratio(truePositive, required.length),
    precision: ratio(matchedFindingIds.size, activeFindings.length),
    severity_accuracy: ratio(severityCorrect, required.length),
    citation_validity: ratio(citationValid, activeFindings.length),
    remediation_closure: ratio(closure, activeFindings.length),
    clean_control_rate: ratio(cleanChecks.size - violatedCleanChecks.size, cleanChecks.size),
    expected_findings: required.length,
    detected_findings: truePositive,
    active_findings: activeFindings.length,
    false_positives: Math.max(0, activeFindings.length - matchedFindingIds.size),
    missed: matches.filter((match) => !match.finding).map((match) => match.expected)
  };
  metrics.passed = metrics.recall >= 0.95
    && metrics.precision >= 0.95
    && metrics.severity_accuracy >= 0.9
    && metrics.citation_validity === 1
    && metrics.remediation_closure === 1
    && metrics.clean_control_rate >= 0.95;
  return metrics;
}

module.exports = { evaluateAudit, validateExpected, validEvidence };
