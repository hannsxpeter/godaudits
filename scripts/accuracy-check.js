#!/usr/bin/env node
'use strict';

// Validates the standing model-accuracy program without running a model. The
// gate pins one highest-weight target per domain, requires non-null attribution
// on every new run, and refuses unpaired control/skill observations. Empty
// paired-runs data is valid but explicitly reports that skill lift is not yet
// measured.

const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');

const root = path.resolve(__dirname, '..');
const program = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/accuracy-program.json'), 'utf8'));
const paired = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/paired-runs.json'), 'utf8'));
const attempts = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/run-attempts.json'), 'utf8'));
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/blind-runs.json'), 'utf8'));
const groundTruth = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/accuracy-ground-truth.json'), 'utf8'));
const catalog = buildCatalog(root);
const errors = [];

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

if (program.schema_version !== '1.0') errors.push('accuracy program schema_version must be 1.0');
if (paired.schema_version !== '1.0') errors.push('paired runs schema_version must be 1.0');
if (attempts.schema_version !== '1.0' || !Array.isArray(attempts.attempts)) errors.push('run attempts must use schema_version 1.0 and contain attempts');
if (program.program_version !== paired.program_version) errors.push('program and paired-run versions must match');
if (!program.protocol || !program.protocol.ground_truth_before_runs || !program.protocol.ground_truth_hidden_from_auditor) {
  errors.push('accuracy protocol must require hidden ground truth authored before runs');
}
if (!same(program.protocol.arms, ['control', 'skill'])) errors.push('accuracy protocol arms must be control then skill');
if (!program.protocol.same_model_repo_harness_within_pair) errors.push('paired protocol must pin model, repo, and harness within each pair');
if (!program.protocol.complete_suite_required_for_lift) errors.push('skill lift must require a complete seeded and control suite');
if (!Number.isInteger(program.protocol.seeded_repositories_per_target) || program.protocol.seeded_repositories_per_target < 1) {
  errors.push('accuracy protocol needs at least one seeded repository per target');
}
if (!Number.isInteger(program.protocol.clean_controls_per_target) || program.protocol.clean_controls_per_target < 1) {
  errors.push('accuracy protocol needs at least one clean control per target');
}
if (!Number.isInteger(program.protocol.runs_per_arm) || program.protocol.runs_per_arm < 3) {
  errors.push('accuracy protocol needs at least three runs per arm');
}
const attribution = new Set(program.protocol.required_attribution || []);
for (const field of [
  'model.provider',
  'model.id',
  'model.snapshot',
  'model.snapshot_kind',
  'model.catalog_fetched_at',
  'harness.name',
  'harness.version',
  'harness.config_sha256',
  'fixture_commit',
  'skill_commit'
]) {
  if (!attribution.has(field)) errors.push(`accuracy protocol required_attribution is missing ${field}`);
}

const targetDomains = new Set();
const targetChecks = new Set();
for (const target of program.targets || []) {
  if (targetDomains.has(target.domain)) errors.push(`duplicate accuracy target domain ${target.domain}`);
  if (targetChecks.has(target.check)) errors.push(`duplicate accuracy target check ${target.check}`);
  targetDomains.add(target.domain);
  targetChecks.add(target.check);
  const candidates = catalog.checks
    .filter((check) => check.domain === target.domain)
    .sort((left, right) => right.default_weight - left.default_weight
      || Number(left.id.match(/\d+$/)[0]) - Number(right.id.match(/\d+$/)[0]));
  const expected = candidates[0];
  if (!expected) {
    errors.push(`accuracy target names unknown domain ${target.domain}`);
    continue;
  }
  if (target.check !== expected.id) errors.push(`${target.domain} target must be highest-weight tie-break ${expected.id}, got ${target.check}`);
  if (Math.abs(target.default_weight - expected.default_weight) > 0.00000001) {
    errors.push(`${target.check} target weight must be ${expected.default_weight}, got ${target.default_weight}`);
  }
  if (!Number.isInteger(target.ground_truth_revision) || target.ground_truth_revision < 1) {
    errors.push(`${target.check} needs a positive ground_truth_revision`);
  }
  if (!['ground-truth-authored', 'fixture-ready', 'recorded'].includes(target.fixture_status)) {
    errors.push(`${target.check} has invalid fixture_status ${target.fixture_status}`);
  }
  if (!['Critical', 'High', 'Medium', 'Low'].includes(target.severity)) errors.push(`${target.check} has invalid severity`);
  requireText(target.seed, `${target.check}.seed`);
  requireText(target.clean_control, `${target.check}.clean_control`);
}

const catalogDomains = new Set(catalog.domains.map((domain) => domain.id));
for (const domain of catalogDomains) if (!targetDomains.has(domain)) errors.push(`accuracy program is missing domain ${domain}`);
for (const domain of targetDomains) if (!catalogDomains.has(domain)) errors.push(`accuracy program has unknown domain ${domain}`);

const groundTruthCases = new Map();
const suitesByCheck = new Map();
for (const suite of groundTruth.suites || []) {
  if (suitesByCheck.has(suite.check)) errors.push(`duplicate ground-truth suite for ${suite.check}`);
  suitesByCheck.set(suite.check, suite);
  const seeded = (suite.cases || []).filter((caseData) => caseData.kind === 'seeded' && caseData.eligible_for_lift !== false);
  const controls = (suite.cases || []).filter((caseData) => caseData.kind === 'control' && caseData.eligible_for_lift !== false);
  if (seeded.length !== program.protocol.seeded_repositories_per_target) {
    errors.push(`${suite.id} must have ${program.protocol.seeded_repositories_per_target} seeded repositories`);
  }
  if (controls.length !== program.protocol.clean_controls_per_target) {
    errors.push(`${suite.id} must have ${program.protocol.clean_controls_per_target} clean controls`);
  }
  const caseIds = new Set();
  for (const caseData of suite.cases || []) {
    if (caseIds.has(caseData.id)) errors.push(`${suite.id} duplicates case ${caseData.id}`);
    caseIds.add(caseData.id);
    const key = `${suite.id}/${caseData.id}`;
    groundTruthCases.set(key, { ...caseData, suite });
    const fixture = path.join(root, 'benchmarks/fixtures/accuracy', suite.id, caseData.id);
    if (!fs.existsSync(fixture) || !fs.statSync(fixture).isDirectory()) errors.push(`${key} fixture directory is missing`);
  }
}
for (const target of program.targets || []) {
  if (['fixture-ready', 'recorded'].includes(target.fixture_status) && !suitesByCheck.has(target.check)) {
    errors.push(`${target.check} is ${target.fixture_status} without a complete ground-truth suite`);
  }
  const suite = suitesByCheck.get(target.check);
  if (suite && target.ground_truth_revision !== suite.revision) {
    errors.push(`${target.check} target revision ${target.ground_truth_revision} does not match suite revision ${suite.revision}`);
  }
}

const pairs = new Map();
for (const run of paired.runs || []) {
  requireText(run.pair_id, 'run.pair_id');
  requireText(run.repo, `${run.pair_id}.repo`);
  if (!targetChecks.has(run.check)) errors.push(`${run.pair_id} uses non-target check ${run.check}`);
  for (const field of ['provider', 'id', 'snapshot', 'snapshot_kind', 'catalog_fetched_at']) {
    requireText(run.model && run.model[field], `${run.pair_id}.model.${field}`);
  }
  if (run.model && !['immutable', 'service-alias'].includes(run.model.snapshot_kind)) {
    errors.push(`${run.pair_id}.model.snapshot_kind must be immutable or service-alias`);
  }
  if (run.model && run.model.snapshot_kind === 'service-alias' && !run.model.snapshot.includes('service-alias:')) {
    errors.push(`${run.pair_id} must label a mutable model alias honestly`);
  }
  for (const field of ['name', 'version', 'config_sha256']) requireText(run.harness && run.harness[field], `${run.pair_id}.harness.${field}`);
  requireText(run.fixture_commit, `${run.pair_id}.fixture_commit`);
  const groundCase = groundTruthCases.get(run.repo);
  if (!groundCase) errors.push(`${run.pair_id} names unknown ground-truth repo ${run.repo}`);
  else if (groundCase.suite.check !== run.check) errors.push(`${run.pair_id} check does not match ${run.repo}`);
  else {
    if (run.eligible_for_lift !== (groundCase.eligible_for_lift !== false)) {
      errors.push(`${run.pair_id} eligibility does not match ground truth`);
    }
    if (!Number.isInteger(run.ground_truth_revision_at_run) || run.ground_truth_revision_at_run < 1
      || run.ground_truth_revision_at_run > groundCase.suite.revision) {
      errors.push(`${run.pair_id} has invalid ground_truth_revision_at_run`);
    }
    if (run.grading_revision !== groundCase.suite.revision) {
      errors.push(`${run.pair_id} grading revision must be current suite revision ${groundCase.suite.revision}`);
    }
  }
  if (run.arm === 'control') {
    if (run.skill_installed !== false || run.skill_commit !== null) errors.push(`${run.pair_id} control arm must have skill_installed false and skill_commit null`);
  } else if (run.arm === 'skill') {
    if (run.skill_installed !== true) errors.push(`${run.pair_id} skill arm must have skill_installed true`);
    requireText(run.skill_commit, `${run.pair_id}.skill_commit`);
  } else errors.push(`${run.pair_id} has invalid arm ${run.arm}`);
  for (const field of [
    'hits',
    'misses',
    'false_positives',
    'severity_matches',
    'severity_mismatches',
    'citation_matches',
    'citation_mismatches'
  ]) {
    if (!run.result || !Number.isInteger(run.result[field]) || run.result[field] < 0) {
      errors.push(`${run.pair_id}.result.${field} must be a non-negative integer`);
    }
  }
  const group = pairs.get(run.pair_id) || [];
  if (group.some((item) => item.arm === run.arm)) errors.push(`${run.pair_id} duplicates arm ${run.arm}`);
  group.push(run);
  pairs.set(run.pair_id, group);
}

const pinnedFields = ['repo', 'check', 'repetition', 'model', 'harness', 'fixture_commit', 'grading_revision', 'eligible_for_lift', 'capabilities'];
for (const [pairId, runs] of pairs) {
  const groundCase = groundTruthCases.get(runs[0].repo);
  if (groundCase && groundCase.eligible_for_lift === false) continue;
  if (runs.length !== 2 || !runs.some((run) => run.arm === 'control') || !runs.some((run) => run.arm === 'skill')) {
    errors.push(`${pairId} must contain exactly one control arm and one skill arm`);
    continue;
  }
  const control = runs.find((run) => run.arm === 'control');
  const skill = runs.find((run) => run.arm === 'skill');
  for (const field of pinnedFields) {
    if (!same(control[field], skill[field])) errors.push(`${pairId} differs across arms at ${field}`);
  }
}

const attemptIds = new Set();
let technicalFailures = 0;
for (const attempt of attempts.attempts || []) {
  if (attemptIds.has(attempt.attempt_id)) errors.push(`duplicate attempt id ${attempt.attempt_id}`);
  attemptIds.add(attempt.attempt_id);
  if (!['control', 'skill'].includes(attempt.arm)) errors.push(`${attempt.attempt_id} has invalid arm`);
  if (attempt.status === 'recorded') {
    const runs = pairs.get(attempt.pair_id) || [];
    if (!runs.some((run) => run.arm === attempt.arm)) errors.push(`${attempt.attempt_id} recorded without a paired-run observation`);
    if (typeof attempt.transcript !== 'string' || !attempt.transcript) errors.push(`${attempt.attempt_id} recorded without a transcript`);
    else if (!fs.existsSync(path.join(root, attempt.transcript))) errors.push(`${attempt.attempt_id} transcript does not exist`);
    if (attempt.error !== null) errors.push(`${attempt.attempt_id} recorded with an error`);
  } else if (attempt.status === 'technical-failure') {
    technicalFailures += 1;
    if (attempt.transcript !== null) errors.push(`${attempt.attempt_id} technical failure must not claim a transcript`);
    requireText(attempt.error, `${attempt.attempt_id}.error`);
  } else errors.push(`${attempt.attempt_id} has invalid status`);
}

if (!legacy.attribution || !Object.prototype.hasOwnProperty.call(legacy.attribution, 'model')
  || !Object.prototype.hasOwnProperty.call(legacy.attribution, 'harness')) {
  errors.push('legacy blind runs must retain explicit model and harness attribution, including null');
}

const fixtureReady = (program.targets || []).filter((target) => ['fixture-ready', 'recorded'].includes(target.fixture_status)).length;
const recordedTargets = (program.targets || []).filter((target) => target.fixture_status === 'recorded').length;
const pairCounts = new Map();
for (const runs of pairs.values()) {
  const groundCase = groundTruthCases.get(runs[0].repo);
  if (runs.length !== 2 || !groundCase || groundCase.eligible_for_lift === false) continue;
  const key = `${runs[0].check}\n${runs[0].repo}`;
  pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
}
const completeSuites = [];
for (const suite of groundTruth.suites || []) {
  const complete = (suite.cases || []).filter((caseData) => caseData.eligible_for_lift !== false).every((caseData) => {
    const key = `${suite.check}\n${suite.id}/${caseData.id}`;
    return (pairCounts.get(key) || 0) >= program.protocol.runs_per_arm;
  });
  if (complete) completeSuites.push(suite.check);
}

function summarizeArm(arm) {
  const runs = (paired.runs || []).filter((run) => run.arm === arm && run.eligible_for_lift !== false);
  const totals = {
    runs: runs.length,
    hits: 0,
    misses: 0,
    false_positives: 0,
    severity_matches: 0,
    severity_mismatches: 0,
    citation_matches: 0,
    citation_mismatches: 0,
    clean_controls: 0,
    clean_controls_without_false_positive: 0,
    input_tokens: 0,
    output_tokens: 0,
    elapsed_ms: 0
  };
  for (const run of runs) {
    for (const field of [
      'hits',
      'misses',
      'false_positives',
      'severity_matches',
      'severity_mismatches',
      'citation_matches',
      'citation_mismatches'
    ]) totals[field] += run.result[field] || 0;
    const groundCase = groundTruthCases.get(run.repo);
    if (groundCase && groundCase.kind === 'control') {
      totals.clean_controls += 1;
      if (run.result.false_positives === 0) totals.clean_controls_without_false_positive += 1;
    }
    if (run.cost && Number.isInteger(run.cost.input_tokens)) totals.input_tokens += run.cost.input_tokens;
    if (run.cost && Number.isInteger(run.cost.output_tokens)) totals.output_tokens += run.cost.output_tokens;
    if (run.cost && Number.isInteger(run.cost.elapsed_ms)) totals.elapsed_ms += run.cost.elapsed_ms;
  }
  const recallDenominator = totals.hits + totals.misses;
  const precisionDenominator = totals.hits + totals.false_positives;
  const severityDenominator = totals.severity_matches + totals.severity_mismatches;
  return {
    ...totals,
    recall: recallDenominator ? Number((totals.hits / recallDenominator).toFixed(4)) : null,
    precision: precisionDenominator ? Number((totals.hits / precisionDenominator).toFixed(4)) : null,
    severity_accuracy: severityDenominator ? Number((totals.severity_matches / severityDenominator).toFixed(4)) : null,
    clean_control_rate: totals.clean_controls
      ? Number((totals.clean_controls_without_false_positive / totals.clean_controls).toFixed(4))
      : null
  };
}

const armResults = {
  control: summarizeArm('control'),
  skill: summarizeArm('skill')
};
const summary = {
  program_version: program.program_version,
  targets: targetDomains.size,
  fixture_ready: fixtureReady,
  recorded_targets: recordedTargets,
  paired_observations: pairs.size,
  eligible_paired_observations: [...pairs.values()].filter((runs) => {
    const groundCase = groundTruthCases.get(runs[0].repo);
    return runs.length === 2 && groundCase && groundCase.eligible_for_lift !== false;
  }).length,
  complete_suites: completeSuites,
  skill_lift_measured: completeSuites.length > 0,
  technical_failures: technicalFailures,
  arms: armResults,
  errors
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
