#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { grade } = require('./run-paired-accuracy');

const root = path.resolve(__dirname, '..');
const groundTruthPath = path.join(root, 'benchmarks/accuracy-ground-truth.json');
const pairedRunsPath = path.join(root, 'benchmarks/paired-runs.json');
const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));
const pairedRuns = JSON.parse(fs.readFileSync(pairedRunsPath, 'utf8'));
const cases = new Map();

for (const suite of groundTruth.suites || []) {
  for (const caseData of suite.cases || []) {
    cases.set(`${suite.id}/${caseData.id}`, { caseData, suite });
  }
}

for (const run of pairedRuns.runs || []) {
  const entry = cases.get(run.repo);
  if (!entry) throw new Error(`No ground truth for ${run.repo}`);
  const auditPath = path.resolve(root, run.artifacts.audit);
  if (!auditPath.startsWith(`${root}${path.sep}`)) throw new Error(`Audit path leaves repository: ${run.artifacts.audit}`);
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  run.result = grade(entry.caseData, audit);
  run.grading_revision = entry.suite.revision;
  run.eligible_for_lift = entry.caseData.eligible_for_lift !== false;
}

fs.writeFileSync(pairedRunsPath, `${JSON.stringify(pairedRuns, null, 2)}\n`);

const totals = (pairedRuns.runs || []).reduce((summary, run) => {
  summary.runs += 1;
  summary.hits += run.result.hits;
  summary.misses += run.result.misses;
  summary.unscored_true_findings += run.result.unscored_true_findings;
  summary.duplicate_findings += run.result.duplicate_findings;
  summary.false_positives += run.result.false_positives;
  return summary;
}, {
  runs: 0,
  hits: 0,
  misses: 0,
  unscored_true_findings: 0,
  duplicate_findings: 0,
  false_positives: 0
});
process.stdout.write(`${JSON.stringify(totals, null, 2)}\n`);
