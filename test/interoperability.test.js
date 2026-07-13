'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { diffAudits } = require('../skills/godaudits/runtime/lib/diff');
const { auditToSarif } = require('../skills/godaudits/runtime/lib/sarif');
const { importSarif } = require('../skills/godaudits/runtime/lib/sarif-import');
const { validAudit } = require('./helpers');

test('SARIF output preserves check, severity, and source location', () => {
  const audit = compileAudit(validAudit()).audit;
  const sarif = auditToSarif(audit);
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results[0].ruleId, 'A-SEC-3');
  assert.equal(sarif.runs[0].results[0].level, 'error');
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'src/boards.js');
});

test('re-audit diff preserves ids and reports state transitions', () => {
  const previous = compileAudit(validAudit()).audit;
  const nextInput = validAudit();
  nextInput.audit.mode = 're-audit';
  nextInput.audit.audit_version = 2;
  nextInput.findings[0].status = 'resolved';
  nextInput.tasks[0].status = 'done';
  nextInput.domains[0].checks[0].outcome = 'pass';
  nextInput.domains[0].checks[0].finding_ids = [];
  const current = compileAudit(nextInput).audit;
  const delta = diffAudits(previous, current);
  assert.deepEqual(delta.resolved, ['F-SEC-1']);
  assert.deepEqual(delta.removed, []);
  assert.ok(delta.score.delta > 0);
  assert.equal(delta.coverage.delta, 0);
  assert.deepEqual(delta.tasks.completed, ['GA-101']);
  assert.equal(delta.check_changes[0].id, 'A-SEC-3');
  assert.equal(delta.valid, true);
});

test('re-audit diff fails closed on removed history and invalid metadata', () => {
  const previous = compileAudit(validAudit()).audit;
  const current = JSON.parse(JSON.stringify(previous));
  current.audit.name = 'different-project';
  current.audit.mode = 'fresh';
  current.findings = [];
  current.tasks = current.tasks.filter((task) => task.final_gate);
  const delta = diffAudits(previous, current);
  assert.equal(delta.valid, false);
  assert.ok(delta.violations.some((item) => item.includes('project names')));
  assert.ok(delta.violations.some((item) => item.includes('mode must be re-audit')));
  assert.ok(delta.violations.some((item) => item.includes('finding ids were removed')));
  assert.ok(delta.violations.some((item) => item.includes('task ids were removed')));
});

test('SARIF excludes resolved findings and marks accepted risks as suppressed', () => {
  const acceptedInput = validAudit();
  acceptedInput.findings[0].status = 'accepted-risk';
  acceptedInput.accepted_risks.push({
    finding: 'F-SEC-1',
    summary: 'Accepted during tenant migration.',
    owner: 'security-owner',
    accepted_on: '2026-07-13',
    expires: '2026-08-13',
    review: 'node --test test/security.test.js'
  });
  const accepted = auditToSarif(compileAudit(acceptedInput).audit);
  assert.equal(accepted.runs[0].results[0].suppressions[0].status, 'accepted');

  const resolvedInput = validAudit();
  resolvedInput.findings[0].status = 'resolved';
  resolvedInput.tasks[0].status = 'done';
  resolvedInput.domains[0].checks[0].outcome = 'pass';
  resolvedInput.domains[0].checks[0].finding_ids = [];
  const resolved = auditToSarif(compileAudit(resolvedInput).audit);
  assert.equal(resolved.runs[0].results.length, 0);
});

test('SARIF import creates secret-safe tool evidence without creating findings', () => {
  const imported = importSarif({
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'fixture-scanner', version: '3.2.1' } },
      results: [{
        ruleId: 'SEC001',
        message: { text: 'api_key=fixture-secret-value' },
        locations: [{ physicalLocation: { artifactLocation: { uri: 'src/app.js' }, region: { startLine: 7 } } }]
      }]
    }]
  }, { source: '/tmp/result.sarif', start: 40 });
  assert.equal(imported.evidence[0].id, 'E-40');
  assert.equal(imported.evidence[0].type, 'tool');
  assert.equal(imported.evidence[0].path, 'src/app.js');
  assert.equal(imported.evidence[0].redacted, true);
  assert.doesNotMatch(imported.evidence[0].quote, /fixture-secret-value/);
  assert.equal(imported.findings, undefined);
});

test('SARIF import redacts before truncation and masks invocation credentials', () => {
  const secret = 'boundary-secret-value';
  const imported = importSarif({
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'fixture-scanner', version: '1.0.0' } },
      invocations: [{ commandLine: 'scanner --token=command-secret-value' }],
      results: [{ message: { text: `${'x'.repeat(990)} token=${secret}` } }]
    }]
  });
  assert.doesNotMatch(imported.evidence[0].quote, /boundary-secret-value/);
  assert.doesNotMatch(imported.evidence[0].command, /command-secret-value/);
  assert.equal(imported.evidence[0].redacted, true);
});
