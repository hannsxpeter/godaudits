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
    domains.push({
      id: domain,
      module,
      check_count: domainChecks.length,
      scoring_contract: scoringText(source),
      dimensions: parseDimensions(scoringText(source))
    });
    checks.push(...domainChecks);
    sources.push(`${module}\n${source}`);
  }
  sources.push(`profiles.json\n${profilesSource}`);
  sources.push(`standards.json\n${standardsSource}`);
  sources.push(`project-context.json\n${projectContextSource}`);

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

module.exports = { BEHAVIORAL_CHECKS, MODULES, ROUTING_CHECKS, buildCatalog, expandChecks, parseChecks, parseDimensions };
