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

test('council CLI plans, applies, triages, and renders a three-seat review', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-council-cli-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const fixture = path.join(root, 'test', 'fixtures', 'council');
  const repository = path.join(temporary, 'repo');
  const auditDirectory = path.join(temporary, '.godaudits');
  const auditFile = path.join(auditDirectory, 'AUDIT.json');
  fs.cpSync(path.join(fixture, 'repo'), repository, { recursive: true });
  fs.mkdirSync(auditDirectory);
  fs.copyFileSync(path.join(fixture, 'audit.json'), auditFile);
  const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(auditFile)).digest('hex');

  // Capability gate: an audit without the council capability is refused.
  const staticAudit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  staticAudit.audit.capabilities = ['static'];
  const staticFile = path.join(temporary, 'STATIC-AUDIT.json');
  fs.writeFileSync(staticFile, JSON.stringify(staticAudit));
  const refused = run(['council', 'plan', staticFile, '--output', path.join(temporary, 'nope.json')], temporary);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /does not include "council"/);
  assert.equal(fs.existsSync(path.join(temporary, 'nope.json')), false);

  // plan writes the round 1 packet next to the audit by default.
  const planned = run(['council', 'plan', auditFile], temporary);
  assert.equal(planned.status, 0, planned.stderr);
  const packetFile = path.join(auditDirectory, 'council', 'PACKET-1.json');
  const packet = JSON.parse(fs.readFileSync(packetFile, 'utf8'));
  assert.equal(packet.round, 1);
  assert.equal(packet.audit_sha256, hash);
  assert.deepEqual(packet.required_verdicts, ['F-SEC-1', 'F-SEC-9']);

  const answer = (harness, provider, extra = {}) => ({
    round: 1,
    audit_sha256: hash,
    seat: { harness, provider, model: `${harness}-model`, effort: 'high' },
    score: null,
    verdicts: ['F-SEC-1', 'F-SEC-9'].map((finding) => ({ finding, outcome: 'no-refutation', guard: null, note: null })),
    objections: [],
    ...extra
  });
  const write = (name, value) => {
    const file = path.join(auditDirectory, 'council', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
    return file;
  };
  const claude = write('ROUND-1-claude-code.json', answer('claude-code', 'anthropic', { score: 80 }));
  const codex = write('ROUND-1-codex.json', answer('codex', 'openai', {
    verdicts: [
      { finding: 'F-SEC-1', outcome: 'refuted', guard: { path: 'src/repo.js', line: 2, quote: 'return { ...query, tenant };' }, note: 'The repository layer injects the tenant.' },
      { finding: 'F-SEC-9', outcome: 'no-refutation', guard: null, note: null }
    ]
  }));
  const antigravity = write('ROUND-1-antigravity.json', answer('antigravity', 'google'));

  // apply requires --repo.
  const noRepo = run(['council', 'apply', auditFile, claude, codex, antigravity], temporary);
  assert.equal(noRepo.status, 1);
  assert.match(noRepo.stderr, /requires --repo/);

  // A stale hash is rejected with a non-zero exit and nothing is written.
  const stale = write('ROUND-1-stale.json', { ...answer('cursor', 'unknown'), audit_sha256: 'e'.repeat(64) });
  const rejected = run(['council', 'apply', auditFile, claude, stale, '--repo', repository], temporary);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /audit_sha256 does not match/);
  assert.equal(fs.existsSync(path.join(auditDirectory, 'COUNCIL.json')), false);

  const ledgerFile = path.join(auditDirectory, 'COUNCIL.json');
  const applied = run(['council', 'apply', auditFile, claude, codex, antigravity, '--repo', repository], temporary);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /council round 1: needs-triage/);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.equal(ledger.status, 'needs-triage');
  assert.equal(ledger.rounds[0].objections[0].raised_by[0], 'codex');
  assert.equal(ledger.rounds[0].objections[0].citation.verified, true);

  // A ledger beside the audit is never overwritten or silently continued.
  const clobber = run(['council', 'apply', auditFile, claude, '--repo', repository], temporary);
  assert.equal(clobber.status, 1);
  assert.match(clobber.stderr, /pass --ledger/);
  const replan = run(['council', 'plan', auditFile], temporary);
  assert.equal(replan.status, 1);
  assert.match(replan.stderr, /pass --ledger/);
  const untriaged = run(['council', 'plan', auditFile, '--ledger', ledgerFile], temporary);
  assert.equal(untriaged.status, 1);
  assert.match(untriaged.stderr, /untriaged objection/);

  // triage: a dismissal needs a reason; accepted closes the round in place.
  const decisionsFile = path.join(temporary, 'DECISIONS.json');
  fs.writeFileSync(decisionsFile, JSON.stringify([{ objection: 'O-1-1', status: 'dismissed', reason: '' }]));
  const noReason = run(['council', 'triage', ledgerFile, decisionsFile], temporary);
  assert.equal(noReason.status, 1);
  assert.match(noReason.stderr, /requires a one-line reason/);
  fs.writeFileSync(decisionsFile, JSON.stringify([{ objection: 'O-1-1', status: 'accepted', reason: 'Confirmed by the lead.' }]));
  const triaged = run(['council', 'triage', ledgerFile, decisionsFile], temporary);
  assert.equal(triaged.status, 0, triaged.stderr);
  assert.match(triaged.stdout, /council status: continue/);
  assert.equal(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).status, 'continue');

  // Round 2 is planned from the ledger.
  const second = run(['council', 'plan', auditFile, '--ledger', ledgerFile, '--output', path.join(temporary, 'PACKET-2.json')], temporary);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temporary, 'PACKET-2.json'), 'utf8')).round, 2);

  // render
  const renderedFile = path.join(temporary, 'COUNCIL.mdx');
  const rendered = run(['council', 'render', ledgerFile, '--output', renderedFile], temporary);
  assert.equal(rendered.status, 0, rendered.stderr);
  const mdx = fs.readFileSync(renderedFile, 'utf8');
  assert.match(mdx, /^## Council review$/m);
  assert.match(mdx, /^Rounds: 1$/m);
  assert.match(mdx, /\| claude-code \| 80\/100 \|/);
  assert.match(mdx, /\| codex \| no score \|/);

  const usage = run(['council', 'bogus'], temporary);
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /council requires a mode/);
  assert.match(run(['help'], temporary).stdout, /godaudits council apply/);
});

test('regression: council packets cannot match the response glob and output targets never replace a foreign ledger', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-council-guard-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const fixture = path.join(root, 'test', 'fixtures', 'council');
  const repository = path.join(temporary, 'repo');
  const auditDirectory = path.join(temporary, '.godaudits');
  const councilDirectory = path.join(auditDirectory, 'council');
  const auditFile = path.join(auditDirectory, 'AUDIT.json');
  fs.cpSync(path.join(fixture, 'repo'), repository, { recursive: true });
  fs.mkdirSync(councilDirectory, { recursive: true });
  fs.copyFileSync(path.join(fixture, 'audit.json'), auditFile);
  const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(auditFile)).digest('hex');

  const planned = run(['council', 'plan', auditFile], temporary);
  assert.equal(planned.status, 0, planned.stderr);
  const names = fs.readdirSync(councilDirectory);
  assert.deepEqual(names, ['PACKET-1.json']);
  assert.equal(names.some((name) => /^ROUND-1-.*\.json$/.test(name)), false);

  const write = (harness, provider) => {
    const file = path.join(councilDirectory, `ROUND-1-${harness}.json`);
    fs.writeFileSync(file, JSON.stringify({
      round: 1,
      audit_sha256: hash,
      seat: { harness, provider, model: `${harness}-model`, effort: null },
      score: null,
      verdicts: ['F-SEC-1', 'F-SEC-9'].map((finding) => ({ finding, outcome: 'no-refutation', guard: null, note: null })),
      objections: []
    }));
    return file;
  };
  const responses = [write('claude-code', 'anthropic'), write('codex', 'openai'), write('antigravity', 'google')];
  const globbed = fs.readdirSync(councilDirectory).filter((name) => /^ROUND-1-.*\.json$/.test(name)).map((name) => path.join(councilDirectory, name));
  assert.deepEqual(globbed.sort(), [...responses].sort());

  const ledgerFile = path.join(temporary, 'LEDGER-A.json');
  const otherFile = path.join(temporary, 'LEDGER-B.json');
  const applied = run(['council', 'apply', auditFile, ...globbed, '--repo', repository, '--output', ledgerFile], temporary);
  assert.equal(applied.status, 0, applied.stderr);
  fs.copyFileSync(ledgerFile, otherFile);
  const before = fs.readFileSync(otherFile, 'utf8');

  // No --ledger: an existing --output is refused, not replaced.
  const clobber = run(['council', 'apply', auditFile, ...globbed, '--repo', repository, '--output', otherFile], temporary);
  assert.equal(clobber.status, 1);
  assert.match(clobber.stderr, /already exists and is not the ledger being updated/);
  assert.equal(fs.readFileSync(otherFile, 'utf8'), before);

  // With --ledger: a different existing --output is refused too.
  const foreign = run(['council', 'apply', auditFile, ...globbed, '--repo', repository, '--ledger', ledgerFile, '--output', otherFile], temporary);
  assert.equal(foreign.status, 1);
  assert.match(foreign.stderr, /already exists and is not the ledger being updated/);
  assert.equal(fs.readFileSync(otherFile, 'utf8'), before);

  // A new file is fine, and so is rewriting the ledger itself. (Round 1 converged here, so a
  // fresh run on a new path is the permitted shape.)
  const fresh = path.join(temporary, 'LEDGER-C.json');
  const created = run(['council', 'apply', auditFile, ...globbed, '--repo', repository, '--output', fresh], temporary);
  assert.equal(created.status, 0, created.stderr);

  // triage obeys the same rule.
  const decisions = path.join(temporary, 'DECISIONS.json');
  fs.writeFileSync(decisions, '[]');
  const triageForeign = run(['council', 'triage', ledgerFile, decisions, '--output', otherFile], temporary);
  assert.equal(triageForeign.status, 1);
  assert.match(triageForeign.stderr, /already exists and is not the ledger being updated/);
});
