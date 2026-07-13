#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const suites = [
  ['Pillars 1.1 routing', 'test/pillars.test.js'],
  ['project forms, profiles, overlays, and arc artifacts', 'test/project-context.test.js'],
  ['evidence freshness', 'test/freshness.test.js'],
  ['OWASP standards coverage', 'test/standards.test.js'],
  ['secret-safe deterministic evidence', 'test/evidence.test.js']
];

const results = suites.map(([name, file]) => {
  const run = spawnSync(process.execPath, ['--test', file], { cwd: root, encoding: 'utf8' });
  return {
    name,
    file,
    passed: run.status === 0,
    ...(run.status === 0 ? {} : { output: `${run.stdout || ''}${run.stderr || ''}`.trim() })
  };
});

const summary = {
  schema_version: '1.0',
  suites: results.length,
  passed: results.filter((result) => result.passed).length,
  results
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exitCode = summary.passed === summary.suites ? 0 : 1;
