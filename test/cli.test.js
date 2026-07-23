'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
