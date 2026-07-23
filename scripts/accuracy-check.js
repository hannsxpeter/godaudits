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
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/blind-runs.json'), 'utf8'));
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
if (program.program_version !== paired.program_version) errors.push('program and paired-run versions must match');
if (!program.protocol || !program.protocol.ground_truth_before_runs || !program.protocol.ground_truth_hidden_from_auditor) {
  errors.push('accuracy protocol must require hidden ground truth authored before runs');
}
if (!same(program.protocol.arms, ['control', 'skill'])) errors.push('accuracy protocol arms must be control then skill');
if (!program.protocol.same_model_repo_harness_within_pair) errors.push('paired protocol must pin model, repo, and harness within each pair');
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
for (const field of ['model.provider', 'model.id', 'model.snapshot', 'harness.name', 'harness.version', 'harness.config_sha256', 'fixture_commit', 'skill_commit']) {
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

const pairs = new Map();
for (const run of paired.runs || []) {
  requireText(run.pair_id, 'run.pair_id');
  requireText(run.repo, `${run.pair_id}.repo`);
  if (!targetChecks.has(run.check)) errors.push(`${run.pair_id} uses non-target check ${run.check}`);
  for (const field of ['provider', 'id', 'snapshot']) requireText(run.model && run.model[field], `${run.pair_id}.model.${field}`);
  for (const field of ['name', 'version', 'config_sha256']) requireText(run.harness && run.harness[field], `${run.pair_id}.harness.${field}`);
  requireText(run.fixture_commit, `${run.pair_id}.fixture_commit`);
  if (run.arm === 'control') {
    if (run.skill_installed !== false || run.skill_commit !== null) errors.push(`${run.pair_id} control arm must have skill_installed false and skill_commit null`);
  } else if (run.arm === 'skill') {
    if (run.skill_installed !== true) errors.push(`${run.pair_id} skill arm must have skill_installed true`);
    requireText(run.skill_commit, `${run.pair_id}.skill_commit`);
  } else errors.push(`${run.pair_id} has invalid arm ${run.arm}`);
  const group = pairs.get(run.pair_id) || [];
  if (group.some((item) => item.arm === run.arm)) errors.push(`${run.pair_id} duplicates arm ${run.arm}`);
  group.push(run);
  pairs.set(run.pair_id, group);
}

const pinnedFields = ['repo', 'check', 'repetition', 'model', 'harness', 'fixture_commit', 'capabilities'];
for (const [pairId, runs] of pairs) {
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

if (!legacy.attribution || !Object.prototype.hasOwnProperty.call(legacy.attribution, 'model')
  || !Object.prototype.hasOwnProperty.call(legacy.attribution, 'harness')) {
  errors.push('legacy blind runs must retain explicit model and harness attribution, including null');
}

const fixtureReady = (program.targets || []).filter((target) => ['fixture-ready', 'recorded'].includes(target.fixture_status)).length;
const recordedTargets = (program.targets || []).filter((target) => target.fixture_status === 'recorded').length;
const pairCounts = new Map();
for (const runs of pairs.values()) {
  if (runs.length !== 2) continue;
  const key = `${runs[0].check}\n${runs[0].repo}`;
  pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
}
const replicatedTargets = [...pairCounts.values()].filter((count) => count >= program.protocol.runs_per_arm).length;
const summary = {
  program_version: program.program_version,
  targets: targetDomains.size,
  fixture_ready: fixtureReady,
  recorded_targets: recordedTargets,
  paired_observations: pairs.size,
  replicated_targets: replicatedTargets,
  skill_lift_measured: replicatedTargets > 0,
  errors
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
