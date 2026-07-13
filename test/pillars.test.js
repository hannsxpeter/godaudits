'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  analyzePillars,
  normalizeSelector,
  selectorMatches,
  validIdentity
} = require('../skills/godaudits/runtime/lib/pillars');
const { fingerprintRepository } = require('../skills/godaudits/runtime/lib/evidence');

const fixture = path.join(__dirname, 'fixtures', 'pillars-routing');

const cases = [
  {
    name: 'hard dependency stays depth one',
    task: 'Change the database schema for workspace invitations',
    target: 'services/api/src/invitations.py',
    load: ['root::auth', 'root::context', 'root::data', 'root::repo'],
    primaries: ['root::data'],
    absent: []
  },
  {
    name: 'covers can activate see also',
    task: 'Update the request contract used by this database query',
    target: 'services/api/src/query.py',
    load: ['root::api', 'root::auth', 'root::context', 'root::data', 'root::repo'],
    primaries: ['root::data'],
    absent: []
  },
  {
    name: 'sub-pillar identity is path qualified',
    task: 'Add agent registration credential rotation',
    target: 'services/api/src/agents.py',
    load: ['root::auth', 'root::auth/agent-registration', 'root::context', 'root::repo'],
    primaries: ['root::auth/agent-registration'],
    absent: []
  },
  {
    name: 'nested scopes inherit and override',
    task: 'Fix the UI component spacing',
    target: 'packages/web/src/card.tsx',
    load: [
      'root::context',
      'root::repo',
      'root::ui',
      'packages/web::context',
      'packages/web::repo',
      'packages/web::ui'
    ],
    primaries: ['root::ui', 'packages/web::ui'],
    absent: []
  },
  {
    name: 'child exclusion suppresses inherited routed pillar',
    task: 'Add a monitoring alert for the web package',
    target: 'packages/web/src/card.tsx',
    load: ['root::context', 'root::repo', 'packages/web::context', 'packages/web::repo'],
    primaries: ['root::observe'],
    absent: []
  },
  {
    name: 'local catalog exposes absent concern',
    task: 'Prepare the release checklist',
    target: 'services/api/src/version.py',
    load: ['root::context', 'root::repo'],
    primaries: [],
    absent: ['root::release']
  }
];

test('portable matcher uses contiguous normalized ASCII tokens', () => {
  assert.equal(normalizeSelector('Schema-change / API'), 'schema change api');
  assert.equal(selectorMatches('Make a Schema change safely', 'schema-change'), true);
  assert.equal(selectorMatches('capital allocation', 'api'), false);
  assert.equal(selectorMatches('change schema order', 'schema change'), false);
  assert.equal(validIdentity('auth/agent-registration'), true);
  assert.equal(validIdentity('auth/internal/rotation'), false);
  assert.equal(validIdentity('Auth'), false);
});

for (const routeCase of cases) {
  test(`Pillars routing: ${routeCase.name}`, () => {
    const report = analyzePillars(fixture, {
      task: routeCase.task,
      target: routeCase.target
    });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.routing.load, routeCase.load);
    assert.deepEqual(report.routing.primaries, routeCase.primaries);
    assert.deepEqual(report.routing.absent, routeCase.absent);
  });
}

test('nested routing exposes nearest-scope winners without hiding ancestor guidance', () => {
  const report = analyzePillars(fixture, {
    task: 'Fix the UI component spacing',
    target: 'packages/web/src/card.tsx'
  });
  assert.equal(report.routing.winners.ui, 'packages/web::ui');
  assert.equal(report.routing.winners.context, 'packages/web::context');
  assert.ok(report.routing.load.includes('root::ui'));
  assert.equal(report.scopes.map((scope) => scope.label).join(','), 'root,packages/web');
});

test('Pillars evidence is location independent and never exposes an absolute root', (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-pillars-portable-'));
  const firstRoot = path.join(parent, 'first', 'repo');
  const secondRoot = path.join(parent, 'second', 'repo');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(firstRoot), { recursive: true });
  fs.mkdirSync(path.dirname(secondRoot), { recursive: true });
  fs.cpSync(fixture, firstRoot, { recursive: true });
  fs.cpSync(fixture, secondRoot, { recursive: true });

  const first = fingerprintRepository(firstRoot);
  const second = fingerprintRepository(secondRoot);
  assert.equal(first.pillars.root, '.');
  assert.equal(first.fingerprint_sha256, second.fingerprint_sha256);
  assert.equal(JSON.stringify(first).includes(parent), false);
});

test('scope discovery ignores generated trees and fails safely at its directory budget', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-pillars-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'agents'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Pillars 1.1\n\n```yaml\nexcluded: []\n```\n');
  fs.writeFileSync(path.join(root, 'agents', 'context.md'), validPillar({
    pillar: 'context',
    always_load: true,
    covers: '[project context]'
  }));
  fs.writeFileSync(path.join(root, 'agents', 'repo.md'), validPillar({
    pillar: 'repo',
    always_load: true,
    covers: '[repository structure]'
  }));
  for (const directory of ['build', 'coverage', 'dist', 'target', 'vendor']) {
    fs.mkdirSync(path.join(root, directory, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(root, directory, 'AGENTS.md'), '# Invalid generated scope\n');
    fs.writeFileSync(path.join(root, directory, 'agents', 'invalid.md'), 'invalid\n');
  }
  fs.mkdirSync(path.join(root, 'source', 'nested'), { recursive: true });

  const normal = analyzePillars(root, { task: 'project context', target: '.' });
  assert.deepEqual(normal.errors, []);
  assert.deepEqual(normal.scopes.map((scope) => scope.label), ['root']);

  const bounded = analyzePillars(root, { task: 'project context', target: '.', maxDirectories: 1 });
  assert.ok(bounded.errors.some((finding) => finding.code === 'directory-budget-exceeded'));
  assert.equal(bounded.compatible, false);
});

test('analyzer rejects targets outside the local project', () => {
  assert.throws(
    () => analyzePillars(fixture, { task: 'Update API', target: '../outside.js' }),
    /outside project root/
  );
});

test('schema, identity, conflict, and reference violations are errors', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-pillars-errors-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'agents', 'deep', 'too'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), [
    '# Pillars 1.1',
    '',
    '```yaml',
    'excluded:',
    '  - context',
    '```',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'agents', 'context.md'), invalidPillar({
    pillar: 'wrong-name',
    status: 'unknown',
    always_load: 'yes',
    covers: '[API route, api-route]',
    triggers: '[!!!]',
    must_read_with: '[context, missing]',
    see_also: '[missing-soft, missing-soft]'
  }, ['Scope', 'Context', 'Rules', 'Decisions', 'Workflows', 'Watchouts', 'Touchpoints']));
  fs.writeFileSync(path.join(root, 'agents', 'deep', 'too', 'nested.md'), validPillar({
    pillar: 'nested',
    always_load: false,
    covers: '[nested concern]',
    triggers: '[nested]'
  }));
  fs.writeFileSync(path.join(root, 'agents', 'catalog.yaml'), [
    'version: 1',
    'absent:',
    '  - identity: context',
    '    triggers: [context]',
    '  - identity: deep/too/nested',
    '    triggers: [nested]'
  ].join('\n'));

  const report = analyzePillars(root, { task: 'context', target: '.' });
  const codes = new Set(report.errors.map((finding) => finding.code));
  assert.ok(codes.has('pillar-name-mismatch'));
  assert.ok(codes.has('invalid-status'));
  assert.ok(codes.has('invalid-always-load'));
  assert.ok(codes.has('duplicate-selector'));
  assert.ok(codes.has('empty-selector'));
  assert.ok(codes.has('self-reference'));
  assert.ok(codes.has('duplicate-reference'));
  assert.ok(codes.has('dangling-reference'));
  assert.ok(codes.has('invalid-headings'));
  assert.ok(codes.has('invalid-identity'));
  assert.ok(codes.has('present-excluded-conflict'));
  assert.ok(codes.has('present-absent-conflict'));
  assert.ok(codes.has('floor-catalog-conflict'));
  assert.ok(codes.has('missing-floor'));
});

test('content, dependency, floor, and scope budgets produce warnings', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-pillars-warnings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'agents'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), [
    '# Pillars 1.1',
    '',
    '```yaml',
    'excluded: [context]',
    '```',
    ''
  ].join('\n'));
  const largeBody = `${'abcdefgh '.repeat(1100)}\n`;
  fs.writeFileSync(path.join(root, 'agents', 'repo.md'), validPillar({
    pillar: 'repo',
    always_load: true,
    covers: '[repository]'
  }, largeBody));
  fs.writeFileSync(path.join(root, 'agents', 'guide.md'), validPillar({
    pillar: 'guide',
    always_load: true,
    covers: '[guidance]',
    must_read_with: '[one, two, three, four]'
  }, largeBody));

  const report = analyzePillars(root, { task: 'anything', target: '.' });
  const codes = new Set(report.warnings.map((finding) => finding.code));
  assert.ok(codes.has('floor-excluded'));
  assert.ok(codes.has('exclusion-without-reason'));
  assert.ok(codes.has('dependency-boundary-smell'));
  assert.ok(codes.has('pillar-word-budget'));
  assert.ok(codes.has('pillar-byte-budget'));
  assert.ok(codes.has('scope-word-budget'));
  assert.ok(codes.has('scope-byte-budget'));
});

function validPillar(fields, scopeSuffix = '') {
  const lines = [
    '---',
    `pillar: ${fields.pillar}`,
    `status: ${fields.status || 'present'}`,
    `always_load: ${fields.always_load === true}`,
    `covers: ${fields.covers}`,
    `triggers: ${fields.triggers || '[]'}`,
    `must_read_with: ${fields.must_read_with || '[]'}`,
    `see_also: ${fields.see_also || '[]'}`,
    '---',
    '',
    '## Scope',
    '',
    `Fixture scope. ${scopeSuffix}`,
    '',
    '## Context',
    '',
    '(none)',
    '',
    '## Decisions',
    '',
    '(none)',
    '',
    '## Rules',
    '',
    '(none)',
    '',
    '## Workflows',
    '',
    '(none)',
    '',
    '## Watchouts',
    '',
    '(none)',
    '',
    '## Touchpoints',
    '',
    '(none)',
    '',
    '## Gaps',
    '',
    '(none)',
    ''
  ];
  return lines.join('\n');
}

function invalidPillar(fields, headings) {
  return [
    '---',
    `pillar: ${fields.pillar}`,
    `status: ${fields.status}`,
    `always_load: ${fields.always_load}`,
    `covers: ${fields.covers}`,
    `triggers: ${fields.triggers}`,
    `must_read_with: ${fields.must_read_with}`,
    `see_also: ${fields.see_also}`,
    '---',
    '',
    ...headings.flatMap((heading) => [`## ${heading}`, '', '(none)', ''])
  ].join('\n');
}
