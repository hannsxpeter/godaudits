#!/usr/bin/env node
'use strict';

// Internal detector-regression gate. Two failures turn this red:
//   1. A seeded defect maps to a check the catalog no longer has, so a rename
//      or deletion silently stopped detecting something we deliberately seeded.
//   2. A recorded audit stops detecting its seeded defect.
//
// This is a regression gate, not a reliability measurement: the audits are
// recorded outputs, and CI cannot re-derive them (a real audit is a model
// reading a repository). Nothing it prints is a claim about unseen code, and
// nothing it computes feeds a per-repo score.

const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');
const { validateAudit } = require('../skills/godaudits/runtime/lib/audit');
const { aggregateCorpus } = require('../skills/godaudits/runtime/lib/calibrate');

const root = path.resolve(__dirname, '..');
const corpusPath = path.join(root, 'benchmarks/detectors.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

const catalogChecks = new Set(buildCatalog(root).checks.map((check) => check.id));
const cases = corpus.cases.map((item) => ({
  name: item.name,
  provenance: item.provenance,
  expected: item.expected,
  audit: JSON.parse(fs.readFileSync(path.join(root, 'benchmarks', item.audit), 'utf8'))
}));

const orphaned = [];
const invalid = [];
for (const item of cases) {
  for (const required of item.expected.required_findings) {
    if (!catalogChecks.has(required.check)) orphaned.push(`${item.name} seeds ${required.check}, which the catalog no longer defines`);
  }
  for (const check of item.expected.clean_checks) {
    if (!catalogChecks.has(check)) orphaned.push(`${item.name} expects ${check} clean, which the catalog no longer defines`);
  }
  // The corpus is the one set of AUDIT.json objects a gate reads directly, so
  // hold it to the same invariants a real audit must satisfy. Otherwise the
  // fixtures backing the gate are exempt from the evidence rules the tool
  // enforces everywhere else.
  for (const error of validateAudit(item.audit)) invalid.push(`${item.name}: ${error}`);
}

const report = aggregateCorpus(cases);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

for (const message of orphaned) process.stderr.write(`orphaned seed: ${message}\n`);
for (const message of invalid) process.stderr.write(`invalid recorded audit: ${message}\n`);
for (const miss of report.missed) process.stderr.write(`undetected seed: ${miss.case} no longer detects ${miss.check} at ${miss.path}\n`);
for (const alarm of report.false_alarms) process.stderr.write(`false alarm: ${alarm.case} flags ${alarm.false_positives} finding(s) outside its seeded defects (clean control rate ${alarm.clean_control_rate})\n`);

if (orphaned.length || invalid.length || !report.passed) {
  process.stderr.write('Detector regression gate failed.\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`Detector gate: ${report.cases} seeded case(s), every seeded defect still detected.\n`);
}
