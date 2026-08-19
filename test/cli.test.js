'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'bin', 'godaudits.js');
const pillarsFixture = path.join(root, 'test', 'fixtures', 'pillars-routing');
const apiFixture = path.join(root, 'benchmarks', 'fixtures', 'node-api');

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

test('pillars CLI emits portable routing evidence', () => {
  const result = run(['pillars', pillarsFixture, '--task', 'Change the database schema', '--target', 'services/api/src/query.py']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.present, true);
  assert.equal(report.root, '.');
  assert.ok(report.routing.load.includes('root::data'));
});

test('evidence-derived init and freshness validation work through the shipped CLI', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-cli-'));
  const repository = path.join(temporary, 'repo');
  const evidenceFile = path.join(temporary, 'EVIDENCE.json');
  const auditFile = path.join(temporary, 'AUDIT.json');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.cpSync(apiFixture, repository, { recursive: true });

  const evidence = run(['evidence', repository, '--output', evidenceFile], temporary);
  assert.equal(evidence.status, 0, evidence.stderr);
  const initialize = run([
    'init', '--name', 'cli-fixture', '--scale', 'side-project', '--profile', 'balanced',
    '--applicable', 'all', '--evidence', evidenceFile, '--repo', repository, '--output', auditFile
  ], temporary);
  assert.equal(initialize.status, 0, initialize.stderr);
  const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  assert.equal(audit.audit.project_form, 'api-service');
  assert.equal(audit.audit.budget, 'medium');

  const fresh = run(['validate', auditFile, '--repo', repository, '--require-fresh-evidence'], temporary);
  assert.equal(fresh.status, 0, fresh.stderr);
  fs.writeFileSync(path.join(repository, 'new-file.js'), 'module.exports = true;\n');
  const stale = run(['validate', auditFile, '--repo', repository, '--require-fresh-evidence'], temporary);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /fingerprint is stale/);
});

test('import-tool CLI requires and preserves scanner provenance', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-import-'));
  const reportFile = path.join(temporary, 'semgrep.json');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.writeFileSync(reportFile, JSON.stringify({
    version: '1.164.0',
    results: [{
      check_id: 'javascript.lang.security.audit',
      path: 'src/app.js',
      start: { line: 12 },
      extra: { message: 'A scanner lead.' }
    }]
  }));

  const missing = run(['import-tool', reportFile, '--tool', 'semgrep'], temporary);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /requires --command/);

  const imported = run([
    'import-tool', reportFile, '--tool', 'semgrep',
    '--command', 'semgrep scan --json .', '--start', '9'
  ], temporary);
  assert.equal(imported.status, 0, imported.stderr);
  const evidence = JSON.parse(imported.stdout).evidence[0];
  assert.equal(evidence.id, 'E-9');
  assert.equal(evidence.tool_version, '1.164.0');
  assert.equal(evidence.command, 'semgrep scan --json .');
});

test('wayfind prints the frontier through the shipped CLI in both formats', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-wayfind-'));
  const auditFile = path.join(temporary, 'AUDIT.json');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));

  const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
  const { validAudit } = require('./helpers');
  const audit = validAudit();
  audit.audit.destination = 'Security reaches 85 with no open Critical finding, confirmed by a re-audit at this commit.';
  const compiled = compileAudit(audit);
  assert.deepEqual(compiled.errors, []);
  fs.writeFileSync(auditFile, JSON.stringify(compiled.audit, null, 2));

  const text = run(['wayfind', auditFile], temporary);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /godaudits wayfinding map: fixture-app/);
  assert.match(text.stdout, /Scope board lookups to the tenant \(GA-101\)/);

  const json = run(['wayfind', auditFile, '--format', 'json'], temporary);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).frontier[0].id, 'GA-101');

  // The positional is guarded: a flag written first is not read as the path.
  const flagFirst = run(['wayfind', '--format', 'json', auditFile], temporary);
  assert.equal(flagFirst.status, 1);
  assert.match(flagFirst.stderr, /wayfind requires AUDIT\.json as the first argument/);

  const badFormat = run(['wayfind', auditFile, '--format', 'yaml'], temporary);
  assert.equal(badFormat.status, 1);
  assert.match(badFormat.stderr, /--format must be text or json/);
});

test('blast-radius CLI plans, validates, applies, and renders a change review', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-blast-cli-'));
  const repository = path.join(temporary, 'repo');
  const reviewFile = path.join(temporary, 'CHANGE-REVIEW.json');
  const resultsFile = path.join(temporary, 'RESULTS.json');
  const appliedFile = path.join(temporary, 'APPLIED.json');
  const renderedFile = path.join(temporary, 'CHANGE-REVIEW.mdx');
  const evidenceFile = path.join(temporary, 'CHANGE-EVIDENCE.json');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.mkdirSync(repository);
  const git = (args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  git(['init', '-q']);
  git(['config', 'user.name', 'Test User']);
  git(['config', 'user.email', 'test@example.com']);
  fs.writeFileSync(path.join(repository, 'api.js'), 'function publicValue() { return 1; }\nmodule.exports = { publicValue };\n');
  git(['add', '.']);
  git(['commit', '-qm', 'base']);
  const base = git(['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(repository, 'api.js'), 'function publicValue() { return 2; }\nmodule.exports = { publicValue };\n');
  git(['add', '.']);
  git(['commit', '-qm', 'head']);
  const head = git(['rev-parse', 'HEAD']);

  const planned = run([
    'blast-radius', 'plan', repository, '--base', base, '--head', head,
    '--fact', 'The public value remains compatible with every consumer.',
    '--verify', 'node --test test/api-contract.test.js', '--output', reviewFile
  ], temporary);
  assert.equal(planned.status, 0, planned.stderr);
  const plannedReview = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
  assert.equal(plannedReview.merge_gate.status, 'unproven');

  const validated = run(['blast-radius', 'validate', reviewFile], temporary);
  assert.equal(validated.status, 0, validated.stderr);
  assert.match(validated.stdout, /valid change review/);

  fs.writeFileSync(resultsFile, JSON.stringify({
    schema_version: '1.0',
    review: {
      base: plannedReview.review.base,
      head: plannedReview.review.head,
      diff_sha256: plannedReview.review.diff_sha256
    },
    authorization: {
      capability: 'sandbox',
      authorized_by: 'repository owner',
      environment: 'disposable local fixture',
      isolation: 'outbound network disabled and no production credentials'
    },
    safety_facts: [{
      fact: 'SF-1', outcome: 'proven', proof: {
        level: 4, kind: 'executable', tool: 'node:test', tool_version: process.versions.node,
        command: 'node --test test/api-contract.test.js', result: 'passed',
        environment: 'disposable local fixture', isolation: 'outbound network disabled and no production credentials'
      }
    }],
    before_merge: {
      outcome: 'passed', proof: {
        level: 4, kind: 'executable', tool: 'node:test', tool_version: process.versions.node,
        command: 'node --test test/api-contract.test.js', result: 'passed',
        environment: 'disposable local fixture', isolation: 'outbound network disabled and no production credentials'
      }
    }
  }));
  const applied = run(['blast-radius', 'apply', reviewFile, resultsFile, '--output', appliedFile], temporary);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(fs.readFileSync(appliedFile, 'utf8')).merge_gate.status, 'pass');

  const rendered = run(['blast-radius', 'render', appliedFile, '--output', renderedFile], temporary);
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(fs.readFileSync(renderedFile, 'utf8'), /Merge disposition: PASS/);

  const evidence = run(['blast-radius', 'evidence', appliedFile, '--start', '20', '--output', evidenceFile], temporary);
  assert.equal(evidence.status, 0, evidence.stderr);
  assert.equal(JSON.parse(fs.readFileSync(evidenceFile, 'utf8')).evidence[0].id, 'E-20');
});
