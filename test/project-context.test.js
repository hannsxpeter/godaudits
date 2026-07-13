'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const catalog = require('../skills/godaudits/catalog/project-context.json');
const { analyzeProjectContext, validateProjectContextCatalog } = require('../skills/godaudits/runtime/lib/project-context');
const cases = require('./fixtures/project-context/cases.json');

function analyze(name) {
  const fixture = cases[name];
  return analyzeProjectContext(path.join('/virtual', name), fixture.paths, fixture.contents);
}

function git(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

test('context catalog preserves all arc-ready forms and 37 profiles', () => {
  assert.deepEqual(
    catalog.forms.map((form) => form.id),
    ['web-application', 'api-service', 'cli-sdk', 'mobile-desktop', 'data-ml', 'infrastructure-iac']
  );
  assert.equal(catalog.profiles.length, 37);
  assert.equal(new Set(catalog.profiles.map((profile) => profile.id)).size, 37);
  assert.equal(new Set(catalog.profiles.map((profile) => profile.slug)).size, 37);
  assert.ok(catalog.profiles.every((profile) => profile.roles.length > 0 && profile.signals.length >= 5));
});

for (const form of catalog.forms) {
  test(`detects ${form.id} from multiple independent signals`, () => {
    const result = analyze(form.id);
    assert.equal(result.project_forms.primary.id, form.id);
    assert.notEqual(result.project_forms.primary.confidence, 'Tentative');
    assert.ok(new Set(result.project_forms.primary.evidence.map((entry) => entry.signal_id)).size >= 2);
  });
}

test('keeps a primary form, secondary forms, and product archetype independent', () => {
  const result = analyze('hybrid-healthcare-platform');
  assert.equal(result.project_forms.primary.id, 'api-service');
  assert.deepEqual(
    result.project_forms.secondary.map((candidate) => candidate.id),
    ['web-application', 'cli-sdk']
  );
  assert.equal(result.product_archetype.primary.slug, 'developer-platform-api-sdk');
  assert.ok(result.product_archetype.candidates.some((candidate) => candidate.slug === 'saas-multitenant'));
  assert.ok(result.industry_overlays.some((candidate) => candidate.slug === 'healthcare-medical'));
  assert.ok(result.product_archetype.candidates.every((candidate) => candidate.status === 'candidate'));
  assert.ok(result.industry_overlays.every((candidate) => candidate.status === 'candidate'));
});

test('reports only explicit regulatory candidates with conservative confidence', () => {
  const result = analyze('hybrid-healthcare-platform');
  assert.deepEqual(result.regulatory_overlays.map((candidate) => candidate.id), ['gdpr', 'hipaa']);
  assert.ok(result.regulatory_overlays.every((candidate) => candidate.confidence === 'Tentative'));
  assert.ok(result.regulatory_overlays.every((candidate) => candidate.reasons.length > 0));
  const unrelated = analyze('infrastructure-iac');
  assert.deepEqual(unrelated.regulatory_overlays, []);
});

test('hashes canonical and legacy artifacts and finds ledger drift', () => {
  const result = analyze('arc-artifacts');
  const progress = result.artifacts.canonical.find((entry) => entry.path === '.arc-ready/PROGRESS.md');
  const architecture = result.artifacts.canonical.find((entry) => entry.path === '.architecture-ready/ARCH.md');
  const legacy = result.artifacts.legacy.find((entry) => entry.path === '.kickoff-ready/PROGRESS.md');
  assert.equal(progress.present, true);
  assert.equal(progress.bytes, Buffer.byteLength(cases['arc-artifacts'].contents['.arc-ready/PROGRESS.md']));
  assert.equal(
    progress.sha256,
    crypto.createHash('sha256').update(cases['arc-artifacts'].contents['.arc-ready/PROGRESS.md']).digest('hex')
  );
  assert.equal(architecture.bytes, 0);
  assert.equal(architecture.sha256, crypto.createHash('sha256').update('').digest('hex'));
  assert.equal(architecture.empty, true);
  assert.equal(legacy.present, true);
  assert.equal(legacy.source, 'ready-suite-legacy');
  assert.equal(result.artifacts.ledger.source, '.arc-ready/PROGRESS.md');
  assert.deepEqual(result.artifacts.ledger.issues, [
    { tier: '1.2', status: 'imported', path: '.architecture-ready/ARCH.md', kind: 'empty-artifact' },
    { tier: '1.3', status: 'done', path: '.roadmap-ready/ROADMAP.md', kind: 'missing-artifact' }
  ]);
  assert.ok(!result.artifacts.ledger.issues.some((issue) => issue.path === '.stack-ready/STACK.md'));
});

test('produces deterministic local-only output and rejects paths outside root', () => {
  const fixture = cases['hybrid-healthcare-platform'];
  const first = analyzeProjectContext('/virtual/context', [...fixture.paths, '../outside.txt'], {
    ...fixture.contents,
    '../outside.txt': 'HIPAA PCI-DSS'
  });
  const second = analyzeProjectContext('/virtual/context', [...fixture.paths].reverse(), fixture.contents);
  assert.deepEqual(first, second);
  assert.match(first.fingerprint_sha256, /^[a-f0-9]{64}$/);
  assert.ok(first.limitations.some((entry) => entry.includes('No project code')));
  assert.deepEqual(first.regulatory_overlays.map((candidate) => candidate.id), ['gdpr', 'hipaa']);
});

test('validates the arc-ready 1.1 table ledger and dependency order', () => {
  const progress = [
    '| Step | Tier | Status | Artifact path | Invocation TS | Verification TS | Disk hash | Notes |',
    '|---|---|---|---|---|---|---|---|',
    '| 1 | prd-ready | pending | | | | | |',
    '| 2 | architecture-ready | done | .architecture-ready/ARCH.md | 2026-07-13T10:00:00Z | 2026-07-13T10:01:00Z | abc | |',
    '| 3 | roadmap-ready | complete | | | | | |',
    '| 4 | stack-ready | pending | | | | | |',
    '| 5 | repo-ready | pending | | | | | |',
    '| 6 | production-ready | pending | | | | | |',
    '| 7 | deploy-ready | pending | | | | | |',
    '| 8 | observe-ready | pending | | | | | |',
    '| 9 | launch-ready | pending | | | | | |',
    '| 10 | harden-ready | pending | | | | | |'
  ].join('\n');
  const result = analyzeProjectContext('/virtual/table-ledger', [
    '.arc-ready/PROGRESS.md', '.architecture-ready/ARCH.md'
  ], {
    '.arc-ready/PROGRESS.md': progress,
    '.architecture-ready/ARCH.md': '# Architecture\n'
  });
  const kinds = new Set(result.artifacts.ledger.issues.map((issue) => issue.kind));
  assert.equal(result.artifacts.ledger.format, 'arc-ready-1.1-table');
  assert.ok(kinds.has('dependency-order-violation'));
  assert.ok(kinds.has('invalid-status'));
  assert.ok(!kinds.has('missing-ledger-tier'));
});

test('verifies a content-bound prepublication gate', () => {
  const hardening = '# Findings\nseverity: high\nstatus: resolved\n';
  const revision = crypto.createHash('sha256').update(hardening).digest('hex');
  const result = analyzeProjectContext('/virtual/prepublication', [
    '.harden-ready/FINDINGS.md', '.launch-ready/PREPUBLICATION.md'
  ], {
    '.harden-ready/FINDINGS.md': hardening,
    '.launch-ready/PREPUBLICATION.md': `checked_at: 2026-07-13T10:00:00Z\nhardening_revision: ${revision}\nverdict: pass\n`
  });
  assert.equal(result.artifacts.prepublication.status, 'pass');
  assert.equal(result.artifacts.prepublication.hardening_revision_matches_content, true);
  assert.deepEqual(result.artifacts.prepublication.issues, []);
});

test('fails closed when a hardening revision cannot be verified', () => {
  const result = analyzeProjectContext('/virtual/prepublication-unverifiable', [
    '.harden-ready/FINDINGS.md', '.launch-ready/PREPUBLICATION.md'
  ], {
    '.harden-ready/FINDINGS.md': '# Findings\n',
    '.launch-ready/PREPUBLICATION.md': 'checked_at: 2026-07-13T10:00:00Z\nhardening_revision: abcdef012345\nverdict: pass\n'
  });
  assert.equal(result.artifacts.prepublication.status, 'invalid');
  assert.equal(result.artifacts.prepublication.hardening_revision_matches_content, null);
  assert.ok(result.artifacts.prepublication.issues
    .some((issue) => issue.kind === 'unverifiable-hardening-revision'));
});

test('accepts a Git revision bound prepublication gate', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-arc-git-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.harden-ready'));
  fs.mkdirSync(path.join(root, '.launch-ready'));
  fs.writeFileSync(path.join(root, '.harden-ready', 'FINDINGS.md'), '# Findings\nstatus: resolved\n');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'audit@example.invalid']);
  git(root, ['config', 'user.name', 'Audit Fixture']);
  git(root, ['add', '.harden-ready/FINDINGS.md']);
  git(root, ['commit', '-qm', 'record hardening']);
  const revision = git(root, ['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(root, '.launch-ready', 'PREPUBLICATION.md'), [
    'checked_at: 2026-07-13T10:00:00Z',
    `hardening_revision: ${revision}`,
    'verdict: pass',
    ''
  ].join('\n'));
  git(root, ['add', '.launch-ready/PREPUBLICATION.md']);
  git(root, ['commit', '-qm', 'record prepublication']);

  const gate = analyzeProjectContext(root).artifacts.prepublication;
  assert.equal(gate.status, 'pass');
  assert.equal(gate.hardening_revision_matches_content, true);
  assert.equal(gate.hardening_revision_match_kind, 'git-revision');
  assert.deepEqual(gate.issues, []);
});

test('uses Git history for freshness and remains stable after clone and touch', (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-arc-freshness-'));
  const root = path.join(parent, 'source');
  const clone = path.join(parent, 'clone');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.prd-ready'), { recursive: true });
  fs.mkdirSync(path.join(root, '.architecture-ready'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'audit@example.invalid']);
  git(root, ['config', 'user.name', 'Audit Fixture']);
  fs.writeFileSync(path.join(root, '.prd-ready', 'PRD.md'), '# Product\n');
  git(root, ['add', '.prd-ready/PRD.md']);
  git(root, ['commit', '-qm', 'record product'], {
    env: { GIT_AUTHOR_DATE: '2026-07-13T10:00:00Z', GIT_COMMITTER_DATE: '2026-07-13T10:00:00Z' }
  });
  fs.writeFileSync(path.join(root, '.architecture-ready', 'ARCH.md'), '# Architecture\n');
  git(root, ['add', '.architecture-ready/ARCH.md']);
  git(root, ['commit', '-qm', 'record architecture'], {
    env: { GIT_AUTHOR_DATE: '2026-07-13T10:05:00Z', GIT_COMMITTER_DATE: '2026-07-13T10:05:00Z' }
  });

  const source = analyzeProjectContext(root);
  git(parent, ['clone', '-q', root, clone]);
  const cloned = analyzeProjectContext(clone);
  const future = new Date('2030-01-01T00:00:00Z');
  fs.utimesSync(path.join(clone, '.prd-ready', 'PRD.md'), future, future);
  const touched = analyzeProjectContext(clone);

  assert.equal(source.artifacts.freshness.method, 'git-last-change-with-mtime-fallback');
  assert.deepEqual(source.artifacts.freshness.issues, []);
  assert.deepEqual(cloned.artifacts.freshness, source.artifacts.freshness);
  assert.deepEqual(touched.artifacts.freshness, source.artifacts.freshness);
  assert.ok(touched.artifacts.canonical.filter((entry) => entry.present)
    .every((entry) => entry.timestamp_source === 'git-last-change'));

  fs.writeFileSync(path.join(clone, '.prd-ready', 'PRD.md'), '# Product changed\n');
  fs.utimesSync(path.join(clone, '.prd-ready', 'PRD.md'), future, future);
  const dirty = analyzeProjectContext(clone);
  const product = dirty.artifacts.canonical.find((entry) => entry.id === 'prd');
  assert.equal(product.timestamp_source, 'filesystem-mtime-fallback');
  assert.ok(dirty.artifacts.freshness.issues
    .some((issue) => issue.kind === 'stale-downstream-artifact'));
});

test('project-context catalog validator fails closed on registry drift', () => {
  const corrupted = JSON.parse(JSON.stringify(catalog));
  corrupted.profiles.pop();
  corrupted.forms[0].signals = [];
  const errors = validateProjectContextCatalog(corrupted);
  assert.ok(errors.some((error) => error.includes('37 profiles')));
  assert.ok(errors.some((error) => error.includes('at least two signals')));
});

test('reference corpora and test fixtures do not become product overlays', () => {
  const result = analyzeProjectContext('/virtual/meta-tool', [
    'README.md',
    '.github/workflows/lint.yml',
    'skills/tool/references/domains.md',
    'test/profile.test.js'
  ], {
    'README.md': 'A deterministic source auditing utility.',
    '.github/workflows/lint.yml': 'steps:\n  - name: Checkout\n',
    'skills/tool/references/domains.md': 'HIPAA GDPR marketplace seller buyer SKU warehouse fleet.',
    'test/profile.test.js': 'const fixture = "PCI-DSS healthcare patient FHIR";'
  });
  assert.deepEqual(result.product_archetype.candidates, []);
  assert.deepEqual(result.industry_overlays, []);
  assert.deepEqual(result.regulatory_overlays, []);
});
