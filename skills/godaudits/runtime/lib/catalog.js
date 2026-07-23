'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateProjectContextCatalog } = require('./project-context');

const MODULES = [
  ['product', 'product.md'],
  ['architecture', 'architecture.md'],
  ['stack', 'stack.md'],
  ['database', 'database.md'],
  ['security', 'security.md'],
  ['llm', 'llm.md'],
  ['ux', 'ux.md'],
  ['ui', 'ui.md'],
  ['seo', 'seo.md'],
  ['code-quality', 'code-quality.md'],
  ['style-genome', 'style-genome.md'],
  ['agent-memory', 'agent-memory.md'],
  ['repo', 'repo.md'],
  ['build', 'build.md'],
  ['roadmap', 'roadmap.md'],
  ['deploy', 'deploy.md'],
  ['observe', 'observe.md'],
  ['launch', 'launch.md']
];

// Product depth is separate from per-check cost. Security and build
// completeness have a deep-capable method because their modules require
// execution-path and vertical-slice tracing. Every other domain is explicitly
// screening-grade and carries a specialist escalation criterion.
const DOMAIN_DEPTH = {
  product: {
    grade: 'screening',
    escalation: 'Escalate when metric definitions cannot be joined to emitted events or user evidence, or when product claims conflict across code and artifacts.'
  },
  architecture: {
    grade: 'screening',
    escalation: 'Escalate when trust boundaries, load-bearing dependencies, or failure domains cannot be reconstructed without a dedicated architecture review.'
  },
  stack: {
    grade: 'screening',
    escalation: 'Escalate when supported-version, compatibility, or migration claims need current ecosystem research or executable upgrade testing.'
  },
  database: {
    grade: 'screening',
    escalation: 'Escalate money, tenant isolation, destructive migration, query-plan, and data-integrity leads to a database specialist with runtime metadata access.'
  },
  security: {
    grade: 'deep-capable',
    escalation: 'Escalate any Critical or High lead, unresolved authorization boundary, secret exposure, or runtime-only exploit path to an independent security assessment.'
  },
  llm: {
    grade: 'screening',
    escalation: 'Escalate privileged model-output sinks, prompt-injection boundaries, agent tools, and quality-critical paths without adversarial eval evidence to an AI security review.'
  },
  ux: {
    grade: 'screening',
    escalation: 'Escalate critical journeys whose usability, recovery, consent, or accessibility behavior cannot be established without moderated or runtime testing.'
  },
  ui: {
    grade: 'screening',
    escalation: 'Escalate responsive, cross-browser, visual-regression, and accessibility leads that require rendered pixels or assistive-technology testing.'
  },
  seo: {
    grade: 'screening',
    escalation: 'Escalate crawl, indexation, canonical, structured-data, and performance leads that require live crawl data, search-console data, or field measurements.'
  },
  'code-quality': {
    grade: 'screening',
    escalation: 'Escalate concurrency, lifecycle, dead-control, or performance leads that require execution, profiling, mutation testing, or property testing.'
  },
  'style-genome': {
    grade: 'screening',
    escalation: 'Escalate authorship, generated-code, and intentional-style ambiguities that cannot be resolved from representative history and repository evidence.'
  },
  'agent-memory': {
    grade: 'screening',
    escalation: 'Escalate conflicting scoped instructions, missing authority, or unresolved memory precedence to the repository governance owner.'
  },
  repo: {
    grade: 'screening',
    escalation: 'Escalate protected-branch, secret-history, provenance, and supply-chain leads that require forge administration or organization-level evidence.'
  },
  build: {
    grade: 'deep-capable',
    escalation: 'Escalate incomplete vertical slices, dead controls, runtime-only flows, or unverifiable acceptance paths to an implementation audit with executable access.'
  },
  roadmap: {
    grade: 'screening',
    escalation: 'Escalate plan-versus-delivery contradictions that require issue-tracker history, ownership decisions, or portfolio sequencing.'
  },
  deploy: {
    grade: 'screening',
    escalation: 'Escalate state migrations, rollback parity, release ordering, and production-topology leads to a release-engineering rehearsal.'
  },
  observe: {
    grade: 'screening',
    escalation: 'Escalate paper SLO, alert, runbook, and telemetry leads that require production queries, incident history, or a live failure exercise.'
  },
  launch: {
    grade: 'screening',
    escalation: 'Escalate positioning, attribution, support, and operational-readiness leads that require customer, analytics, or channel evidence.'
  }
};

const ROUTING_CHECKS = new Set([
  'A-DB-22',
  'A-DB-24',
  'A-REPO-24',
  'A-PRD-21',
  'A-SEC-1',
  'A-SEC-2',
  'A-SEC-24',
  'A-SEC-25',
  'A-SEC-28',
  'A-SEC-29',
  'A-SEC-30',
  'A-SEC-31',
  'A-SEC-32',
  'A-SEC-33',
  'A-ARCH-23',
  'A-UI-24',
  'A-CODE-25',
  'A-CODE-26',
  'A-LLM-23',
  'A-UX-20',
  'A-SEO-22',
  'A-MEM-19'
]);

// Behavioral check ids: a static read can suspect these defects (a race, a dead
// control, an early state transition, an authorization gap on a non-primary
// path) but cannot prove them without running the app. This is the single
// source for the catalog's verifiability axis; verify-runtime imports it rather
// than keeping a second list. Every id is validated against the parsed catalog
// below, so a renamed or deleted check fails the build instead of silently
// dropping out of runtime eligibility.
const BEHAVIORAL_CHECKS = new Set([
  'A-SEC-29',
  'A-SEC-30',
  'A-SEC-31',
  'A-DB-24',
  'A-CODE-25',
  'A-CODE-26'
]);

// Cost tier. A deep check cannot be graded faithfully from the evidence
// fingerprint, a manifest, or one targeted read: it needs a multi-file
// execution-path trace (source to sink, mount order against every handler), a
// cross-module join (declared shape against built shape, promised tiers against
// enforcement), a full git-history pass, or runtime-shaped reasoning. Every
// behavioral check is deep by definition; the rest are maintainer-curated from
// each module's Look guidance. The set is validated against the parsed catalog
// below, so a renamed or deleted check fails the build instead of silently
// changing a tier. Everything not listed is screening: still evidence-bound,
// but answerable from targeted reads. `godaudits init --budget medium` leaves
// deep-trace checks unknown in the complete ledger. `--budget full` selects
// both tiers.
const DEEP_CHECKS = new Set([
  'A-PRD-18',
  'A-PRD-19',
  'A-PRD-20',
  'A-ARCH-10',
  'A-ARCH-11',
  'A-ARCH-13',
  'A-ARCH-18',
  'A-ARCH-20',
  'A-ARCH-21',
  'A-ARCH-22',
  'A-STACK-14',
  'A-STACK-15',
  'A-STACK-19',
  'A-DB-9',
  'A-DB-10',
  'A-DB-12',
  'A-DB-14',
  'A-DB-15',
  'A-DB-19',
  'A-DB-24',
  'A-SEC-1',
  'A-SEC-3',
  'A-SEC-4',
  'A-SEC-5',
  'A-SEC-6',
  'A-SEC-8',
  'A-SEC-9',
  'A-SEC-10',
  'A-SEC-12',
  'A-SEC-19',
  'A-SEC-24',
  'A-SEC-25',
  'A-SEC-27',
  'A-SEC-28',
  'A-SEC-29',
  'A-SEC-30',
  'A-SEC-31',
  'A-SEC-33',
  'A-LLM-1',
  'A-LLM-4',
  'A-LLM-5',
  'A-LLM-9',
  'A-LLM-10',
  'A-LLM-13',
  'A-LLM-14',
  'A-LLM-22',
  'A-LLM-23',
  'A-LLM-25',
  'A-UX-2',
  'A-UX-5',
  'A-UX-8',
  'A-UX-10',
  'A-UX-11',
  'A-UX-17',
  'A-UX-21',
  'A-UI-11',
  'A-UI-13',
  'A-UI-19',
  'A-UI-22',
  'A-UI-23',
  'A-SEO-2',
  'A-SEO-5',
  'A-SEO-8',
  'A-SEO-16',
  'A-SEO-21',
  'A-SEO-23',
  'A-CODE-2',
  'A-CODE-8',
  'A-CODE-12',
  'A-CODE-14',
  'A-CODE-22',
  'A-CODE-23',
  'A-CODE-25',
  'A-CODE-26',
  'A-DNA-13',
  'A-DNA-20',
  'A-DNA-22',
  'A-MEM-9',
  'A-MEM-10',
  'A-MEM-11',
  'A-MEM-14',
  'A-MEM-17',
  'A-REPO-4',
  'A-REPO-11',
  'A-REPO-16',
  'A-REPO-24',
  'A-BUILD-4',
  'A-BUILD-5',
  'A-BUILD-6',
  'A-BUILD-8',
  'A-BUILD-9',
  'A-BUILD-13',
  'A-BUILD-19',
  'A-ROAD-6',
  'A-ROAD-15',
  'A-ROAD-16',
  'A-ROAD-21',
  'A-ROAD-22',
  'A-DEPLOY-5',
  'A-DEPLOY-6',
  'A-DEPLOY-13',
  'A-DEPLOY-14',
  'A-DEPLOY-16',
  'A-OBS-10',
  'A-OBS-11',
  'A-OBS-17',
  'A-OBS-22',
  'A-OBS-23',
  'A-OBS-24',
  'A-LAUNCH-5',
  'A-LAUNCH-11',
  'A-LAUNCH-22',
  'A-LAUNCH-23'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalize(value) {
  return value
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function skillVersion(root) {
  const source = fs.readFileSync(path.join(resolveSkillRoot(root), 'SKILL.md'), 'utf8');
  const match = source.match(/^\s+version:\s+"([^"]+)"/m);
  if (!match) throw new Error('SKILL.md metadata.version is missing');
  return match[1];
}

function resolveSkillRoot(root) {
  const direct = path.resolve(root);
  if (fs.existsSync(path.join(direct, 'SKILL.md')) && fs.existsSync(path.join(direct, 'references'))) return direct;
  return path.join(direct, 'skills/godaudits');
}

function parseChecks(domain, module, source) {
  const lines = source.split(/\r?\n/);
  const checks = [];
  let current = null;

  function finish() {
    if (!current) return;
    const block = current.block.join('\n');
    const look = block.match(/\bLook:\s*([\s\S]*?)(?=\s+Fail:|$)/);
    const fail = block.match(/\bFail:\s*([\s\S]*)/);
    checks.push({
      id: current.id,
      domain,
      module,
      title: normalize(current.title).replace(/[.:]\s*$/, ''),
      look: look ? normalize(look[1]) : '',
      fail: fail ? normalize(fail[1]) : '',
      source_line: current.line
    });
    current = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^## Scoring/.test(line)) {
      finish();
      break;
    }
    const match = line.match(/^\d+\.\s+\*\*(A-[A-Z]+-\d+)(?:\s*\([^)]*\))?\s*([^*]*)\*\*(.*)$/)
      || line.match(/^\d+\.\s+(A-[A-Z]+-\d+)(?:\s*\([^)]*\))?[:.]?\s*(.*)$/);
    if (match) {
      finish();
      current = {
        id: match[1],
        title: `${match[2] || ''}${match[3] || ''}`,
        line: index + 1,
        block: []
      };
    } else if (current) {
      current.block.push(line);
    }
  }
  finish();
  return checks;
}

function scoringText(source) {
  const match = source.match(/^## Scoring\s*\n([\s\S]*?)(?=^## Remediation seeds)/m);
  return match ? match[1].trim() : '';
}

// The A-to-R mirror boundary is machine-authoritative: exactly one line per
// module states where the one-to-one numbering mirror ends and the audit-only
// checks begin, plus the godplans requirement count it was cross-verified
// against. Every check at or below the boundary substitutes to a real R-id in
// godplans; every check above it is godaudits-only and carries no plan
// requirement. The prose "(audit-only)" tags are a human view of the same fact;
// scripts/lint.sh fails if they disagree with this line, so the two never drift.
function parseMirrorBoundary(module, prefix, source) {
  const bare = prefix.replace(/^A-/, '');
  const lines = source.split(/\r?\n/).filter((line) => /^Mirror boundary:/.test(line));
  if (lines.length !== 1) throw new Error(`${module} must declare exactly one Mirror boundary line, found ${lines.length}`);
  const pattern = new RegExp(`^Mirror boundary:\\s+A-${bare}-1\\.\\.(\\d+)\\s+mirror\\s+R-${bare}-1\\.\\.\\1\\s+one to one;\\s+A-${bare}-(\\d+)\\s+and up are audit-only\\.\\s+Cross-verified against godplans:\\s+R-${bare}-1\\.\\.(\\d+)\\s+defined\\.\\s*$`);
  const match = lines[0].match(pattern);
  if (!match) throw new Error(`${module} Mirror boundary line is malformed: ${lines[0]}`);
  return { boundary: Number(match[1]), auditStart: Number(match[2]), godplansMax: Number(match[3]) };
}

function expandChecks(expression) {
  const ids = [];
  let prefix = null;
  const pattern = /A-([A-Z]+)-(\d+)(?:\s+to\s+A-[A-Z]+-(\d+))?|\b(\d+)\b/g;
  let match;
  while ((match = pattern.exec(expression)) !== null) {
    if (match[1]) {
      prefix = match[1];
      const start = Number(match[2]);
      const end = match[3] ? Number(match[3]) : start;
      for (let number = start; number <= end; number += 1) ids.push(`A-${prefix}-${number}`);
    } else if (prefix && match[4]) ids.push(`A-${prefix}-${Number(match[4])}`);
  }
  return [...new Set(ids)];
}

function parseDimensions(contract) {
  const dimensions = [];
  for (const raw of contract.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.includes('A-')) continue;
    let name;
    let weight;
    let expression;
    if (line.startsWith('|')) {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length < 3 || cells[0] === 'Dimension' || /^-+$/.test(cells[0])) continue;
      name = cells[0];
      weight = Number.parseFloat(cells[1]);
      expression = cells[2];
    } else if (line.startsWith('- ')) {
      expression = line.slice(line.indexOf('A-')).replace(/\):\s*\d+(?:\.\d+)?[.,]?.*$/, ')');
      const afterChecks = line.match(/\):\s*(\d+(?:\.\d+)?)/);
      const beforeChecks = line.match(/:\s*(\d+(?:\.\d+)?)(?:\s*,[^()]*)?\s*\([^)]*A-/);
      const leading = line.match(/\((\d+(?:\.\d+)?)(?:,[^)]*)?\):\s*A-/);
      weight = Number.parseFloat((afterChecks || beforeChecks || leading || [])[1]);
      name = line.slice(2, line.indexOf('(') > 0 ? line.indexOf('(') : line.indexOf(':')).trim();
    }
    const checks = expandChecks(expression || '');
    if (name && Number.isFinite(weight) && checks.length) dimensions.push({ name, weight, checks });
  }
  return dimensions;
}

function buildCatalog(root) {
  const skillRoot = resolveSkillRoot(root);
  const references = path.join(skillRoot, 'references');
  const profilesSource = fs.readFileSync(path.join(skillRoot, 'catalog/profiles.json'), 'utf8');
  const standardsSource = fs.readFileSync(path.join(skillRoot, 'catalog/standards.json'), 'utf8');
  const projectContextSource = fs.readFileSync(path.join(skillRoot, 'catalog/project-context.json'), 'utf8');
  const profiles = JSON.parse(profilesSource).profiles;
  const standards = JSON.parse(standardsSource);
  const projectContext = JSON.parse(projectContextSource);
  const projectContextErrors = validateProjectContextCatalog(projectContext);
  if (projectContextErrors.length) throw new Error(projectContextErrors.join('; '));
  const domainNames = MODULES.map(([domain]) => domain);
  if (JSON.stringify(Object.keys(DOMAIN_DEPTH).sort()) !== JSON.stringify([...domainNames].sort())) {
    throw new Error('domain depth registry must cover all and only catalog domains');
  }
  for (const [name, profile] of Object.entries(profiles)) {
    const keys = Object.keys(profile.weights || {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...domainNames].sort())) throw new Error(`risk profile ${name} must weight all and only catalog domains`);
    const total = Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0);
    if (Object.values(profile.weights).some((weight) => typeof weight !== 'number' || weight <= 0)) throw new Error(`risk profile ${name} has an invalid weight`);
    if (Math.abs(total - 100) > 0.0001) throw new Error(`risk profile ${name} weights sum to ${total}, expected 100`);
  }
  const checks = [];
  const domains = [];
  const sources = [];

  for (const [domain, module] of MODULES) {
    const source = fs.readFileSync(path.join(references, module), 'utf8');
    const domainChecks = parseChecks(domain, module, source);
    if (!domainChecks.length) throw new Error(`${module} contains no parsed checks`);
    for (const check of domainChecks) {
      if (!check.look || !check.fail) throw new Error(`${check.id} requires Look and Fail guidance`);
    }
    const prefix = domainChecks[0].id.replace(/-\d+$/, '');
    const boundary = parseMirrorBoundary(module, prefix, source);
    const maxNumber = Math.max(...domainChecks.map((check) => Number(check.id.match(/(\d+)$/)[1])));
    if (boundary.boundary < 1 || boundary.boundary > maxNumber) throw new Error(`${module} mirror boundary ${boundary.boundary} is outside 1..${maxNumber}`);
    if (boundary.auditStart !== boundary.boundary + 1) throw new Error(`${module} audit-only start ${boundary.auditStart} must equal mirror boundary + 1 (${boundary.boundary + 1})`);
    if (boundary.godplansMax < boundary.boundary) throw new Error(`${module} mirror boundary ${boundary.boundary} exceeds its cross-verified godplans requirement count ${boundary.godplansMax}`);
    for (const check of domainChecks) {
      check.audit_only = Number(check.id.match(/(\d+)$/)[1]) > boundary.boundary;
    }
    domains.push({
      id: domain,
      module,
      depth_grade: DOMAIN_DEPTH[domain].grade,
      escalation: DOMAIN_DEPTH[domain].escalation,
      check_count: domainChecks.length,
      mirror_boundary: boundary.boundary,
      godplans_requirements: boundary.godplansMax,
      audit_only_count: domainChecks.filter((check) => check.audit_only).length,
      scoring_contract: scoringText(source),
      dimensions: parseDimensions(scoringText(source))
    });
    checks.push(...domainChecks);
    sources.push(`${module}\n${source}`);
  }
  sources.push(`profiles.json\n${profilesSource}`);
  sources.push(`standards.json\n${standardsSource}`);
  sources.push(`project-context.json\n${projectContextSource}`);
  sources.push(`runtime-axes\n${JSON.stringify({
    behavioral: [...BEHAVIORAL_CHECKS].sort(),
    deep_trace: [...DEEP_CHECKS].sort(),
    depth: DOMAIN_DEPTH,
    routing: [...ROUTING_CHECKS].sort()
  })}`);

  const duplicates = checks
    .map((check) => check.id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length) {
    throw new Error(`duplicate check ids: ${[...new Set(duplicates)].join(', ')}`);
  }

  if (standards.schema_version !== '1.0' || !standards.frameworks || typeof standards.frameworks !== 'object') {
    throw new Error('standards catalog must use schema_version 1.0 and define frameworks');
  }
  const checkMap = new Map(checks.map((check) => [check.id, check]));
  for (const check of checks) check.standards = [];
  for (const [frameworkId, framework] of Object.entries(standards.frameworks)) {
    if (!framework.name || !Array.isArray(framework.categories) || framework.categories.length === 0) {
      throw new Error(`standards framework ${frameworkId} requires a name and categories`);
    }
    const categoryIds = new Set();
    for (const category of framework.categories) {
      if (!category.id || !category.title || !Array.isArray(category.checks) || category.checks.length === 0) {
        throw new Error(`standards framework ${frameworkId} contains an incomplete category`);
      }
      if (categoryIds.has(category.id)) throw new Error(`duplicate standards category ${frameworkId}/${category.id}`);
      categoryIds.add(category.id);
      if (new Set(category.checks).size !== category.checks.length) throw new Error(`${frameworkId}/${category.id} contains duplicate checks`);
      for (const id of category.checks) {
        const check = checkMap.get(id);
        if (!check) throw new Error(`${frameworkId}/${category.id} references unknown check ${id}`);
        check.standards.push(`${frameworkId}/${category.id}`);
      }
    }
  }

  const domainMap = new Map(domains.map((domain) => [domain.id, domain]));
  for (const check of checks) {
    const domain = domainMap.get(check.domain);
    const dimension = domain.dimensions.find((item) => item.checks.includes(check.id));
    check.dimension = dimension ? dimension.name : null;
    check.dimension_weight = dimension ? dimension.weight : 0;
    check.scoring_role = dimension ? 'weighted' : 'routing';
    check.verifiability = BEHAVIORAL_CHECKS.has(check.id) ? 'behavioral' : 'static';
    check.cost_tier = DEEP_CHECKS.has(check.id) ? 'deep-trace' : 'screening';
  }
  for (const domain of domains) {
    if (!domain.dimensions.length) throw new Error(`${domain.id} contains no parsed scoring dimensions`);
    const assignments = new Map();
    for (const dimension of domain.dimensions) {
      for (const id of dimension.checks) assignments.set(id, (assignments.get(id) || 0) + 1);
    }
    for (const [id, count] of assignments) {
      if (!checks.some((check) => check.id === id)) throw new Error(`${domain.id} scoring references unknown check ${id}`);
      if (count > 1) throw new Error(`${id} appears in multiple scoring dimensions`);
    }
    const activeWeight = domain.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    if (!(activeWeight > 0)) throw new Error(`${domain.id} scoring weights must be positive`);
    for (const dimension of domain.dimensions) {
      const perCheck = (dimension.weight / activeWeight * 100) / dimension.checks.length;
      for (const id of dimension.checks) {
        const check = checks.find((item) => item.id === id);
        if (check) check.default_weight = Number(perCheck.toFixed(8));
      }
    }
    for (const check of checks.filter((item) => item.domain === domain.id && item.default_weight === undefined)) check.default_weight = 0;
  }
  const routed = new Set(checks.filter((check) => check.scoring_role === 'routing').map((check) => check.id));
  const missingRouting = [...ROUTING_CHECKS].filter((id) => !routed.has(id));
  const unexpectedRouting = [...routed].filter((id) => !ROUTING_CHECKS.has(id));
  if (missingRouting.length || unexpectedRouting.length) {
    throw new Error(`routing check mismatch; missing ${missingRouting.join(', ') || 'none'}; unexpected ${unexpectedRouting.join(', ') || 'none'}`);
  }
  const unknownBehavioral = [...BEHAVIORAL_CHECKS].filter((id) => !checkMap.has(id));
  if (unknownBehavioral.length) {
    throw new Error(`behavioral check axis references unknown check ${unknownBehavioral.join(', ')}`);
  }
  const unknownDeep = [...DEEP_CHECKS].filter((id) => !checkMap.has(id));
  if (unknownDeep.length) {
    throw new Error(`deep cost tier references unknown check ${unknownDeep.join(', ')}`);
  }
  const behavioralNotDeep = [...BEHAVIORAL_CHECKS].filter((id) => !DEEP_CHECKS.has(id));
  if (behavioralNotDeep.length) {
    throw new Error(`behavioral checks must also be deep-tier: ${behavioralNotDeep.join(', ')}`);
  }

  return {
    schema_version: '1.0',
    pack_version: skillVersion(root),
    source_hash: sha256(sources.join('\n')),
    domain_count: domains.length,
    check_count: checks.length,
    profiles,
    standards,
    project_context: {
      source: projectContext.source,
      form_count: projectContext.forms.length,
      profile_count: projectContext.profiles.length
    },
    domains,
    checks
  };
}

module.exports = { BEHAVIORAL_CHECKS, DEEP_CHECKS, DOMAIN_DEPTH, MODULES, ROUTING_CHECKS, buildCatalog, expandChecks, parseChecks, parseDimensions, parseMirrorBoundary };
