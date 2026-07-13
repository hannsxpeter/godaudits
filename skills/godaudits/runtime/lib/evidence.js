'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EXCLUDED = new Set(['.git', '.godaudits', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', 'target']);
const TEXT_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.html', '.java', '.js', '.jsx', '.json', '.kt', '.md', '.mdx', '.php', '.prisma', '.py', '.rb', '.rs', '.scss', '.sh', '.sql', '.swift', '.toml', '.ts', '.tsx', '.vue', '.xml', '.yaml', '.yml']);
const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'Gemfile', 'pom.xml', 'mix.exs', 'Package.swift', 'composer.json']);
const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'uv.lock', 'go.sum', 'Cargo.lock', 'Gemfile.lock', 'composer.lock']);

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function redactSecrets(value) {
  let redacted = false;
  let text = String(value || '');
  const patterns = [
    /((?:secret|token|api[_-]?key|password)\s*[:=]\s*['"]?)([A-Za-z0-9_./+=-]{8,})/gi,
    /(Bearer\s+)([A-Za-z0-9._~+/=-]{8,})/gi
  ];
  for (const pattern of patterns) {
    text = text.replace(pattern, (_, prefix, secret) => {
      if (/^(?:process\.env\.|os\.environ|env\.)/i.test(secret)) return `${prefix}${secret}`;
      redacted = true;
      return `${prefix}<redacted:${hash(secret).slice(0, 12)}>`;
    });
  }
  return { text, redacted };
}

function walk(root, current = root, result = []) {
  const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (EXCLUDED.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, absolute, result);
    else if (entry.isFile()) result.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return result;
}

function gitCommit(root) {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'no-git';
  }
}

function languageFor(file) {
  const extension = path.extname(file).toLowerCase();
  return {
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.java': 'Java',
    '.kt': 'Kotlin', '.swift': 'Swift', '.php': 'PHP', '.cs': 'C#', '.sql': 'SQL'
  }[extension] || null;
}

function isProbablyText(buffer) {
  if (buffer.length === 0) return true;
  const limit = Math.max(1, Math.floor(buffer.length * 0.02));
  let controls = 0;
  for (const byte of buffer) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) {
      controls += 1;
      if (controls > limit) return false;
    }
  }
  return true;
}

function detectArchetype(files, contents) {
  const source = contents.join('\n');
  if (/\/api\/|createServer\(|express\(|FastAPI\(|Flask\(|http\.HandleFunc/.test(source)) {
    return { primary: 'api-service', confidence: 'Firm' };
  }
  if (files.some((file) => /(^|\/)(pages|app|src\/components)\//.test(file))) {
    return { primary: 'saas-dashboard', confidence: 'Firm' };
  }
  if (files.some((file) => /(^|\/)(bin|cli|cmd)\//.test(file))) return { primary: 'cli-tool', confidence: 'Firm' };
  return { primary: 'library', confidence: 'Tentative' };
}

function redactLine(line, match) {
  const secret = match[2] || match[1] || '';
  return line.replace(secret, `<redacted:${hash(secret).slice(0, 12)}>`);
}

const SIGNALS = [
  ['possible-secret', /(secret|token|password|client[_-]?secret|access[_-]?key|api[_-]?key|private[_-]?key)\s*[:=]\s*['"]?([^'"\s#;]{8,})/i, true],
  ['possible-private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, false],
  ['deferred-work', /\b(TODO|FIXME|HACK|XXX)\b/, false],
  ['empty-catch', /catch\s*(?:\([^)]*\))?\s*\{\s*\}/, false],
  ['dangerous-eval', /\b(eval|exec)\s*\(/, false],
  ['unsafe-html', /dangerouslySetInnerHTML|\binnerHTML\s*=|v-html=/, false],
  ['shell-execution', /child_process|subprocess\.(?:run|Popen)|Runtime\.getRuntime\(\)\.exec/, false],
  ['outbound-http', /\bfetch\s*\(|\b(?:axios|requests)\.[A-Za-z_]+\s*\(|\b(?:http|https)\.request\s*\(/, false],
  ['database-access', /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b|\b(prisma|sequelize|mongoose|sqlalchemy)\b/i, false],
  ['model-call', /\b(openai|anthropic|generateText|chat\.completions|messages\.create)\b/i, false],
  ['api-surface', /['"]\/api\/|\.(get|post|put|patch|delete)\s*\(\s*['"]\//, false]
];

function fingerprintRepository(root) {
  const absoluteRoot = path.resolve(root);
  const paths = walk(absoluteRoot);
  const files = [];
  const signals = [];
  const languages = {};
  const sourceContents = [];

  for (const relative of paths) {
    const absolute = path.join(absoluteRoot, relative);
    const stat = fs.statSync(absolute);
    if (stat.size > 1024 * 1024) {
      files.push({ path: relative, bytes: stat.size, sha256: null, skipped: 'larger than 1 MiB' });
      continue;
    }
    const extension = path.extname(relative).toLowerCase();
    const raw = fs.readFileSync(absolute);
    const looksText = isProbablyText(raw);
    const isText = TEXT_EXTENSIONS.has(extension) || MANIFESTS.has(path.basename(relative)) || LOCKFILES.has(path.basename(relative)) || looksText;
    if (!isText) {
      files.push({ path: relative, bytes: stat.size, sha256: hash(raw), binary: true });
      continue;
    }
    const content = raw.toString('utf8');
    const digest = hash(content);
    const lines = content.split(/\r?\n/);
    files.push({ path: relative, bytes: stat.size, lines: lines.length, sha256: digest });
    sourceContents.push(content);
    const language = languageFor(relative);
    if (language) languages[language] = (languages[language] || 0) + lines.length;
    for (let index = 0; index < lines.length; index += 1) {
      for (const [kind, pattern, sensitive] of SIGNALS) {
        const match = lines[index].match(pattern);
        if (!match) continue;
        signals.push({
          id: '',
          kind,
          path: relative,
          line: index + 1,
          quote: sensitive ? redactLine(lines[index].trim(), match).slice(0, 240) : lines[index].trim().slice(0, 240),
          sha256: digest,
          redacted: sensitive
        });
      }
    }
  }

  signals.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.kind.localeCompare(b.kind));
  signals.forEach((signal, index) => { signal.id = `S-${String(index + 1).padStart(4, '0')}`; });

  const hasCi = paths.some((file) => file.startsWith('.github/workflows/') || /(^|\/)(\.gitlab-ci\.yml|Jenkinsfile|azure-pipelines\.yml)$/.test(file));
  const hasTests = paths.some((file) => /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[^.]+$|_test\.go$/.test(file));
  const hasLockfile = paths.some((file) => LOCKFILES.has(path.basename(file)));
  const hasAgentInstructions = paths.some((file) => /(^|\/)(AGENTS\.md|CLAUDE\.md)$/.test(file));
  const absenceEvidence = [
    ['continuous-integration', hasCi, '.github/workflows/** or equivalent CI config'],
    ['test-suite', hasTests, 'test, tests, __tests__, *.test.*, *.spec.*, *_test.go'],
    ['dependency-lockfile', hasLockfile, [...LOCKFILES].sort().join(', ')],
    ['agent-instructions', hasAgentInstructions, 'AGENTS.md or CLAUDE.md']
  ].filter(([, present]) => !present).map(([subject, , scope], index) => ({
    id: `A-${String(index + 1).padStart(4, '0')}`,
    subject,
    query: scope,
    scope: 'repository file inventory',
    result_count: 0
  }));

  return {
    schema_version: '1.0',
    mode: 'static',
    root: path.basename(absoluteRoot),
    commit: gitCommit(absoluteRoot),
    archetype: detectArchetype(paths, sourceContents),
    manifests: paths.filter((file) => MANIFESTS.has(path.basename(file))),
    lockfiles: paths.filter((file) => LOCKFILES.has(path.basename(file))),
    languages,
    files,
    signals,
    absence_evidence: absenceEvidence,
    limitations: [
      'Static evidence only. No application code, tests, live systems, models, or network requests were executed.',
      'Regex signals are inventory leads, not findings. A domain evaluator must trace and refute them.'
    ],
    fingerprint_sha256: hash(JSON.stringify({ paths: files.map((file) => [file.path, file.sha256]), signals, absenceEvidence }))
  };
}

module.exports = { fingerprintRepository, redactSecrets };
