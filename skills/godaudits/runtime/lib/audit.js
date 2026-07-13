'use strict';

const { redactSecrets } = require('./evidence');

const DOMAIN_WEIGHTS = {
  security: 15,
  'code-quality': 10,
  build: 10,
  database: 8,
  architecture: 8,
  product: 7,
  ux: 7,
  llm: 6,
  deploy: 6,
  observe: 5,
  repo: 5,
  stack: 4,
  ui: 4,
  roadmap: 4,
  seo: 3,
  launch: 3,
  'style-genome': 3,
  'agent-memory': 2
};

const ALLOWED = {
  status: new Set(['reported', 'remediating', 'resolved']),
  mode: new Set(['fresh', 're-audit']),
  domainStatus: new Set(['applicable', 'excluded']),
  outcome: new Set(['pass', 'fail', 'unknown', 'not-applicable']),
  severity: new Set(['Critical', 'High', 'Medium', 'Low']),
  confidence: new Set(['Certain', 'Firm', 'Tentative']),
  effort: new Set(['S', 'M', 'L']),
  findingStatus: new Set(['open', 'resolved', 'accepted-risk', 'superseded']),
  taskStatus: new Set(['open', 'done', 'superseded'])
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function duplicates(values) {
  return [...new Set((values || []).filter((value, index, all) => all.indexOf(value) !== index))];
}

function waveValue(wave) {
  const [phase, sequence] = String(wave || '').split('.').map(Number);
  return phase * 1000000 + sequence;
}

function isActiveRisk(finding) {
  return ['open', 'accepted-risk'].includes(finding.status);
}

function validateAudit(audit, options = {}) {
  const errors = [];
  const requiredArrays = ['domains', 'evidence', 'strengths', 'findings', 'tasks', 'accepted_risks', 'open_questions', 'session_log'];

  if (!audit || typeof audit !== 'object') return ['audit must be an object'];
  if (audit.schema_version !== '2.0') errors.push('schema_version must be 2.0');
  if (!audit.audit || typeof audit.audit !== 'object') errors.push('audit metadata is required');
  for (const field of requiredArrays) {
    if (!Array.isArray(audit[field])) errors.push(`${field} must be an array`);
  }
  if (errors.length) return errors;

  const metadata = audit.audit;
  for (const field of ['name', 'commit', 'archetype', 'scale', 'engine_version', 'pack_version']) {
    if (!metadata[field]) errors.push(`audit.${field} is required`);
  }
  if (!Number.isInteger(metadata.audit_version) || metadata.audit_version < 1) errors.push('audit.audit_version must be a positive integer');
  if (typeof metadata.plan_aware !== 'boolean') errors.push('audit.plan_aware must be a boolean');
  if (!Array.isArray(metadata.assumptions)) errors.push('audit.assumptions must be an array');
  else if (duplicates(metadata.assumptions).length) errors.push('audit.assumptions must be unique');
  if (!ALLOWED.status.has(metadata.status)) errors.push(`invalid audit status: ${metadata.status}`);
  if (!ALLOWED.mode.has(metadata.mode)) errors.push(`invalid audit mode: ${metadata.mode}`);
  if (!['weekend', 'side-project', 'funded-product', 'enterprise'].includes(metadata.scale)) errors.push(`invalid audit scale: ${metadata.scale}`);
  if (!isDate(metadata.created) || !isDate(metadata.updated)) errors.push('audit created and updated must be YYYY-MM-DD');
  else if (metadata.updated < metadata.created) errors.push('audit.updated cannot be before audit.created');
  if (!Array.isArray(metadata.capabilities) || metadata.capabilities.length === 0) errors.push('audit.capabilities must be a non-empty array');
  if (duplicates(metadata.capabilities).length) errors.push('audit.capabilities must be unique');
  for (const capability of metadata.capabilities || []) {
    if (!['static', 'sandbox', 'connected'].includes(capability)) errors.push(`invalid audit capability: ${capability}`);
  }
  if (!metadata.risk_profile) errors.push('audit.risk_profile is required');
  const profileWeights = options.catalog && options.catalog.profiles[metadata.risk_profile]
    ? options.catalog.profiles[metadata.risk_profile].weights
    : DOMAIN_WEIGHTS;
  if (options.catalog && !options.catalog.profiles[metadata.risk_profile]) errors.push(`unknown risk profile: ${metadata.risk_profile}`);

  if (!audit.compliance || typeof audit.compliance !== 'object') errors.push('compliance metadata is required');
  else {
    if (!['pass', 'findings-injected', 'unknown'].includes(audit.compliance.result)) errors.push('compliance.result must be pass, findings-injected, or unknown');
    if (!isDate(audit.compliance.screened)) errors.push('compliance.screened must be YYYY-MM-DD');
    else if (isDate(metadata.updated) && audit.compliance.screened > metadata.updated) errors.push('compliance.screened cannot be after audit.updated');
    if (!audit.compliance.policy_pack) errors.push('compliance.policy_pack is required');
  }

  const evidenceIds = new Set();
  const evidenceById = new Map();
  for (const evidence of audit.evidence) {
    if (!/^E-\d+$/.test(evidence.id || '')) errors.push(`invalid evidence id: ${evidence.id}`);
    if (evidenceIds.has(evidence.id)) errors.push(`duplicate evidence id: ${evidence.id}`);
    evidenceIds.add(evidence.id);
    evidenceById.set(evidence.id, evidence);
    if (!['source', 'absence', 'tool', 'runtime', 'human'].includes(evidence.type)) errors.push(`${evidence.id} has invalid evidence type`);
    if (typeof evidence.redacted !== 'boolean') errors.push(`${evidence.id}.redacted must be a boolean`);
    if (evidence.type === 'source' && (!evidence.path || !Number.isInteger(evidence.line) || evidence.line < 1 || !evidence.quote || !evidence.sha256)) {
      errors.push(`${evidence.id} source evidence requires path, positive line, quote, and sha256`);
    }
    if (evidence.type === 'absence' && (!evidence.scope || !evidence.command || !evidence.quote)) {
      errors.push(`${evidence.id} absence evidence requires scope, command, and quote`);
    }
    if (['tool', 'runtime'].includes(evidence.type) && (!evidence.tool || !evidence.tool_version || !evidence.command || !evidence.quote)) {
      errors.push(`${evidence.id} ${evidence.type} evidence requires tool, tool_version, command, and quote`);
    }
    if (evidence.type === 'human' && (!evidence.recorded_by || !evidence.quote)) {
      errors.push(`${evidence.id} human evidence requires recorded_by and quote`);
    }
    if (!evidence.quote && !evidence.command) errors.push(`${evidence.id} requires quote or command`);
    if (evidence.sha256 && !/^[a-f0-9]{64}$/.test(evidence.sha256)) errors.push(`${evidence.id} has invalid sha256`);
    if (evidence.sensitive && !evidence.redacted) errors.push(`${evidence.id} sensitive evidence must be redacted`);
  }

  const checkIds = new Set();
  const domainIds = new Set();
  for (const domain of audit.domains) {
    if (!profileWeights[domain.id]) errors.push(`unknown domain: ${domain.id}`);
    if (domainIds.has(domain.id)) errors.push(`duplicate domain: ${domain.id}`);
    domainIds.add(domain.id);
    if (!ALLOWED.domainStatus.has(domain.status)) errors.push(`${domain.id} has invalid status`);
    if (domain.status === 'excluded' && !domain.reason) errors.push(`${domain.id} exclusion requires a reason`);
    if (domain.weight !== profileWeights[domain.id]) errors.push(`${domain.id} weight must be ${profileWeights[domain.id]} for ${metadata.risk_profile}`);
    if (!Array.isArray(domain.checks)) errors.push(`${domain.id}.checks must be an array`);
    if (domain.status === 'excluded' && domain.checks.length) errors.push(`${domain.id} is excluded but has checks`);
    let weight = 0;
    for (const check of domain.checks) {
      if (!/^A-[A-Z]+-\d+$/.test(check.id || '')) errors.push(`invalid check id: ${check.id}`);
      if (checkIds.has(check.id)) errors.push(`duplicate check outcome: ${check.id}`);
      checkIds.add(check.id);
      if (!ALLOWED.outcome.has(check.outcome)) errors.push(`${check.id} has invalid outcome`);
      if (!ALLOWED.confidence.has(check.confidence)) errors.push(`${check.id} has invalid confidence`);
      if (typeof check.weight !== 'number' || check.weight < 0) errors.push(`${check.id} has invalid weight`);
      if (check.outcome !== 'not-applicable') weight += check.weight || 0;
      if (!Array.isArray(check.evidence) || (['pass', 'fail'].includes(check.outcome) && check.evidence.length === 0)) {
        errors.push(`${check.id} requires evidence`);
      }
      if (check.outcome === 'not-applicable' && (!check.evidence || check.evidence.length === 0)) errors.push(`${check.id} not-applicable outcome requires evidence`);
      if (duplicates(check.evidence).length) errors.push(`${check.id}.evidence must be unique`);
      for (const id of check.evidence || []) {
        if (!evidenceIds.has(id)) errors.push(`${check.id} references missing evidence ${id}`);
      }
      if (!Array.isArray(check.finding_ids)) errors.push(`${check.id}.finding_ids must be an array`);
      if (duplicates(check.finding_ids).length) errors.push(`${check.id}.finding_ids must be unique`);
      if (check.outcome === 'fail' && (!check.finding_ids || check.finding_ids.length === 0)) errors.push(`${check.id} fails without a finding`);
      if (check.outcome === 'pass' && check.finding_ids && check.finding_ids.length) errors.push(`${check.id} passes but references findings`);
    }
    if (!options.catalog && domain.status === 'applicable' && domain.checks.length && Math.abs(weight - 100) > 0.01) {
      errors.push(`${domain.id} check weights must sum to 100, got ${weight}`);
    }
  }
  if (!audit.domains.some((domain) => domain.status === 'applicable')) errors.push('at least one domain must be applicable');

  const findingIds = new Set();
  const checksById = new Map(audit.domains.flatMap((domain) => domain.checks).map((check) => [check.id, check]));
  for (const finding of audit.findings) {
    if (!/^F-[A-Z]+-\d+$/.test(finding.id || '')) errors.push(`invalid finding id: ${finding.id}`);
    if (findingIds.has(finding.id)) errors.push(`duplicate finding id: ${finding.id}`);
    findingIds.add(finding.id);
    if (!domainIds.has(finding.domain)) errors.push(`${finding.id} references missing domain ${finding.domain}`);
    if (!ALLOWED.severity.has(finding.severity)) errors.push(`${finding.id} has invalid severity`);
    if (!ALLOWED.confidence.has(finding.confidence)) errors.push(`${finding.id} has invalid confidence`);
    if (!ALLOWED.effort.has(finding.effort)) errors.push(`${finding.id} has invalid effort`);
    if (!ALLOWED.findingStatus.has(finding.status)) errors.push(`${finding.id} has invalid status`);
    for (const field of ['title', 'impact', 'fix', 'verify']) {
      if (!finding[field]) errors.push(`${finding.id}.${field} is required`);
    }
    if (!Array.isArray(finding.checks) || finding.checks.length === 0) errors.push(`${finding.id} requires checks`);
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) errors.push(`${finding.id} requires evidence`);
    if (!Array.isArray(finding.remediation)) errors.push(`${finding.id}.remediation must be an array`);
    if (duplicates(finding.checks).length) errors.push(`${finding.id}.checks must be unique`);
    if (duplicates(finding.evidence).length) errors.push(`${finding.id}.evidence must be unique`);
    if (duplicates(finding.remediation).length) errors.push(`${finding.id}.remediation must be unique`);
    for (const id of finding.checks || []) {
      if (!checkIds.has(id)) errors.push(`${finding.id} references missing check ${id}`);
      else {
        const check = checksById.get(id);
        if (['open', 'accepted-risk'].includes(finding.status) && check.outcome !== 'fail') errors.push(`${finding.id} references ${id}, but its outcome is not fail`);
        if (['open', 'accepted-risk'].includes(finding.status) && !(check.finding_ids || []).includes(finding.id)) {
          errors.push(`${finding.id} and ${id} finding links are not reciprocal`);
        }
      }
    }
    for (const id of finding.evidence || []) {
      if (!evidenceIds.has(id)) errors.push(`${finding.id} references missing evidence ${id}`);
    }
    if (['open', 'accepted-risk'].includes(finding.status) && ['Critical', 'High'].includes(finding.severity) && finding.confidence === 'Certain') {
      const methods = new Set((finding.evidence || []).map((id) => {
        const evidence = evidenceById.get(id) || {};
        if (evidence.type === 'source') return `source:${evidence.path || ''}`;
        if (evidence.type === 'human') return `human:${evidence.recorded_by || ''}`;
        return `${evidence.type || 'missing'}:${evidence.tool || ''}:${evidence.scope || ''}:${evidence.command || ''}`;
      }));
      if ((finding.evidence || []).length < 2 || methods.size < 2) {
        errors.push(`${finding.id} is Certain ${finding.severity} and requires two independent evidence paths`);
      }
    }
  }

  for (const check of checksById.values()) {
    for (const id of check.finding_ids || []) {
      if (!findingIds.has(id)) errors.push(`${check.id} references missing finding ${id}`);
      else {
        const finding = audit.findings.find((item) => item.id === id);
        if (!(finding.checks || []).includes(check.id)) errors.push(`${check.id} and ${id} finding links are not reciprocal`);
        if (check.outcome === 'fail' && !['open', 'accepted-risk'].includes(finding.status)) errors.push(`${check.id} fails but ${id} is ${finding.status}`);
      }
    }
  }

  const taskIds = new Set();
  for (const task of audit.tasks) {
    if (!/^GA-\d{3,}$/.test(task.id || '')) errors.push(`invalid task id: ${task.id}`);
    if (taskIds.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    taskIds.add(task.id);
    if (!Number.isInteger(task.phase) || task.phase < 1) errors.push(`${task.id} has invalid phase`);
    if (!/^\d+\.\d+$/.test(task.wave || '')) errors.push(`${task.id} has invalid wave`);
    else if (Number(task.wave.split('.')[0]) !== task.phase) errors.push(`${task.id} wave must start with phase ${task.phase}`);
    if (!ALLOWED.taskStatus.has(task.status)) errors.push(`${task.id} has invalid status`);
    if (typeof task.parallel !== 'boolean') errors.push(`${task.id}.parallel must be a boolean`);
    if (task.final_gate !== undefined && typeof task.final_gate !== 'boolean') errors.push(`${task.id}.final_gate must be a boolean`);
    for (const field of ['title', 'reuses', 'verify']) {
      if (!task[field]) errors.push(`${task.id}.${field} is required`);
    }
    for (const field of ['files', 'depends_on', 'fixes', 'acceptance', 'checks']) {
      if (!Array.isArray(task[field])) errors.push(`${task.id}.${field} must be an array`);
      else if (duplicates(task[field]).length) errors.push(`${task.id}.${field} must be unique`);
      else if (task[field].some((value) => typeof value !== 'string' || !value)) errors.push(`${task.id}.${field} entries must be non-empty strings`);
    }
    if (!task.final_gate && Array.isArray(task.fixes) && task.fixes.length === 0) errors.push(`${task.id} must fix at least one finding`);
    if (!task.final_gate && Array.isArray(task.files) && task.files.length === 0) errors.push(`${task.id} must name at least one file`);
    if (!task.final_gate && (!task.acceptance || task.acceptance.length < 2 || task.acceptance.length > 4)) {
      errors.push(`${task.id} requires 2 to 4 acceptance conditions`);
    }
    if (task.final_gate && (!task.acceptance || task.acceptance.length < 1 || task.acceptance.length > 4)) {
      errors.push(`${task.id} final gate requires 1 to 4 acceptance conditions`);
    }
    if (task.final_gate && ['files', 'fixes', 'checks'].some((field) => task[field] && task[field].length)) {
      errors.push(`${task.id} final gate files, fixes, and checks must be empty`);
    }
    for (const id of task.fixes || []) {
      if (!findingIds.has(id)) errors.push(`${task.id} fixes missing finding ${id}`);
      else {
        const finding = audit.findings.find((item) => item.id === id);
        if (!(finding.remediation || []).includes(task.id)) errors.push(`${task.id} and ${id} remediation links are not reciprocal`);
        for (const check of finding.checks || []) {
          if (!(task.checks || []).includes(check)) errors.push(`${task.id} must carry ${check} from ${id}`);
        }
      }
    }
    for (const id of task.checks || []) {
      if (!checkIds.has(id)) errors.push(`${task.id} references missing check ${id}`);
    }
  }

  for (const finding of audit.findings) {
    for (const id of finding.remediation || []) {
      if (!taskIds.has(id)) errors.push(`${finding.id} references missing task ${id}`);
      else {
        const task = audit.tasks.find((item) => item.id === id);
        if (!(task.fixes || []).includes(finding.id)) errors.push(`${finding.id} and ${id} remediation links are not reciprocal`);
      }
    }
    const closure = audit.tasks.some((task) => task.status !== 'superseded' && (task.fixes || []).includes(finding.id));
    if (['Critical', 'High'].includes(finding.severity) && finding.status === 'open' && !closure) {
      errors.push(`${finding.id} has no remediation task`);
    }
  }

  const finalGates = audit.tasks.filter((task) => task.final_gate && task.status !== 'superseded');
  if (finalGates.length !== 1) errors.push('exactly one active final re-audit gate is required');
  for (const task of audit.tasks) {
    for (const dependency of task.depends_on || []) {
      if (!taskIds.has(dependency)) errors.push(`${task.id} depends on missing task ${dependency}`);
      else {
        const prerequisite = audit.tasks.find((item) => item.id === dependency);
        if (prerequisite.phase > task.phase) errors.push(`${task.id} depends on later-phase task ${dependency}`);
        else if (waveValue(prerequisite.wave) >= waveValue(task.wave)) errors.push(`${task.id} dependency ${dependency} must be in an earlier wave`);
      }
    }
  }
  if (finalGates.length === 1) {
    const required = audit.tasks.filter((task) => !task.final_gate && task.status !== 'superseded').map((task) => task.id);
    for (const id of required) if (!finalGates[0].depends_on.includes(id)) errors.push(`final re-audit gate must depend on ${id}`);
    const latestPhase = Math.max(0, ...audit.tasks.filter((task) => !task.final_gate && task.status !== 'superseded').map((task) => task.phase));
    if (finalGates[0].phase <= latestPhase) errors.push('final re-audit gate must be in a later phase than every remediation task');
  }
  const parallel = audit.tasks.filter((task) => task.parallel && task.status !== 'superseded');
  for (let left = 0; left < parallel.length; left += 1) {
    for (let right = left + 1; right < parallel.length; right += 1) {
      if (parallel[left].wave !== parallel[right].wave) continue;
      const overlap = parallel[left].files.filter((file) => parallel[right].files.includes(file));
      if (overlap.length) errors.push(`${parallel[left].id} and ${parallel[right].id} are parallel but share ${overlap.join(', ')}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visitTask(id) {
    if (visiting.has(id)) {
      errors.push(`task dependency cycle includes ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const task = audit.tasks.find((item) => item.id === id);
    for (const dependency of task ? task.depends_on || [] : []) visitTask(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of taskIds) visitTask(id);

  for (const strength of audit.strengths) {
    if (!strength.title || !strength.preserve) errors.push('each strength requires title and preserve');
    if (!Array.isArray(strength.evidence) || strength.evidence.length === 0) errors.push(`${strength.title || 'strength'} requires evidence`);
    for (const id of strength.evidence || []) if (!evidenceIds.has(id)) errors.push(`${strength.title} references missing evidence ${id}`);
  }
  for (const risk of audit.accepted_risks) {
    for (const field of ['finding', 'summary', 'owner', 'accepted_on', 'expires', 'review']) {
      if (!risk[field]) errors.push(`accepted risk requires ${field}`);
    }
    if (risk.finding && !findingIds.has(risk.finding)) errors.push(`accepted risk references missing finding ${risk.finding}`);
    if (!isDate(risk.accepted_on) || !isDate(risk.expires)) errors.push(`accepted risk ${risk.finding || ''} dates must be YYYY-MM-DD`);
    if (isDate(risk.accepted_on) && isDate(risk.expires) && risk.expires < risk.accepted_on) errors.push(`accepted risk ${risk.finding || ''} expires before acceptance`);
    if (isDate(risk.expires) && isDate(metadata.updated) && risk.expires < metadata.updated) errors.push(`accepted risk ${risk.finding || ''} expired on ${risk.expires}`);
    const finding = audit.findings.find((item) => item.id === risk.finding);
    if (finding && finding.status !== 'accepted-risk') errors.push(`${risk.finding} must have accepted-risk status`);
  }
  if (duplicates(audit.accepted_risks.map((risk) => risk.finding)).length) errors.push('accepted risks must reference unique findings');
  for (const finding of audit.findings.filter((item) => item.status === 'accepted-risk')) {
    if (!audit.accepted_risks.some((risk) => risk.finding === finding.id)) errors.push(`${finding.id} has accepted-risk status without an accepted risk record`);
  }
  for (const question of audit.open_questions) {
    for (const field of ['question', 'owner', 'due', 'default']) if (!question[field]) errors.push(`open question requires ${field}`);
    if (!isDate(question.due)) errors.push('open question due must be YYYY-MM-DD');
  }
  for (const entry of audit.session_log) {
    if (!isDate(entry.date) || !entry.summary) errors.push('session log entries require date and summary');
    if (isDate(entry.date) && isDate(metadata.updated) && entry.date > metadata.updated) errors.push(`session log entry ${entry.date} is after audit.updated`);
    if (entry.summary && entry.summary.length > 140) errors.push('session log summary exceeds 140 characters');
  }
  if (audit.compliance.result === 'unknown' && audit.open_questions.length === 0) errors.push('unknown compliance requires an owned open question');
  const complianceFindings = audit.findings.filter((finding) => /^F-CMP-\d+$/.test(finding.id));
  if (audit.compliance.result === 'findings-injected' && complianceFindings.length === 0) errors.push('findings-injected compliance requires an F-CMP finding');
  for (const finding of complianceFindings.filter((item) => item.status === 'open')) {
    const activeTask = audit.tasks.some((task) => task.status !== 'superseded' && (task.fixes || []).includes(finding.id));
    if (!activeTask) errors.push(`${finding.id} requires a compliance remediation task`);
  }
  for (const domain of audit.domains) {
    const active = audit.findings.filter((finding) => finding.domain === domain.id && ['open', 'accepted-risk'].includes(finding.status));
    if (active.length > 12) errors.push(`${domain.id} has ${active.length} active findings; maximum is 12`);
  }
  for (const phase of new Set(audit.tasks.filter((task) => task.status === 'open').map((task) => task.phase))) {
    const active = audit.tasks.filter((task) => task.status === 'open' && task.phase === phase);
    if (active.length > 12) errors.push(`phase ${phase} has ${active.length} open tasks; maximum is 12`);
  }
  if (audit.accepted_risks.length + audit.open_questions.length > 9) errors.push('active risks and open questions must total fewer than 10');
  if (options.catalog) {
    const catalog = options.catalog;
    if (metadata.pack_version !== catalog.pack_version) errors.push(`audit.pack_version must match catalog ${catalog.pack_version}`);
    if (metadata.engine_version !== catalog.pack_version) errors.push(`audit.engine_version must match runtime ${catalog.pack_version}`);
    const expectedDomains = new Set(catalog.domains.map((domain) => domain.id));
    for (const id of expectedDomains) if (!domainIds.has(id)) errors.push(`missing applicability row for ${id}`);
    for (const domain of audit.domains.filter((item) => item.status === 'applicable')) {
      const expected = new Set(catalog.checks.filter((check) => check.domain === domain.id).map((check) => check.id));
      const actual = new Set(domain.checks.map((check) => check.id));
      for (const id of expected) if (!actual.has(id)) errors.push(`${domain.id} ledger is missing ${id}`);
      for (const id of actual) if (!expected.has(id)) errors.push(`${domain.id} ledger contains unknown check ${id}`);
      for (const check of domain.checks) {
        const definition = catalog.checks.find((item) => item.id === check.id);
        if (definition && Math.abs(check.weight - definition.default_weight) > 0.0001) {
          errors.push(`${check.id} weight must match catalog ${definition.default_weight}`);
        }
        if (definition && definition.scoring_role === 'routing' && check.outcome === 'fail') {
          const routed = (check.finding_ids || []).some((findingId) => {
            const finding = audit.findings.find((item) => item.id === findingId);
            return finding && finding.checks.some((id) => {
              const target = catalog.checks.find((item) => item.id === id);
              return target && target.default_weight > 0;
            });
          });
          if (!routed) errors.push(`${check.id} is a routing check and must map its finding to a weighted owning check`);
        }
      }
    }
    for (const finding of audit.findings.filter((item) => ['open', 'accepted-risk'].includes(item.status))) {
      const hasWeightedOwner = finding.checks.some((id) => {
        const definition = catalog.checks.find((check) => check.id === id);
        return definition && definition.domain === finding.domain && definition.default_weight > 0;
      });
      if (!hasWeightedOwner) errors.push(`${finding.id} must include a weighted owning check from ${finding.domain}`);
    }
  }
  if (redactSecrets(JSON.stringify(audit)).redacted) errors.push('audit contains a credential-shaped value outside a redacted evidence record');
  return errors;
}

function severityFactor(severity) {
  return { Critical: 0, High: 0.25, Medium: 0.5, Low: 0.75 }[severity] ?? 0;
}

function verdict(score) {
  if (score >= 90) return 'audit-proof';
  if (score >= 80) return 'solid';
  if (score >= 70) return 'needs work';
  if (score >= 50) return 'at risk';
  return 'critical condition';
}

function compileAudit(input, options = {}) {
  const suppliedComputed = input && input.computed ? clone(input.computed) : null;
  const audit = clone(input);
  const errors = validateAudit(audit, options);
  if (errors.length) return { audit, errors };

  const findings = new Map(audit.findings.map((finding) => [finding.id, finding]));
  const domainScores = {};
  let applicable = 0;
  let evaluated = 0;
  let passed = 0;
  let failed = 0;
  let unknown = 0;
  let notApplicable = 0;

  for (const domain of audit.domains) {
    if (domain.status === 'excluded') continue;
    let numerator = 0;
    let denominator = 0;
    for (const check of domain.checks) {
      if (check.outcome === 'not-applicable') {
        notApplicable += 1;
        continue;
      }
      applicable += 1;
      if (check.outcome === 'unknown') {
        unknown += 1;
        continue;
      }
      evaluated += 1;
      denominator += check.weight;
      if (check.outcome === 'pass') {
        passed += 1;
        numerator += check.weight;
      } else {
        failed += 1;
        const severities = (check.finding_ids || [])
          .map((id) => findings.get(id))
          .filter(Boolean)
          .filter(isActiveRisk)
          .map((finding) => severityFactor(finding.severity));
        numerator += check.weight * (severities.length ? Math.min(...severities) : 0);
      }
    }
    const raw = denominator ? Math.round((numerator / denominator) * 100) : 0;
    const activeCritical = audit.findings.some((finding) => finding.domain === domain.id && isActiveRisk(finding) && finding.severity === 'Critical');
    const score = activeCritical ? Math.min(raw, 69) : raw;
    domainScores[domain.id] = {
      raw_score: raw,
      score,
      cap: activeCritical ? 'active Critical caps domain at 69' : null
    };
  }

  const activeDomains = audit.domains.filter((domain) => domain.status === 'applicable');
  const totalDomainWeight = activeDomains.reduce((sum, domain) => sum + domain.weight, 0);
  const weighted = activeDomains.reduce((sum, domain) => sum + domainScores[domain.id].score * domain.weight, 0);
  const rawOverall = totalDomainWeight ? Math.round(weighted / totalDomainWeight) : 0;
  const coveragePercent = applicable ? Math.round((evaluated / applicable) * 100) : 0;
  let coverageCap = 100;
  if (coveragePercent < 60) coverageCap = 69;
  else if (coveragePercent < 80) coverageCap = 79;
  else if (coveragePercent < 95) coverageCap = 89;
  const criticalCap = audit.findings.some((finding) => isActiveRisk(finding) && finding.severity === 'Critical') ? 79 : 100;
  const weakDomainCap = Object.values(domainScores).some((domain) => domain.score < 50) ? 84 : 100;
  const score = Math.min(rawOverall, coverageCap, criticalCap, weakDomainCap);

  audit.computed = {
    coverage: {
      applicable,
      evaluated,
      passed,
      failed,
      unknown,
      not_applicable: notApplicable,
      percent: coveragePercent
    },
    domains: domainScores,
    overall: {
      raw_score: rawOverall,
      score,
      verdict: verdict(score),
      coverage_cap: coverageCap,
      critical_cap: criticalCap,
      weak_domain_cap: weakDomainCap
    },
    counts: {
      findings_total: audit.findings.length,
      critical: audit.findings.filter((finding) => finding.severity === 'Critical' && isActiveRisk(finding)).length,
      high: audit.findings.filter((finding) => finding.severity === 'High' && isActiveRisk(finding)).length,
      medium: audit.findings.filter((finding) => finding.severity === 'Medium' && isActiveRisk(finding)).length,
      low: audit.findings.filter((finding) => finding.severity === 'Low' && isActiveRisk(finding)).length,
      accepted_risk: audit.findings.filter((finding) => finding.status === 'accepted-risk').length,
      tasks_total: audit.tasks.filter((task) => task.status !== 'superseded').length,
      tasks_done: audit.tasks.filter((task) => task.status === 'done').length
    }
  };
  if (suppliedComputed && JSON.stringify(suppliedComputed) !== JSON.stringify(audit.computed) && !options.allowDerivedRewrite) {
    return { audit, errors: ['computed state is stale; run validate --write to rebuild it'] };
  }
  return { audit, errors: [] };
}

module.exports = { ALLOWED, DOMAIN_WEIGHTS, compileAudit, isActiveRisk, validateAudit, verdict };
