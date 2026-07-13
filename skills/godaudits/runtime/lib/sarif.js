'use strict';

const LEVEL = { Critical: 'error', High: 'error', Medium: 'warning', Low: 'note' };

function auditToSarif(audit) {
  const evidence = new Map((audit.evidence || []).map((item) => [item.id, item]));
  const acceptedRisks = new Map((audit.accepted_risks || []).map((risk) => [risk.finding, risk]));
  const rules = new Map();
  const results = [];
  for (const finding of (audit.findings || []).filter((item) => ['open', 'accepted-risk'].includes(item.status))) {
    for (const check of finding.checks || []) {
      if (!rules.has(check)) {
        rules.set(check, {
          id: check,
          name: check,
          shortDescription: { text: `godaudits check ${check}` },
          helpUri: `https://github.com/hannsxpeter/godaudits/search?q=${encodeURIComponent(check)}`
        });
      }
    }
    const primary = (finding.evidence || []).map((id) => evidence.get(id)).find((item) => item && item.path);
    const result = {
      ruleId: finding.checks[0],
      level: LEVEL[finding.severity],
      message: { text: `${finding.id}: ${finding.title}. ${finding.impact}` },
      properties: {
        finding_id: finding.id,
        severity: finding.severity,
        confidence: finding.confidence,
        effort: finding.effort,
        status: finding.status,
        checks: finding.checks,
        remediation: finding.remediation
      }
    };
    if (primary) {
      result.locations = [{
        physicalLocation: {
          artifactLocation: { uri: primary.path },
          region: { startLine: primary.line || 1 }
        }
      }];
    }
    if (finding.status === 'accepted-risk') {
      const risk = acceptedRisks.get(finding.id);
      result.suppressions = [{
        kind: 'external',
        status: 'accepted',
        justification: risk ? `${risk.summary}; owner ${risk.owner}; expires ${risk.expires}` : 'Accepted risk recorded in AUDIT.json.'
      }];
    }
    results.push(result);
  }
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'godaudits',
          version: audit.audit.engine_version,
          informationUri: 'https://github.com/hannsxpeter/godaudits',
          rules: [...rules.values()]
        }
      },
      automationDetails: { id: `${audit.audit.name}/${audit.audit.commit}` },
      results
    }]
  };
}

module.exports = { auditToSarif };
