'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_HEADINGS = [
  'Scope',
  'Context',
  'Decisions',
  'Rules',
  'Workflows',
  'Watchouts',
  'Touchpoints',
  'Gaps'
];
const FLOOR_IDENTITIES = ['context', 'repo'];
const IDENTITY_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER_FIELDS = new Set([
  'pillar',
  'status',
  'always_load',
  'covers',
  'triggers',
  'must_read_with',
  'see_also'
]);
const BUDGETS = {
  always: { words: 1000, bytes: 8 * 1024 },
  routed: { words: 2000, bytes: 16 * 1024 },
  scope: { words: 2000, bytes: 16 * 1024 }
};
const MAX_DIRECTORIES = 20000;
const SKIPPED_DIRECTORIES = new Set([
  '.git', '.godaudits', '.next', 'build', 'coverage', 'dist', 'node_modules', 'target', 'vendor'
]);

class FindingCollector {
  constructor(root) {
    this.root = root;
    this.errors = [];
    this.warnings = [];
  }

  error(code, where, message, scope) {
    this.add('error', code, where, message, scope);
  }

  warn(code, where, message, scope) {
    this.add('warning', code, where, message, scope);
  }

  add(severity, code, where, message, scope) {
    const finding = {
      severity,
      code,
      path: displayPath(where, this.root),
      message
    };
    if (scope) finding.scope = scope;
    if (severity === 'error') this.errors.push(finding);
    else this.warnings.push(finding);
  }
}

function normalizeSelector(value) {
  if (typeof value !== 'string') return '';
  let lowered = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    lowered += code >= 65 && code <= 90
      ? String.fromCharCode(code + 32)
      : character;
  }
  return lowered.replace(/[^a-z0-9]+/g, ' ').trim().replace(/ +/g, ' ');
}

function selectorMatches(task, selector) {
  const taskTokens = normalizeSelector(task).split(' ').filter(Boolean);
  const selectorTokens = normalizeSelector(selector).split(' ').filter(Boolean);
  if (selectorTokens.length === 0 || selectorTokens.length > taskTokens.length) return false;
  for (let index = 0; index <= taskTokens.length - selectorTokens.length; index += 1) {
    const candidate = taskTokens.slice(index, index + selectorTokens.length);
    if (candidate.every((token, offset) => token === selectorTokens[offset])) return true;
  }
  return false;
}

function validIdentity(identity) {
  if (typeof identity !== 'string') return false;
  const segments = identity.split('/');
  return segments.length >= 1
    && segments.length <= 2
    && segments.every((segment) => IDENTITY_SEGMENT.test(segment));
}

function splitFrontmatter(text) {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { frontmatter: null, body: text };
  return { frontmatter: match[1], body: match[2] };
}

function parseYaml(raw) {
  const lines = prepareYamlLines(raw);
  if (lines.length === 0) return null;
  const parsed = parseYamlBlock(lines, 0, lines[0].indent);
  if (parsed.next !== lines.length) {
    throw yamlError(lines[parsed.next], 'unexpected indentation');
  }
  return parsed.value;
}

function prepareYamlLines(raw) {
  const lines = [];
  String(raw).split(/\r?\n/).forEach((source, index) => {
    if (/^\t+/.test(source) || /^ +\t/.test(source)) {
      throw new Error(`line ${index + 1}: tabs are not valid indentation`);
    }
    const withoutComment = stripYamlComment(source).replace(/[ \t]+$/, '');
    if (!withoutComment.trim() || /^\s*(?:---|\.\.\.)\s*$/.test(withoutComment)) return;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    lines.push({ indent, content: withoutComment.trimStart(), number: index + 1 });
  });
  return lines;
}

function stripYamlComment(source) {
  let quote = null;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[' || character === '{') {
      depth += 1;
    } else if (character === ']' || character === '}') {
      depth -= 1;
    } else if (character === '#' && depth === 0 && (index === 0 || /\s/.test(source[index - 1]))) {
      return source.slice(0, index);
    }
  }
  return source;
}

function parseYamlBlock(lines, start, indent) {
  if (lines[start].indent !== indent) throw yamlError(lines[start], 'unexpected indentation');
  return lines[start].content === '-' || lines[start].content.startsWith('- ')
    ? parseYamlSequence(lines, start, indent)
    : parseYamlMapping(lines, start, indent);
}

function parseYamlMapping(lines, start, indent) {
  const value = {};
  let index = start;
  while (index < lines.length && lines[index].indent === indent) {
    const line = lines[index];
    if (line.content === '-' || line.content.startsWith('- ')) break;
    const pair = splitYamlPair(line.content, line);
    if (Object.prototype.hasOwnProperty.call(value, pair.key)) {
      throw yamlError(line, `duplicate key '${pair.key}'`);
    }
    if (pair.rawValue === '') {
      if (index + 1 < lines.length && lines[index + 1].indent > indent) {
        const child = parseYamlBlock(lines, index + 1, lines[index + 1].indent);
        value[pair.key] = child.value;
        index = child.next;
      } else {
        value[pair.key] = null;
        index += 1;
      }
    } else {
      value[pair.key] = parseYamlScalar(pair.rawValue, line);
      index += 1;
    }
    if (index < lines.length && lines[index].indent > indent) {
      throw yamlError(lines[index], 'unexpected nested content');
    }
  }
  return { value, next: index };
}

function parseYamlSequence(lines, start, indent) {
  const value = [];
  let index = start;
  while (index < lines.length && lines[index].indent === indent) {
    const line = lines[index];
    if (!(line.content === '-' || line.content.startsWith('- '))) break;
    const content = line.content === '-' ? '' : line.content.slice(2).trim();
    if (content === '') {
      if (index + 1 >= lines.length || lines[index + 1].indent <= indent) {
        value.push(null);
        index += 1;
      } else {
        const child = parseYamlBlock(lines, index + 1, lines[index + 1].indent);
        value.push(child.value);
        index = child.next;
      }
      continue;
    }
    if (looksLikeYamlPair(content)) {
      const pair = splitYamlPair(content, line);
      const item = {};
      if (pair.rawValue === '') {
        if (index + 1 < lines.length && lines[index + 1].indent > indent) {
          const child = parseYamlBlock(lines, index + 1, lines[index + 1].indent);
          item[pair.key] = child.value;
          index = child.next;
        } else {
          item[pair.key] = null;
          index += 1;
        }
      } else {
        item[pair.key] = parseYamlScalar(pair.rawValue, line);
        index += 1;
      }
      if (index < lines.length && lines[index].indent > indent) {
        const continuation = parseYamlMapping(lines, index, lines[index].indent);
        for (const [key, entry] of Object.entries(continuation.value)) {
          if (Object.prototype.hasOwnProperty.call(item, key)) {
            throw yamlError(lines[index], `duplicate key '${key}'`);
          }
          item[key] = entry;
        }
        index = continuation.next;
      }
      value.push(item);
    } else {
      value.push(parseYamlScalar(content, line));
      index += 1;
      if (index < lines.length && lines[index].indent > indent) {
        throw yamlError(lines[index], 'scalar list item cannot have nested content');
      }
    }
  }
  return { value, next: index };
}

function looksLikeYamlPair(value) {
  return /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(value);
}

function splitYamlPair(value, line) {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/.exec(value);
  if (!match) throw yamlError(line, 'expected a mapping key followed by a colon');
  return { key: match[1], rawValue: match[2].trim() };
}

function parseYamlScalar(raw, line) {
  if (raw === '[]') return [];
  if (raw === '{}') return {};
  if (raw.startsWith('[')) {
    if (!raw.endsWith(']')) throw yamlError(line, 'unterminated flow sequence');
    const content = raw.slice(1, -1).trim();
    return content ? splitFlowItems(content, line).map((item) => parseYamlScalar(item, line)) : [];
  }
  if (raw.startsWith('{')) {
    if (!raw.endsWith('}')) throw yamlError(line, 'unterminated flow mapping');
    const output = {};
    for (const item of splitFlowItems(raw.slice(1, -1), line)) {
      const pair = splitYamlPair(item, line);
      if (Object.prototype.hasOwnProperty.call(output, pair.key)) {
        throw yamlError(line, `duplicate key '${pair.key}'`);
      }
      output[pair.key] = parseYamlScalar(pair.rawValue, line);
    }
    return output;
  }
  if (raw.startsWith('"') || raw.startsWith("'")) return parseQuotedScalar(raw, line);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?(?:0|[1-9][0-9]*)$/.test(raw)) return Number(raw);
  return raw;
}

function splitFlowItems(content, line) {
  const items = [];
  let quote = null;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quote) {
      if (character === quote && content[index - 1] !== '\\') quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[' || character === '{') {
      depth += 1;
    } else if (character === ']' || character === '}') {
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      items.push(content.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quote || depth !== 0) throw yamlError(line, 'unbalanced flow collection');
  items.push(content.slice(start).trim());
  if (items.some((item) => !item)) throw yamlError(line, 'empty flow collection item');
  return items;
}

function parseQuotedScalar(raw, line) {
  if (raw[0] === '"') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw yamlError(line, `invalid double-quoted string: ${error.message}`);
    }
  }
  if (!raw.endsWith("'")) throw yamlError(line, 'unterminated single-quoted string');
  return raw.slice(1, -1).replace(/''/g, "'");
}

function yamlError(line, message) {
  return new Error(`line ${line.number}: ${message}`);
}

function discoverScopeRoots(root, options = {}) {
  const projectRoot = path.resolve(root);
  const scopes = [];
  const result = walkDirectories(projectRoot, (directory) => {
    if (isFile(path.join(directory, 'AGENTS.md')) && isDirectory(path.join(directory, 'agents'))) {
      scopes.push(directory);
    }
  }, options.maxDirectories);
  if (result.truncated && options.collector) {
    options.collector.error(
      'directory-budget-exceeded',
      projectRoot,
      `scope discovery stopped after ${result.visited} directories`,
      'root'
    );
  }
  return scopes.sort((left, right) => {
    const leftDepth = relativeSegments(projectRoot, left).length;
    const rightDepth = relativeSegments(projectRoot, right).length;
    return leftDepth - rightDepth || compareStrings(toPosix(left), toPosix(right));
  });
}

function findApplicableScopes(projectRoot, target, knownScopes) {
  const root = path.resolve(projectRoot);
  const targetPath = resolveTarget(root, target);
  const directory = isDirectory(targetPath) ? targetPath : path.dirname(targetPath);
  const scopes = knownScopes || discoverScopeRoots(root);
  return scopes.filter((scope) => containsPath(scope, directory)).sort((left, right) => {
    const leftDepth = relativeSegments(root, left).length;
    const rightDepth = relativeSegments(root, right).length;
    return leftDepth - rightDepth || compareStrings(toPosix(left), toPosix(right));
  });
}

function validateScope(scopeRoot, options = {}) {
  const root = path.resolve(options.projectRoot || scopeRoot);
  const scope = path.resolve(scopeRoot);
  const collector = options.collector || new FindingCollector(root);
  const label = scopeLabel(root, scope);
  const agentsFile = path.join(scope, 'AGENTS.md');
  const agentsDirectory = path.join(scope, 'agents');
  if (!isFile(agentsFile)) {
    collector.error('missing-agents-file', scope, 'AGENTS.md not found at scope root', label);
  }
  if (!isDirectory(agentsDirectory)) {
    collector.error('missing-agents-directory', scope, 'agents directory not found at scope root', label);
    return emptyScopeModel(scope, label, collector);
  }

  const exclusions = isFile(agentsFile)
    ? parseExclusions(agentsFile, collector, label)
    : new Map();
  const records = collectFiles(agentsDirectory, (file) => file.endsWith('.md'), {
    collector,
    scope: label,
    maxDirectories: options.maxDirectories
  })
    .map((file) => validatePillar(file, agentsDirectory, collector, label))
    .filter(Boolean);
  const pillars = indexPillars(records, collector, label);
  const catalog = parseCatalog(path.join(agentsDirectory, 'catalog.yaml'), collector, label);
  validateConflicts(pillars, exclusions, catalog, agentsFile, agentsDirectory, collector, label);
  validateFloor(pillars, exclusions, catalog, agentsFile, agentsDirectory, collector, label);
  validateReferences(records, pillars, exclusions, catalog, collector, label);
  validateScopeBudget(records, scope, collector, label);
  return { root: scope, label, pillars, exclusions, catalog, records, collector };
}

function emptyScopeModel(root, label, collector) {
  return {
    root,
    label,
    pillars: new Map(),
    exclusions: new Map(),
    catalog: new Map(),
    records: [],
    collector
  };
}

function validatePillar(file, agentsDirectory, collector, scope) {
  const where = file;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    collector.error('pillar-read-failed', where, error.message, scope);
    return null;
  }
  const split = splitFrontmatter(text);
  if (split.frontmatter === null) {
    collector.error('missing-frontmatter', where, 'no YAML frontmatter block', scope);
    return null;
  }
  let frontmatter;
  try {
    frontmatter = parseYaml(split.frontmatter) || {};
  } catch (error) {
    collector.error('invalid-frontmatter', where, `unparseable frontmatter: ${error.message}`, scope);
    return null;
  }
  if (!isPlainObject(frontmatter)) {
    collector.error('invalid-frontmatter', where, 'frontmatter must be a mapping', scope);
    return null;
  }
  for (const field of Object.keys(frontmatter).sort()) {
    if (!FRONTMATTER_FIELDS.has(field)) {
      collector.warn('unknown-frontmatter-field', where, `unknown frontmatter field '${field}'`, scope);
    }
  }

  const identity = toPosix(path.relative(agentsDirectory, file)).replace(/\.md$/, '');
  if (!validIdentity(identity)) {
    collector.error(
      'invalid-identity',
      where,
      `path-derived identity '${identity}' is invalid or nested too deeply`,
      scope
    );
  }
  const stem = path.basename(file, '.md');
  const pillar = frontmatter.pillar;
  if (typeof pillar !== 'string' || !pillar) {
    collector.error('missing-pillar-name', where, "field 'pillar' must be a non-empty string", scope);
  } else if (pillar !== stem) {
    collector.error(
      'pillar-name-mismatch',
      where,
      `pillar '${pillar}' does not match filename '${stem}'`,
      scope
    );
  }

  const alwaysLoad = typeof frontmatter.always_load === 'undefined'
    ? false
    : frontmatter.always_load;
  if (typeof alwaysLoad !== 'boolean') {
    collector.error('invalid-always-load', where, "field 'always_load' must be a boolean", scope);
  }
  const effectiveAlwaysLoad = typeof alwaysLoad === 'boolean' ? alwaysLoad : false;
  const status = typeof frontmatter.status === 'undefined' ? 'present' : frontmatter.status;
  if (status !== 'present' && status !== 'stub') {
    collector.error('invalid-status', where, "field 'status' must be 'present' or 'stub'", scope);
  }
  const covers = validateSelectorList(frontmatter.covers, 'covers', where, collector, scope, true);
  const triggers = validateSelectorList(
    frontmatter.triggers,
    'triggers',
    where,
    collector,
    scope,
    !effectiveAlwaysLoad
  );
  const mustReadWith = validateReferenceList(
    frontmatter.must_read_with,
    'must_read_with',
    identity,
    where,
    collector,
    scope
  );
  const seeAlso = validateReferenceList(
    frontmatter.see_also,
    'see_also',
    identity,
    where,
    collector,
    scope
  );
  if (mustReadWith.length > 3) {
    collector.warn(
      'dependency-boundary-smell',
      where,
      `must_read_with has ${mustReadWith.length} entries; more than 3 is a boundary smell`,
      scope
    );
  }
  validateHeadings(split.body, where, collector, scope);
  const words = countWords(text);
  const bytes = Buffer.byteLength(text, 'utf8');
  validatePillarBudget(effectiveAlwaysLoad, words, bytes, where, collector, scope);
  return {
    identity,
    pillar: typeof pillar === 'string' && pillar ? pillar : stem,
    path: file,
    status: status === 'stub' ? 'stub' : 'present',
    alwaysLoad: effectiveAlwaysLoad,
    covers,
    triggers,
    mustReadWith,
    seeAlso,
    words,
    bytes
  };
}

function validateSelectorList(value, field, where, collector, scope, required) {
  const values = validateStringList(value, field, where, collector, scope, required);
  const output = [];
  const seen = new Map();
  values.forEach((item, index) => {
    const normalized = normalizeSelector(item);
    if (!normalized) {
      collector.error(
        'empty-selector',
        where,
        `field '${field}' item ${index} has no portable matcher tokens`,
        scope
      );
    } else if (seen.has(normalized)) {
      collector.error(
        'duplicate-selector',
        where,
        `field '${field}' has duplicate selectors '${seen.get(normalized)}' and '${item}'`,
        scope
      );
    } else {
      seen.set(normalized, item);
      output.push(item);
    }
  });
  return output;
}

function validateReferenceList(value, field, identity, where, collector, scope) {
  const values = validateStringList(value, field, where, collector, scope, false);
  const output = [];
  const seen = new Set();
  values.forEach((item) => {
    if (seen.has(item)) {
      collector.error(
        'duplicate-reference',
        where,
        `field '${field}' has duplicate reference '${item}'`,
        scope
      );
      return;
    }
    seen.add(item);
    output.push(item);
    if (!validIdentity(item)) {
      collector.error('invalid-reference', where, `field '${field}' has invalid identity '${item}'`, scope);
    }
    if (item === identity) {
      collector.error(
        'self-reference',
        where,
        `field '${field}' contains a self-reference to '${item}'`,
        scope
      );
    }
  });
  return output;
}

function validateStringList(value, field, where, collector, scope, required) {
  if (typeof value === 'undefined' || value === null) {
    if (required) collector.error('missing-list', where, `field '${field}' is required`, scope);
    return [];
  }
  if (!Array.isArray(value)) {
    collector.error('invalid-list', where, `field '${field}' must be a list`, scope);
    return [];
  }
  if (required && value.length === 0) {
    collector.error('empty-list', where, `field '${field}' must contain at least one item`, scope);
  }
  const output = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      collector.error(
        'invalid-list-item',
        where,
        `field '${field}' item ${index} must be a non-empty string`,
        scope
      );
    } else {
      output.push(item);
    }
  });
  return output;
}

function validateHeadings(body, where, collector, scope) {
  const headings = [];
  const pattern = /^##(?!#)[ \t]+(.+?)[ \t]*\r?$/gm;
  let match;
  while ((match = pattern.exec(body)) !== null) headings.push(match[1].trim());
  if (headings.length !== REQUIRED_HEADINGS.length
      || headings.some((heading, index) => heading !== REQUIRED_HEADINGS[index])) {
    collector.error(
      'invalid-headings',
      where,
      `level-2 headings must be exactly: ${REQUIRED_HEADINGS.join(', ')}`,
      scope
    );
  }
}

function validatePillarBudget(alwaysLoad, words, bytes, where, collector, scope) {
  const category = alwaysLoad ? 'always' : 'routed';
  const budget = BUDGETS[category];
  const label = alwaysLoad ? 'always-loaded' : 'task-routed';
  if (words > budget.words) {
    collector.warn(
      'pillar-word-budget',
      where,
      `${words} words exceeds the recommended ${budget.words}-word ${label} budget`,
      scope
    );
  }
  if (bytes > budget.bytes) {
    collector.warn(
      'pillar-byte-budget',
      where,
      `${bytes} bytes exceeds the recommended ${budget.bytes}-byte ${label} budget`,
      scope
    );
  }
}

function parseExclusions(agentsFile, collector, scope) {
  const text = fs.readFileSync(agentsFile, 'utf8');
  const fences = [...text.matchAll(/```ya?ml[ \t]*\r?\n([\s\S]*?)```/g)];
  const fence = fences.find((candidate) => /^\s*excluded\s*:/m.test(candidate[1]));
  if (!fence) {
    collector.error('missing-exclusions', agentsFile, 'no YAML excluded block found', scope);
    return new Map();
  }
  let data;
  try {
    data = parseYaml(fence[1]);
  } catch (error) {
    collector.error('invalid-exclusions', agentsFile, `excluded block is invalid: ${error.message}`, scope);
    return new Map();
  }
  if (!isPlainObject(data) || !Array.isArray(data.excluded)) {
    collector.error('invalid-exclusions', agentsFile, 'excluded must be a YAML list', scope);
    return new Map();
  }
  const exclusions = new Map();
  data.excluded.forEach((item, index) => {
    let identity;
    let reason;
    if (typeof item === 'string') {
      identity = item;
    } else if (isPlainObject(item) && typeof item.name === 'string') {
      identity = item.name;
      reason = item.reason;
      if (typeof reason !== 'undefined' && (typeof reason !== 'string' || !reason.trim())) {
        collector.error(
          'invalid-exclusion-reason',
          agentsFile,
          `excluded item ${index} reason must be a non-empty string`,
          scope
        );
      }
    } else {
      collector.error(
        'invalid-exclusion',
        agentsFile,
        `excluded item ${index} must be a string or name/reason mapping`,
        scope
      );
      return;
    }
    if (!validIdentity(identity)) {
      collector.error('invalid-identity', agentsFile, `excluded identity '${identity}' is invalid`, scope);
    }
    if (exclusions.has(identity)) {
      collector.error('duplicate-exclusion', agentsFile, `excluded identity '${identity}' is duplicated`, scope);
      return;
    }
    if (typeof reason === 'undefined') {
      collector.warn(
        'exclusion-without-reason',
        agentsFile,
        `excluded identity '${identity}' has no reason`,
        scope
      );
    }
    exclusions.set(identity, reason);
  });
  return exclusions;
}

function parseCatalog(catalogFile, collector, scope) {
  if (!isFile(catalogFile)) return new Map();
  let data;
  try {
    data = parseYaml(fs.readFileSync(catalogFile, 'utf8'));
  } catch (error) {
    collector.error('invalid-catalog', catalogFile, `catalog is invalid: ${error.message}`, scope);
    return new Map();
  }
  if (!isPlainObject(data)) {
    collector.error('invalid-catalog', catalogFile, 'catalog must be a mapping', scope);
    return new Map();
  }
  if (data.version !== 1) {
    collector.error('invalid-catalog-version', catalogFile, 'catalog version must be 1', scope);
  }
  if (!Array.isArray(data.absent)) {
    collector.error('invalid-catalog', catalogFile, 'catalog absent must be a list', scope);
    return new Map();
  }
  const catalog = new Map();
  data.absent.forEach((item, index) => {
    const itemWhere = `${catalogFile}#absent-${index}`;
    if (!isPlainObject(item)) {
      collector.error('invalid-catalog-entry', itemWhere, 'entry must be a mapping', scope);
      return;
    }
    const identity = item.identity;
    if (!validIdentity(identity)) {
      collector.error('invalid-identity', itemWhere, `catalog identity '${identity}' is invalid`, scope);
      return;
    }
    if (catalog.has(identity)) {
      collector.error('duplicate-catalog-entry', itemWhere, `identity '${identity}' is duplicated`, scope);
      return;
    }
    const covers = validateSelectorList(item.covers, 'covers', itemWhere, collector, scope, false);
    const triggers = validateSelectorList(item.triggers, 'triggers', itemWhere, collector, scope, true);
    catalog.set(identity, { identity, covers, triggers });
  });
  return catalog;
}

function indexPillars(records, collector, scope) {
  const pillars = new Map();
  const portable = new Map();
  for (const record of records) {
    if (pillars.has(record.identity)) {
      collector.error(
        'duplicate-identity',
        record.path,
        `duplicate path-derived identity '${record.identity}'`,
        scope
      );
    } else {
      pillars.set(record.identity, record);
    }
    const key = asciiLower(record.identity);
    if (portable.has(key) && portable.get(key).identity !== record.identity) {
      collector.error(
        'portable-identity-conflict',
        record.path,
        `identity '${record.identity}' conflicts with '${portable.get(key).identity}'`,
        scope
      );
    } else {
      portable.set(key, record);
    }
  }
  return pillars;
}

function validateConflicts(pillars, exclusions, catalog, agentsFile, agentsDirectory, collector, scope) {
  for (const identity of sortedIntersection(pillars, exclusions)) {
    collector.error(
      'present-excluded-conflict',
      agentsFile,
      `identity '${identity}' is both present and excluded`,
      scope
    );
  }
  for (const identity of sortedIntersection(pillars, catalog)) {
    collector.error(
      'present-absent-conflict',
      path.join(agentsDirectory, 'catalog.yaml'),
      `identity '${identity}' is both present and cataloged as absent`,
      scope
    );
  }
  for (const identity of sortedIntersection(exclusions, catalog)) {
    collector.error(
      'excluded-absent-conflict',
      path.join(agentsDirectory, 'catalog.yaml'),
      `identity '${identity}' is both excluded and cataloged as absent`,
      scope
    );
  }
}

function validateFloor(pillars, exclusions, catalog, agentsFile, agentsDirectory, collector, scope) {
  for (const identity of FLOOR_IDENTITIES) {
    if (catalog.has(identity)) {
      collector.error(
        'floor-catalog-conflict',
        path.join(agentsDirectory, 'catalog.yaml'),
        `floor identity '${identity}' cannot be cataloged as absent`,
        scope
      );
    }
    if (!pillars.has(identity)) {
      if (exclusions.has(identity)) {
        collector.warn(
          'floor-excluded',
          agentsFile,
          `floor pillar '${identity}' is explicitly excluded`,
          scope
        );
      } else {
        collector.error(
          'missing-floor',
          agentsDirectory,
          `floor pillar '${identity}.md' is missing and not excluded`,
          scope
        );
      }
    } else if (!pillars.get(identity).alwaysLoad) {
      collector.error(
        'floor-not-always-loaded',
        pillars.get(identity).path,
        'floor pillar must declare always_load: true',
        scope
      );
    }
  }
}

function validateReferences(records, pillars, exclusions, catalog, collector, scope) {
  const subpillarsByLeaf = new Map();
  for (const identity of pillars.keys()) {
    if (!identity.includes('/')) continue;
    const leaf = identity.split('/').pop();
    if (!subpillarsByLeaf.has(leaf)) subpillarsByLeaf.set(leaf, []);
    subpillarsByLeaf.get(leaf).push(identity);
  }
  for (const record of records) {
    for (const [field, references] of [
      ['must_read_with', record.mustReadWith],
      ['see_also', record.seeAlso]
    ]) {
      for (const reference of references) {
        const catalogAllowed = field === 'see_also' && catalog.has(reference);
        if (pillars.has(reference) || exclusions.has(reference) || catalogAllowed) continue;
        let message = `${field} reference '${reference}' is neither present nor excluded`;
        if (!reference.includes('/') && subpillarsByLeaf.has(reference)) {
          const matches = subpillarsByLeaf.get(reference).sort();
          message = matches.length === 1
            ? `bare reference '${reference}' does not resolve sub-pillars; use '${matches[0]}'`
            : `bare reference '${reference}' is ambiguous; use one of: ${matches.join(', ')}`;
        }
        collector.error('dangling-reference', record.path, message, scope);
      }
    }
  }
}

function validateScopeBudget(records, scopeRoot, collector, scope) {
  const alwaysRecords = records.filter((record) => record.alwaysLoad);
  const words = alwaysRecords.reduce((total, record) => total + record.words, 0);
  const bytes = alwaysRecords.reduce((total, record) => total + record.bytes, 0);
  if (words > BUDGETS.scope.words) {
    collector.warn(
      'scope-word-budget',
      scopeRoot,
      `${words} always-loaded words exceeds the recommended ${BUDGETS.scope.words}-word scope budget`,
      scope
    );
  }
  if (bytes > BUDGETS.scope.bytes) {
    collector.warn(
      'scope-byte-budget',
      scopeRoot,
      `${bytes} always-loaded bytes exceeds the recommended ${BUDGETS.scope.bytes}-byte scope budget`,
      scope
    );
  }
}

function computeScopeLoad(model, task) {
  const selected = new Set();
  const primaries = new Set();
  const absent = new Set();
  const reasons = new Map();
  for (const [identity, record] of sortedMapEntries(model.pillars)) {
    if (record.alwaysLoad) {
      selected.add(identity);
      addReason(reasons, identity, 'always-loaded');
      continue;
    }
    const matches = record.triggers.filter((trigger) => selectorMatches(task, trigger));
    if (matches.length === 0) continue;
    selected.add(identity);
    primaries.add(identity);
    for (const trigger of matches) addReason(reasons, identity, `trigger: ${trigger}`);
  }
  for (const [identity, entry] of sortedMapEntries(model.catalog)) {
    if (entry.triggers.some((trigger) => selectorMatches(task, trigger))) absent.add(identity);
  }
  for (const identity of [...primaries].sort()) {
    for (const reference of model.pillars.get(identity).mustReadWith) {
      if (!model.pillars.has(reference)) continue;
      selected.add(reference);
      addReason(reasons, reference, `must_read_with from ${identity}`);
    }
  }
  for (const identity of [...selected].sort()) {
    const record = model.pillars.get(identity);
    for (const reference of record.seeAlso) {
      const target = model.pillars.get(reference) || model.catalog.get(reference);
      if (!target) continue;
      const selectors = [reference, ...target.triggers, ...target.covers];
      if (!selectors.some((selector) => selectorMatches(task, selector))) continue;
      if (model.pillars.has(reference)) {
        selected.add(reference);
        addReason(reasons, reference, `see_also from ${identity}`);
      } else {
        absent.add(reference);
      }
    }
  }
  const load = [...selected].sort();
  return {
    load,
    primaries: [...primaries].sort(),
    absent: [...absent].sort(),
    stubs: load.filter((identity) => model.pillars.get(identity).status === 'stub'),
    reasons: Object.fromEntries(
      [...reasons.entries()].sort(([left], [right]) => compareStrings(left, right))
    )
  };
}

function computeNestedLoad(projectRoot, models, task, target) {
  const applicableRoots = findApplicableScopes(
    projectRoot,
    target,
    models.map((model) => model.root)
  );
  const byRoot = new Map(models.map((model) => [model.root, model]));
  const applicable = applicableRoots.map((root) => byRoot.get(root)).filter(Boolean);
  const scopeRoutes = applicable.map((model) => ({ model, route: computeScopeLoad(model, task) }));
  const load = [];
  const primaries = [];
  const absent = [];
  const stubs = [];
  const reasons = {};
  const details = [];
  for (let index = 0; index < scopeRoutes.length; index += 1) {
    const { model, route } = scopeRoutes[index];
    const descendantExclusions = new Set();
    for (const descendant of scopeRoutes.slice(index + 1)) {
      for (const identity of descendant.model.exclusions.keys()) descendantExclusions.add(identity);
    }
    for (const identity of route.load) {
      const record = model.pillars.get(identity);
      if (!record.alwaysLoad && descendantExclusions.has(identity)) continue;
      const qualified = `${model.label}::${identity}`;
      load.push(qualified);
      reasons[qualified] = route.reasons[identity] || [];
      details.push({
        qualified,
        scope: model.label,
        identity,
        status: record.status,
        always_load: record.alwaysLoad,
        path: displayPath(record.path, projectRoot),
        reasons: reasons[qualified]
      });
      if (record.status === 'stub') stubs.push(qualified);
    }
    primaries.push(...route.primaries.map((identity) => `${model.label}::${identity}`));
    absent.push(...route.absent.map((identity) => `${model.label}::${identity}`));
  }
  const winners = {};
  for (const detail of details) winners[detail.identity] = detail.qualified;
  for (const detail of details) detail.effective = winners[detail.identity] === detail.qualified;
  return {
    load,
    primaries,
    absent,
    stubs,
    reasons,
    winners,
    details,
    applicable_scopes: applicable.map((model) => model.label)
  };
}

function analyzePillars(root, options = {}) {
  const projectRoot = path.resolve(root);
  if (!isDirectory(projectRoot)) throw new Error(`Pillars project root does not exist: ${projectRoot}`);
  const task = typeof options.task === 'undefined' ? '' : options.task;
  if (typeof task !== 'string') throw new TypeError('Pillars task must be a string');
  const target = typeof options.target === 'undefined' ? '.' : options.target;
  if (typeof target !== 'string' || !target) throw new TypeError('Pillars target must be a non-empty string');
  const targetPath = resolveTarget(projectRoot, target);
  const collector = new FindingCollector(projectRoot);
  let scopeRoots = discoverScopeRoots(projectRoot, {
    collector,
    maxDirectories: options.maxDirectories
  });
  if (!scopeRoots.includes(projectRoot)) scopeRoots = [projectRoot, ...scopeRoots];
  const models = scopeRoots.map((scope) => validateScope(scope, {
    projectRoot,
    collector,
    maxDirectories: options.maxDirectories
  }));
  const completeModels = models.filter((model) => (
    isFile(path.join(model.root, 'AGENTS.md')) && isDirectory(path.join(model.root, 'agents'))
  ));
  const routing = computeNestedLoad(projectRoot, completeModels, task, targetPath);
  return {
    standard: 'Pillars',
    version: '1.1.0',
    present: true,
    root: '.',
    target: displayPath(targetPath, projectRoot),
    task,
    compatible: collector.errors.length === 0,
    scopes: models.map((model) => summarizeScope(model, projectRoot)),
    routing,
    findings: [...collector.errors, ...collector.warnings],
    errors: collector.errors,
    warnings: collector.warnings
  };
}

function summarizeScope(model, projectRoot) {
  return {
    label: model.label,
    root: displayPath(model.root, projectRoot),
    pillars: [...model.pillars.keys()].sort(),
    excluded: [...model.exclusions.keys()].sort(),
    absent: [...model.catalog.keys()].sort(),
    always_loaded: [...model.pillars.entries()]
      .filter(([, record]) => record.alwaysLoad)
      .map(([identity]) => identity)
      .sort()
  };
}

function resolveTarget(root, target) {
  const resolved = path.resolve(root, target);
  if (!containsPath(root, resolved)) throw new Error(`Pillars target is outside project root: ${target}`);
  return resolved;
}

function containsPath(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function scopeLabel(projectRoot, scopeRoot) {
  const relative = toPosix(path.relative(projectRoot, scopeRoot));
  return relative && relative !== '.' ? relative : 'root';
}

function walkDirectories(root, visit, maxDirectories = MAX_DIRECTORIES) {
  const queue = [root];
  let visited = 0;
  while (queue.length > 0) {
    if (visited >= maxDirectories) return { visited, truncated: true };
    const directory = queue.shift();
    visited += 1;
    visit(directory);
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    const children = entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .filter((entry) => !SKIPPED_DIRECTORIES.has(entry.name))
      .map((entry) => path.join(directory, entry.name))
      .sort((left, right) => compareStrings(toPosix(left), toPosix(right)));
    queue.push(...children);
  }
  return { visited, truncated: false };
}

function collectFiles(root, predicate, options = {}) {
  const files = [];
  const result = walkDirectories(root, (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && predicate(entry.name)) files.push(path.join(directory, entry.name));
    }
  }, options.maxDirectories);
  if (result.truncated && options.collector) {
    options.collector.error(
      'directory-budget-exceeded',
      root,
      `pillar discovery stopped after ${result.visited} directories`,
      options.scope
    );
  }
  return files.sort((left, right) => compareStrings(toPosix(left), toPosix(right)));
}

function relativeSegments(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && relative !== '.' ? relative.split(path.sep) : [];
}

function displayPath(candidate, root) {
  const value = String(candidate);
  const anchorIndex = value.indexOf('#');
  const file = anchorIndex === -1 ? value : value.slice(0, anchorIndex);
  const anchor = anchorIndex === -1 ? '' : value.slice(anchorIndex);
  const relative = path.relative(root, path.resolve(file));
  return `${toPosix(relative && relative !== '.' ? relative : '.')}${anchor}`;
}

function countWords(text) {
  const matches = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

function addReason(reasons, identity, reason) {
  if (!reasons.has(identity)) reasons.set(identity, []);
  if (!reasons.get(identity).includes(reason)) reasons.get(identity).push(reason);
}

function sortedMapEntries(map) {
  return [...map.entries()].sort(([left], [right]) => compareStrings(left, right));
}

function compareStrings(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function sortedIntersection(left, right) {
  return [...left.keys()].filter((identity) => right.has(identity)).sort();
}

function asciiLower(value) {
  return value.replace(/[A-Z]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 32));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch (error) {
    return false;
  }
}

function isDirectory(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch (error) {
    return false;
  }
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

module.exports = {
  BUDGETS,
  FLOOR_IDENTITIES,
  MAX_DIRECTORIES,
  REQUIRED_HEADINGS,
  analyzePillars,
  computeNestedLoad,
  computeScopeLoad,
  discoverScopeRoots,
  findApplicableScopes,
  normalizeSelector,
  parseYaml,
  selectorMatches,
  splitFrontmatter,
  validIdentity,
  validateScope
};
