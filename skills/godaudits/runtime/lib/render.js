'use strict';

function yamlString(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value ?? '');
}

function mdxText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\r?\n/g, ' ');
}

function tableText(value) {
  return mdxText(value).replace(/\|/g, '&#124;');
}

function compareWave(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  return a[0] - b[0] || a[1] - b[1];
}

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function compareFinding(left, right) {
  return SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] || left.id.localeCompare(right.id);
}

function inlineCode(value) {
  const text = String(value || '');
  if (text.includes('`') || text.includes('\n')) {
    const runs = text.match(/`+/g) || [];
    const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
    return `\n\n${fence}text\n${text}\n${fence}`;
  }
  return `\`${text}\``;
}

function evidenceSentence(ids, evidence) {
  return ids.map((id) => {
    const item = evidence.get(id);
    if (!item) return `${id} (missing)`;
    const where = item.path ? `${item.path}:${item.line || 1}` : (item.scope || item.type);
    return `${id} ${mdxText(where)}: ${inlineCode(item.quote || item.command)}`;
  }).join('; ');
}

// Plan-aware traceability: A-to-R is a mechanical prefix substitution because
// every mirrored check shares its domain segment with the godplans requirement
// it numbers against (A-ARCH-5 -> R-ARCH-5). The catalog's audit_only flag,
// itself cross-verified against the godplans R-catalog, gates it: an audit-only
// check has no plan requirement, so its finding line carries the A-id alone. No
// R-id is ever asserted for a check the catalog does not vouch for.
function findingChecks(finding, planAware, auditOnly) {
  return finding.checks.map((id) => {
    if (planAware && auditOnly.get(id) === false) return `${id} (${id.replace(/^A-/, 'R-')})`;
    return id;
  }).join(', ');
}

function evidenceProvenance(item) {
  if (item.type === 'tool' || item.type === 'runtime') return `${item.tool} ${item.tool_version}; ${item.command}`;
  if (item.type === 'absence') return item.command;
  if (item.type === 'human') return `recorded by ${item.recorded_by}`;
  return 'source content hash';
}

function renderAudit(audit, options = {}) {
  if (!audit.computed) throw new Error('audit must be compiled before rendering');
  const metadata = audit.audit;
  const computed = audit.computed;
  const evidence = new Map(audit.evidence.map((item) => [item.id, item]));
  const planAware = metadata.plan_aware === true;
  const catalogChecks = (options.catalog && options.catalog.checks) || [];
  const auditOnly = new Map(catalogChecks.map((check) => [check.id, check.audit_only === true]));
  const costTiers = new Map(catalogChecks.map((check) => [check.id, check.cost_tier || 'unlabeled']));
  const domainDefinitions = new Map((((options.catalog && options.catalog.domains) || []).map((domain) => [domain.id, domain])));
  const lines = [];
  lines.push('---');
  lines.push(`name: ${yamlString(metadata.name)}`);
  lines.push(`schema_version: ${yamlString(audit.schema_version)}`);
  lines.push(`audit_version: ${metadata.audit_version}`);
  lines.push(`status: ${metadata.status}`);
  lines.push(`created: ${metadata.created}`);
  lines.push(`updated: ${metadata.updated}`);
  lines.push(`mode: ${metadata.mode}`);
  lines.push(`plan_aware: ${metadata.plan_aware}`);
  lines.push(`commit: ${yamlString(metadata.commit)}`);
  lines.push(`archetype: ${yamlString(metadata.archetype)}`);
  if (metadata.project_form) lines.push(`project_form: ${yamlString(metadata.project_form)}`);
  lines.push(`scale: ${metadata.scale}`);
  lines.push(`risk_profile: ${metadata.risk_profile}`);
  if (metadata.budget) lines.push(`budget: ${yamlString(metadata.budget)}`);
  lines.push(`engine_version: ${yamlString(metadata.engine_version)}`);
  lines.push(`pack_version: ${yamlString(metadata.pack_version)}`);
  lines.push(`overall: ${computed.overall.score}`);
  lines.push(`grade_method: ${yamlString(computed.overall.grade_method)}`);
  lines.push(`grade_scope: ${yamlString(computed.overall.grade_scope)}`);
  lines.push(`verdict: ${yamlString(computed.overall.verdict)}`);
  lines.push(`evidence_basis: ${yamlString(computed.overall.evidence_basis)}`);
  lines.push(`coverage: ${computed.coverage.percent}`);
  lines.push(`findings_total: ${computed.counts.findings_total}`);
  lines.push(`tasks_total: ${computed.counts.tasks_total}`);
  lines.push('---', '');
  lines.push(`# ${mdxText(metadata.name)} audit`, '');
  const biggest = [...audit.findings].filter((finding) => ['open', 'accepted-risk'].includes(finding.status)).sort(compareFinding)[0];
  const strength = audit.strengths[0];
  lines.push(`Static-read grade ${computed.overall.score}/100 (${computed.overall.verdict}): ${computed.overall.grade_scope}. Evidence basis: ${computed.overall.evidence_basis}. ${biggest ? `Biggest risk: ${mdxText(biggest.title)}.` : 'No open findings.'} ${strength ? `Biggest strength: ${mdxText(strength.title)}.` : ''}`.trim(), '');
  lines.push('## Scope and method', '');
  lines.push(`Commit ${mdxText(metadata.commit)}; ${metadata.mode} audit; ${mdxText(metadata.project_form || metadata.archetype)} form at ${metadata.scale} scale; ${metadata.risk_profile} risk profile. Capabilities: ${metadata.capabilities.map(mdxText).join(', ')}.`);
  if (metadata.budget === 'medium') lines.push('Budget: medium. Screening checks are selected for judgment; deep-trace checks remain unknown in the complete ledger and reduce coverage.');
  if (metadata.budget === 'full') lines.push('Budget: full. Screening and deep-trace checks are selected for judgment.');
  if (metadata.secondary_forms && metadata.secondary_forms.length) lines.push(`Secondary forms: ${metadata.secondary_forms.map(mdxText).join(', ')}.`);
  if (metadata.domain_overlays && metadata.domain_overlays.length) lines.push(`Context candidates: ${metadata.domain_overlays.map((item) => `${mdxText(item.axis)}/${mdxText(item.id)} (${item.confidence}${item.requires_verification ? ', verify' : ''})`).join('; ')}.`);
  lines.push(`Assumptions: ${metadata.assumptions.length ? metadata.assumptions.map(mdxText).join('; ') : 'none'}.`);
  lines.push('The audit made no source edits, ran no application code, connected to no live systems, and called no models unless an explicitly listed capability states otherwise.', '');
  lines.push(`Coverage: ${computed.coverage.evaluated} of ${computed.coverage.applicable} applicable checks evaluated (${computed.coverage.percent}%). Unknown checks never earn points and cap the verdict.`, '');
  lines.push('## Compliance gate', '');
  lines.push(`Result: ${audit.compliance.result}. Screened ${audit.compliance.screened} with ${mdxText(audit.compliance.policy_pack)}. This is a policy-allowability screen, not a legal-compliance determination.`, '');
  lines.push('## Applicability matrix', '');
  lines.push('| Domain | Status | Reason |', '|---|---|---|');
  for (const domain of audit.domains) lines.push(`| ${domain.id} | ${domain.status} | ${tableText(domain.reason || 'Checks evaluated below')} |`);
  lines.push('', '## Scorecard', '');
  lines.push('| Domain | Depth | Score | Cap | Evaluated | Evidence basis |', '|---|---|---:|---|---:|---|');
  for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
    const score = computed.domains[domain.id];
    const evaluated = domain.checks.filter((check) => ['pass', 'fail'].includes(check.outcome)).length;
    const definition = domainDefinitions.get(domain.id);
    lines.push(`| ${domain.id} | ${definition ? definition.depth_grade : 'unlabeled'} | ${score.score} | ${score.cap || 'none'} | ${evaluated}/${domain.checks.filter((check) => check.outcome !== 'not-applicable').length} | ${score.evidence_basis} |`);
  }
  lines.push(`| Overall | mixed | ${computed.overall.score} | coverage ${computed.overall.coverage_cap}; critical ${computed.overall.critical_cap}; weak-domain ${computed.overall.weak_domain_cap} | ${computed.coverage.evaluated}/${computed.coverage.applicable} | ${computed.overall.evidence_basis} |`, '');
  lines.push(`Every score above is ${computed.overall.grade_scope}. Confidence is the auditor's own, so the evidence basis states what the grade rests on, not how often such a grade proves right.`, '');
  if (domainDefinitions.size) {
    lines.push('## Depth and escalation', '');
    lines.push('Security and build completeness are deep-capable. Every other domain is screening-grade. A domain label describes this audit method, not the importance of the domain. Scanner and inventory signals remain leads until traced and refuted.', '');
    lines.push('| Domain | Label | Deep-trace state | Escalation criterion | Up to three current finding leads |', '|---|---|---|---|---|');
    for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
      const definition = domainDefinitions.get(domain.id);
      const unknownDeep = domain.checks.filter((check) => costTiers.get(check.id) === 'deep-trace' && check.outcome === 'unknown');
      const activeFindings = audit.findings
        .filter((finding) => finding.domain === domain.id && ['open', 'accepted-risk'].includes(finding.status))
        .sort(compareFinding)
        .slice(0, 3)
        .map((finding) => finding.id);
      const deepState = unknownDeep.length ? `${unknownDeep.length} unknown` : 'none unknown';
      lines.push(`| ${domain.id} | ${definition ? definition.depth_grade : 'unlabeled'} | ${deepState} | ${tableText(definition ? definition.escalation : 'No catalog criterion recorded.')} | ${activeFindings.join(', ') || 'none'} |`);
    }
    lines.push('');
  }
  if (audit.standards) {
    lines.push('## Standards coverage', '');
    lines.push('Control-evidence readiness, not certification. These frameworks evidence the technical controls a code audit can see (encryption, access control, consent code, DSAR paths, audit logging, accessible markup). They do not evidence the organizational and process controls (policies, training, vendor management, incident response, physical security) that SOC 2, ISO/IEC 27001, or PCI certification require. A category below reports control-evidence readiness and never claims certification.', '');
    lines.push('| Framework | Category | Control-evidence readiness | Checks | Evidence | Findings |', '|---|---|---|---|---|---|');
    for (const result of audit.standards) {
      lines.push(`| ${tableText(result.framework)} | ${tableText(`${result.category} ${result.title}`)} | ${result.status} | ${result.checks.join(', ')} | ${result.evidence.join(', ') || 'none'} | ${result.finding_ids.join(', ') || 'none'} |`);
    }
    lines.push('');
  }
  lines.push('## Check ledger', '');
  lines.push('| Check | Cost tier | Outcome | Confidence | Weight | Evidence |', '|---|---|---|---|---:|---|');
  for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
    for (const check of domain.checks) {
      lines.push(`| ${check.id} | ${costTiers.get(check.id) || 'unlabeled'} | ${check.outcome} | ${check.confidence} | ${check.weight} | ${(check.evidence || []).join(', ')} |`);
    }
  }
  lines.push('', '## Evidence ledger', '');
  lines.push('| Evidence | Type | Location or scope | Provenance | Quote or result | SHA-256 | Redacted |', '|---|---|---|---|---|---|---|');
  for (const item of audit.evidence) {
    const location = item.path ? `${item.path}:${item.line || 1}` : (item.scope || 'none');
    lines.push(`| ${item.id} | ${item.type} | ${tableText(location)} | ${tableText(evidenceProvenance(item))} | ${tableText(item.quote || item.command)} | ${item.sha256 || 'none'} | ${item.redacted ? 'yes' : 'no'} |`);
  }
  lines.push('', '## Strengths', '');
  if (!audit.strengths.length) lines.push('No evidence-backed strengths were recorded.', '');
  for (const item of audit.strengths) {
    lines.push(`- ${mdxText(item.title)}. ${evidenceSentence(item.evidence, evidence)} Preserve: ${mdxText(item.preserve)}`, '');
  }
  lines.push('## Findings', '');
  for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
    lines.push(`### ${domain.id}`, '');
    const findings = audit.findings.filter((finding) => finding.domain === domain.id).sort(compareFinding);
    if (!findings.length) {
      lines.push(`No findings. ${domain.checks.length} checks were recorded in the ledger.`, '');
      continue;
    }
    for (const finding of findings) {
      const first = evidence.get(finding.evidence[0]);
      lines.push(`#### ${finding.id} ${mdxText(finding.title)} [${finding.severity} | ${finding.confidence} | ${finding.effort}]`, '');
      lines.push(`- Where: ${first && first.path ? mdxText(`${first.path}:${first.line}`) : 'see evidence ledger'}`);
      lines.push(`- Evidence: ${evidenceSentence(finding.evidence, evidence)}`);
      lines.push(`- Impact: ${mdxText(finding.impact)}`);
      lines.push(`- Fix: ${mdxText(finding.fix)}`);
      lines.push(`- Verify the fix: ${inlineCode(finding.verify)}`);
      lines.push(`- Checks: ${findingChecks(finding, planAware, auditOnly)}`);
      lines.push(`- Status: ${finding.status}`);
      lines.push(`- Remediation: ${(finding.remediation || []).join(', ') || 'none'}`, '');
    }
  }
  lines.push('## Remediation plan', '');
  const phases = [...new Set(audit.tasks.map((task) => task.phase))].sort((a, b) => a - b);
  for (const phase of phases) {
    const phaseTasks = audit.tasks.filter((task) => task.phase === phase);
    lines.push(`## Phase ${phase}: ${phaseTasks.some((task) => task.final_gate) ? 'Re-audit' : phase === 1 ? 'Stop the bleeding' : 'Remediation'}`, '');
    for (const wave of [...new Set(phaseTasks.map((task) => task.wave))].sort(compareWave)) {
      lines.push(`### Wave ${wave}`, '');
      for (const task of phaseTasks.filter((item) => item.wave === wave).sort((left, right) => left.id.localeCompare(right.id))) {
        const box = task.status === 'done' ? 'x' : ' ';
        lines.push(`- [${box}] ${task.id} [W${task.wave}]${task.parallel ? ' [P]' : ''} ${mdxText(task.title)}`);
        lines.push(`  - Files: ${task.files.length ? task.files.map(mdxText).join(', ') : 'none'}`);
        lines.push(`  - Depends on: ${task.depends_on.length ? task.depends_on.join(', ') : 'none'}`);
        lines.push(`  - Reuses: ${mdxText(task.reuses)}`);
        lines.push(`  - Fixes: ${task.fixes.length ? task.fixes.join(', ') : 'none (final gate)'}`);
        lines.push(`  - Acceptance: ${task.acceptance.map(mdxText).join('; ')}`);
        lines.push(`  - Verify: ${inlineCode(task.verify)}`);
        lines.push(`  - Checks: ${task.checks.length ? task.checks.join(', ') : 'none'}`, '');
      }
    }
  }
  lines.push('## Accepted risks and open questions', '');
  if (!audit.accepted_risks.length && !audit.open_questions.length) lines.push('None.', '');
  for (const risk of audit.accepted_risks) lines.push(`- Accepted risk ${risk.finding}: ${mdxText(risk.summary)}; owner ${mdxText(risk.owner)}; accepted ${risk.accepted_on}; expires ${risk.expires}; review ${inlineCode(risk.review)}.`);
  for (const question of audit.open_questions) lines.push(`- Open question: ${mdxText(question.question)}; owner ${mdxText(question.owner)}; due ${question.due}; default ${mdxText(question.default)}.`);
  lines.push('', '## Rules for remediating agents', '');
  lines.push('> [!IMPORTANT]');
  lines.push('> AUDIT.json is the machine source of truth. AUDIT.mdx is a generated view.');
  lines.push('> Run the task Verify command before changing task or finding state, then compile and validate both artifacts.');
  lines.push('> Never renumber findings or completed tasks. Finish with the final re-audit gate.', '');
  lines.push('## Session log', '');
  for (const entry of audit.session_log) lines.push(`- ${entry.date} ${mdxText(entry.summary)}`);
  lines.push('');
  return lines.join('\n');
}

module.exports = { inlineCode, mdxText, renderAudit };
