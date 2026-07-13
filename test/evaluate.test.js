'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluateAudit } = require('../skills/godaudits/runtime/lib/evaluate');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { validAudit } = require('./helpers');

test('evaluation reports precision, recall, severity, citations, and closure', () => {
  const audit = compileAudit(validAudit()).audit;
  const expected = {
    required_findings: [
      { check: 'A-SEC-3', severity: 'Critical', path: 'src/boards.js' }
    ],
    clean_checks: ['A-SEC-4']
  };
  const metrics = evaluateAudit(audit, expected);
  assert.equal(metrics.recall, 1);
  assert.equal(metrics.precision, 1);
  assert.equal(metrics.severity_accuracy, 1);
  assert.equal(metrics.citation_validity, 1);
  assert.equal(metrics.remediation_closure, 1);
});

test('evaluation treats a wrong-path citation as a miss', () => {
  const audit = compileAudit(validAudit()).audit;
  const metrics = evaluateAudit(audit, {
    required_findings: [{ check: 'A-SEC-3', severity: 'Critical', path: 'src/other.js' }],
    clean_checks: []
  });
  assert.equal(metrics.recall, 0);
  assert.equal(metrics.precision, 0);
  assert.equal(metrics.missed.length, 1);
});

test('resolved historical findings do not count as current false positives', () => {
  const input = validAudit();
  input.findings[0].status = 'resolved';
  input.tasks[0].status = 'done';
  input.domains[0].checks[0].outcome = 'pass';
  input.domains[0].checks[0].finding_ids = [];
  const audit = compileAudit(input).audit;
  const metrics = evaluateAudit(audit, { required_findings: [], clean_checks: ['A-SEC-3'] });
  assert.equal(metrics.precision, 1);
  assert.equal(metrics.false_positives, 0);
  assert.equal(metrics.clean_control_rate, 1);
});

test('evaluation rejects duplicate expected check-path pairs', () => {
  const audit = compileAudit(validAudit()).audit;
  assert.throws(() => evaluateAudit(audit, {
    required_findings: [
      { check: 'A-SEC-3', severity: 'Critical', path: 'src/boards.js' },
      { check: 'A-SEC-3', severity: 'Critical', path: 'src/boards.js' }
    ],
    clean_checks: []
  }), /duplicate check and path/);
});

test('clean-control rate counts unique violated checks and stays bounded', () => {
  const audit = compileAudit(validAudit()).audit;
  audit.findings.push({ ...audit.findings[0], id: 'F-SEC-2' });
  const metrics = evaluateAudit(audit, { required_findings: [], clean_checks: ['A-SEC-3'] });
  assert.equal(metrics.clean_control_rate, 0);
});
