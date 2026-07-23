'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { importTool, ADAPTERS } = require('../skills/godaudits/runtime/lib/tool-import');

test('adapter registry exposes the documented tools including sarif', () => {
  assert.deepEqual(Object.keys(ADAPTERS).sort(), ['ast-grep', 'gitleaks', 'osv-scanner', 'sarif', 'semgrep']);
});

test('unknown adapter names fail with the known list', () => {
  assert.throws(() => importTool('bandit', {}), /unknown tool adapter: bandit .*gitleaks/);
});

test('semgrep adapter maps results to tool evidence with rule scope', () => {
  const imported = importTool('semgrep', {
    version: '1.91.0',
    results: [
      {
        check_id: 'javascript.express.security.audit.xss.direct-response-write',
        path: 'src/routes.js',
        start: { line: 42 },
        extra: { message: 'User-controlled data written directly into the response.' }
      },
      {
        check_id: 'generic.none',
        extra: {}
      }
    ]
  }, { source: 'reports/semgrep.json', start: 5, command: 'semgrep scan --json src' });
  assert.equal(imported.schema_version, '1.0');
  assert.equal(imported.source, 'semgrep.json');
  assert.equal(imported.evidence.length, 2);
  const first = imported.evidence[0];
  assert.equal(first.id, 'E-5');
  assert.equal(first.tool, 'semgrep');
  assert.equal(first.tool_version, '1.91.0');
  assert.equal(first.path, 'src/routes.js');
  assert.equal(first.line, 42);
  assert.equal(first.scope, 'rule javascript.express.security.audit.xss.direct-response-write');
  assert.equal(first.sensitive, false);
  assert.equal(imported.evidence[1].id, 'E-6');
  assert.equal(imported.evidence[1].path, undefined);
  assert.match(imported.evidence[1].quote, /message/);
});

test('semgrep adapter rejects non-report input', () => {
  assert.throws(() => importTool('semgrep', { runs: [] }), /semgrep input must be a JSON report/);
});

test('ast-grep adapter converts zero-based lines and rule metadata', () => {
  const imported = importTool('ast-grep', [{
    file: 'src/handler.ts',
    range: { start: { line: 8, column: 2 }, end: { line: 8, column: 19 } },
    ruleId: 'unbound-selector',
    severity: 'error',
    message: 'Request selector reaches an unscoped lookup.',
    text: 'findById(req.id)'
  }], {
    source: 'ast-grep.json',
    toolVersion: '0.39.5',
    command: 'ast-grep scan --json=pretty'
  });
  const record = imported.evidence[0];
  assert.equal(record.tool, 'ast-grep');
  assert.equal(record.tool_version, '0.39.5');
  assert.equal(record.path, 'src/handler.ts');
  assert.equal(record.line, 9);
  assert.equal(record.scope, 'rule unbound-selector');
  assert.equal(record.quote, 'Request selector reaches an unscoped lookup.');
});

test('ast-grep adapter accepts pattern matches without lint metadata', () => {
  const imported = importTool('ast-grep', [{
    file: 'src/worker.rs',
    range: { start: { line: 0, column: 0 }, end: { line: 0, column: 5 } },
    lines: 'spawn(task)'
  }], { toolVersion: '0.39.5', command: 'ast-grep run --json=compact -p spawn' });
  assert.equal(imported.evidence[0].line, 1);
  assert.equal(imported.evidence[0].scope, undefined);
  assert.equal(imported.evidence[0].quote, 'spawn(task)');
});

test('ast-grep adapter rejects non-array input', () => {
  assert.throws(() => importTool('ast-grep', { matches: [] }), /ast-grep input must be a JSON array/);
});

test('gitleaks adapter never emits the secret, only its fingerprint', () => {
  const secret = 'AKIAIOSFODNN7EXAMPLE';
  const imported = importTool('gitleaks', [
    {
      RuleID: 'aws-access-key',
      Description: 'Detected an AWS access key',
      File: 'config/production.env',
      StartLine: '7',
      Secret: secret
    }
  ], { source: 'gitleaks.json', toolVersion: '8.28.0', command: 'gitleaks dir --report-format json' });
  assert.equal(imported.evidence.length, 1);
  const record = imported.evidence[0];
  assert.equal(record.tool, 'gitleaks');
  assert.equal(record.path, 'config/production.env');
  assert.equal(record.line, 7);
  assert.equal(record.sensitive, true);
  assert.equal(record.redacted, true);
  assert.ok(!JSON.stringify(imported).includes(secret));
  assert.match(record.quote, /secret sha256:[a-f0-9]{12}/);
});

test('gitleaks fingerprints are stable for correlation and differ per secret', () => {
  const run = (secret) => importTool('gitleaks', [{ RuleID: 'r', Description: 'd', Secret: secret }], {
    toolVersion: '8.28.0',
    command: 'gitleaks dir --report-format json'
  }).evidence[0].quote;
  assert.equal(run('same-secret-value'), run('same-secret-value'));
  assert.notEqual(run('same-secret-value'), run('other-secret-value'));
});

test('gitleaks adapter rejects non-array input', () => {
  assert.throws(() => importTool('gitleaks', { findings: [] }), /gitleaks input must be a JSON array/);
});

test('osv-scanner adapter emits one record per package vulnerability', () => {
  const imported = importTool('osv-scanner', {
    results: [
      {
        packages: [
          {
            package: { name: 'lodash', version: '4.17.20', ecosystem: 'npm' },
            vulnerabilities: [
              { id: 'GHSA-35jh-r3h4-6jhm', summary: 'Prototype pollution in lodash' },
              { id: 'GHSA-xxxx-yyyy-zzzz' }
            ]
          }
        ]
      }
    ]
  }, { source: 'osv.json', toolVersion: '2.3.8', command: 'osv-scanner scan --format json .' });
  assert.equal(imported.evidence.length, 2);
  assert.equal(imported.evidence[0].tool, 'osv-scanner');
  assert.equal(imported.evidence[0].scope, 'package lodash@4.17.20');
  assert.match(imported.evidence[0].quote, /^GHSA-35jh-r3h4-6jhm: Prototype pollution/);
  assert.match(imported.evidence[1].quote, /without a summary/);
});

test('osv-scanner adapter rejects non-report input', () => {
  assert.throws(() => importTool('osv-scanner', []), /osv-scanner input must be a JSON report/);
});

test('sarif remains available through the generalized importer', () => {
  const imported = importTool('sarif', {
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'codeql', semanticVersion: '2.17.0' } },
      results: [{ ruleId: 'js/sql-injection', message: { text: 'Database query built from user input.' } }]
    }]
  }, { source: 'scan.sarif', command: 'codeql database analyze --format sarif' });
  assert.equal(imported.evidence[0].tool, 'codeql');
  assert.equal(imported.evidence[0].scope, 'rule js/sql-injection');
});

test('generalized SARIF import rejects missing embedded provenance', () => {
  assert.throws(() => importTool('sarif', {
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'scanner' } },
      results: [{ message: { text: 'A lead.' } }]
    }]
  }), /requires --tool-version/);
  assert.throws(() => importTool('sarif', {
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'scanner', version: '1.0.0' } },
      results: [{ message: { text: 'A lead.' } }]
    }]
  }), /requires --command/);
});

test('imported evidence satisfies the tool-evidence schema contract', () => {
  const imported = importTool('gitleaks', [{ RuleID: 'r', Description: 'd', Secret: 'abcdefghij' }], {
    toolVersion: '8.28.0',
    command: 'gitleaks dir --report-format json'
  });
  for (const record of imported.evidence) {
    assert.match(record.id, /^E-[0-9]+$/);
    assert.equal(record.type, 'tool');
    for (const field of ['tool', 'tool_version', 'command', 'quote']) assert.ok(record[field] && typeof record[field] === 'string', field);
    assert.equal(typeof record.sensitive, 'boolean');
    assert.equal(typeof record.redacted, 'boolean');
    assert.equal(record.sensitive && !record.redacted, false);
  }
});

test('non-SARIF adapters reject missing provenance instead of writing unknown versions', () => {
  assert.throws(
    () => importTool('gitleaks', [], { command: 'gitleaks dir --report-format json' }),
    /requires --tool-version/
  );
  assert.throws(
    () => importTool('semgrep', { version: '1.164.0', results: [] }),
    /requires --command/
  );
});

test('scanner command credentials are redacted in every emitted record', () => {
  const imported = importTool('semgrep', {
    version: '1.164.0',
    results: [{ extra: { message: 'A finding.' } }]
  }, { command: 'semgrep scan --token=command-secret-value --json' });
  assert.doesNotMatch(imported.evidence[0].command, /command-secret-value/);
  assert.equal(imported.evidence[0].redacted, true);
});
