#!/usr/bin/env node
'use strict';

// Executes the published paired benchmark against standalone fixture copies.
// The control arm disables every discoverable filesystem skill. The treatment
// arm enables only the pinned godaudits skill. Both arms otherwise use the same
// model, harness configuration, repository, output schema, and repetition.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const groundTruthPath = path.join(root, 'benchmarks/accuracy-ground-truth.json');
const pairedPath = path.join(root, 'benchmarks/paired-runs.json');
const attemptsPath = path.join(root, 'benchmarks/run-attempts.json');
const schemaPath = path.join(root, 'benchmarks/accuracy-output.schema.json');
const catalogPath = path.join(root, 'skills/godaudits/catalog/checks.json');
const skillPath = fs.realpathSync(path.join(root, 'skills/godaudits/SKILL.md'));

function parseArgs(argv) {
  const options = {
    suite: 'a-sec-6',
    repetitions: 3,
    concurrency: 4,
    model: 'gpt-5.6-terra',
    effort: 'medium',
    cases: [],
    arms: ['control', 'skill'],
    plan: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--suite') options.suite = value;
    else if (arg === '--repetitions') options.repetitions = Number(value);
    else if (arg === '--concurrency') options.concurrency = Number(value);
    else if (arg === '--model') options.model = value;
    else if (arg === '--effort') options.effort = value;
    else if (arg === '--case') options.cases.push(value);
    else if (arg === '--arm') options.arms = value === 'all' ? ['control', 'skill'] : [value];
    else if (arg === '--plan') {
      options.plan = true;
      continue;
    } else throw new Error(`unknown argument ${arg}`);
    index += 1;
  }
  if (!Number.isInteger(options.repetitions) || options.repetitions < 1) throw new Error('--repetitions must be a positive integer');
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 8) {
    throw new Error('--concurrency must be an integer from 1 to 8');
  }
  if (!options.arms.every((arm) => ['control', 'skill'].includes(arm))) throw new Error('--arm must be control, skill, or all');
  return options;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function walkSkillFiles(start, found, visited) {
  if (!fs.existsSync(start)) return;
  let real;
  try {
    real = fs.realpathSync(start);
  } catch {
    return;
  }
  const stat = fs.statSync(real);
  if (stat.isFile()) {
    if (path.basename(real) === 'SKILL.md') found.add(real);
    return;
  }
  if (!stat.isDirectory() || visited.has(real)) return;
  visited.add(real);
  for (const name of fs.readdirSync(real)) walkSkillFiles(path.join(real, name), found, visited);
}

function discoverSkillFiles() {
  const found = new Set();
  const visited = new Set();
  for (const start of [
    path.join(os.homedir(), '.codex/skills'),
    path.join(os.homedir(), '.agents/skills'),
    path.join(root, '.agents/skills')
  ]) walkSkillFiles(start, found, visited);
  found.add(skillPath);
  return [...found].sort();
}

function escapeToml(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function skillConfig(allSkills, arm) {
  return `skills.config=[${allSkills.map((file) => {
    const enabled = arm === 'skill' && file === skillPath;
    return `{path="${escapeToml(file)}",enabled=${enabled ? 'true' : 'false'}}`;
  }).join(',')}]`;
}

function loadSuite(id) {
  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));
  const suite = groundTruth.suites.find((candidate) => candidate.id === id);
  if (!suite) throw new Error(`unknown suite ${id}`);
  return suite;
}

function checkDefinition(id) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const check = catalog.checks.find((candidate) => candidate.id === id);
  if (!check) throw new Error(`unknown catalog check ${id}`);
  return check;
}

function buildPrompt(arm, check) {
  const treatment = arm === 'skill'
    ? '$godaudits\nFollow the installed godaudits method for this focused, static, read-only check evaluation.'
    : 'No audit skill is installed for this control arm. Use your unaided code-review judgment and do not invoke a skill.';
  return `${treatment}

This is a blinded benchmark. Inspect every file in the repository and evaluate only ${check.id}. Ground truth, defect count, and control status are unavailable. Do not modify files, run the application, install packages, access the network, or inspect any path outside this repository.

Check:
${check.title}

Inspect:
${check.look}

Failure and severity rule:
${check.fail}

Return only the requested structured result. Use outcome pass only when repository evidence supports the check. Use unknown when the available repository cannot establish pass or fail. Every finding must cite the exact repository-relative path, 1-based line, and source quote.`;
}

function modelAttribution(model) {
  const cachePath = path.join(os.homedir(), '.codex/models_cache.json');
  let observed = new Date().toISOString();
  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (typeof cache.fetched_at === 'string' && cache.fetched_at) observed = cache.fetched_at;
  }
  return {
    provider: 'openai',
    id: model,
    snapshot: `service-alias:${model};catalog-fetched:${observed}`,
    snapshot_kind: 'service-alias',
    catalog_fetched_at: observed
  };
}

function harnessAttribution(options, check) {
  const versionResult = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  if (versionResult.status !== 0) throw new Error('codex CLI is unavailable');
  const version = versionResult.stdout.trim().replace(/^codex-cli\s+/, '');
  const schemaHash = sha256(fs.readFileSync(schemaPath));
  const config = {
    protocol: 'paired-static-v1',
    model: options.model,
    effort: options.effort,
    sandbox: 'read-only',
    ignore_user_config: true,
    ignore_rules: true,
    plugins_enabled: false,
    filesystem_skills_isolated: true,
    prompt_version: 1,
    output_schema_sha256: schemaHash,
    runner_sha256: sha256(fs.readFileSync(__filename)),
    check_definition_sha256: sha256(JSON.stringify({
      id: check.id,
      title: check.title,
      look: check.look,
      fail: check.fail
    }))
  };
  return {
    name: 'codex-cli',
    version,
    config_sha256: sha256(JSON.stringify(config)),
    config
  };
}

function copyFixture(suiteId, caseId) {
  const source = path.join(root, 'benchmarks/fixtures/accuracy', suiteId, caseId);
  if (!fs.existsSync(source)) throw new Error(`fixture directory is missing: ${source}`);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `godaudits-${suiteId}-${caseId}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function parseTranscript(stdout) {
  let audit = null;
  let usage = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'item.completed' && event.item && event.item.type === 'agent_message') {
      try {
        audit = JSON.parse(event.item.text);
      } catch {
        audit = null;
      }
    }
    if (event.type === 'turn.completed') usage = event.usage || null;
  }
  if (!audit) throw new Error('Codex did not return a structured audit');
  return { audit, usage };
}

function grade(caseData, audit) {
  const findings = Array.isArray(audit.findings) ? audit.findings : [];
  if (caseData.kind === 'control') {
    const falsePositives = audit.outcome === 'fail' ? Math.max(1, findings.length) : findings.length;
    return {
      outcome: audit.outcome,
      hits: 0,
      misses: 0,
      false_positives: falsePositives,
      severity_matches: 0,
      severity_mismatches: 0,
      citation_matches: 0,
      citation_mismatches: findings.length
    };
  }
  const expected = Array.isArray(caseData.findings) ? caseData.findings : [caseData];
  const used = new Set();
  const matches = [];
  if (audit.outcome === 'fail') {
    for (const expectedFinding of expected) {
      const acceptableLines = Array.isArray(expectedFinding.acceptable_lines)
        ? expectedFinding.acceptable_lines
        : [expectedFinding.line];
      const index = findings.findIndex((finding, candidateIndex) => !used.has(candidateIndex)
        && finding.path === expectedFinding.path
        && Number.isInteger(finding.line)
        && acceptableLines.some((line) => Math.abs(finding.line - line) <= 2));
      if (index >= 0) {
        used.add(index);
        matches.push({ expected: expectedFinding, actual: findings[index] });
      }
    }
  }
  const severityMatches = matches.filter((match) => match.actual.severity === match.expected.severity).length;
  return {
    outcome: audit.outcome,
    hits: matches.length,
    misses: expected.length - matches.length,
    false_positives: findings.length - matches.length,
    severity_matches: severityMatches,
    severity_mismatches: matches.length - severityMatches,
    citation_matches: matches.length,
    citation_mismatches: findings.length - matches.length
  };
}

function runCodex(task, context) {
  return new Promise((resolve, reject) => {
    const fixture = copyFixture(context.suite.id, task.caseData.id);
    const started = Date.now();
    const args = [
      'exec',
      '--ignore-user-config',
      '--ignore-rules',
      '--disable', 'plugins',
      '--ephemeral',
      '--skip-git-repo-check',
      '-C', fixture,
      '-s', 'read-only',
      '-m', context.options.model,
      '-c', `model_reasoning_effort="${context.options.effort}"`,
      '-c', skillConfig(context.allSkills, task.arm),
      '--output-schema', schemaPath,
      '--color', 'never',
      '--json',
      buildPrompt(task.arm, context.check)
    ];
    const child = spawn('codex', args, {
      cwd: fixture,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 180000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      fs.rmSync(fixture, { recursive: true, force: true });
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      fs.rmSync(fixture, { recursive: true, force: true });
      if (code !== 0) {
        reject(new Error(`Codex exited ${code}\nstdout:\n${stdout.trim().slice(-3000)}\nstderr:\n${stderr.trim().slice(-3000)}`));
        return;
      }
      try {
        const parsed = parseTranscript(stdout);
        resolve({ ...parsed, stdout, stderr, elapsed });
      } catch (error) {
        reject(new Error(`${error.message}; stderr: ${stderr.trim().slice(-1000)}`));
      }
    });
  });
}

async function runPool(tasks, concurrency, worker) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function take() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(tasks[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, take));
  return results;
}

function artifactPaths(task) {
  const base = path.join('benchmarks/runs/accuracy', task.suiteId, task.caseData.id, `rep-${task.repetition}`);
  return {
    audit: path.join(base, `${task.arm}.json`),
    transcript: path.join(base, `${task.arm}.jsonl`)
  };
}

function writeArtifact(relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function appendAttempt(attempt) {
  const ledger = JSON.parse(fs.readFileSync(attemptsPath, 'utf8'));
  ledger.attempts.push(attempt);
  fs.writeFileSync(attemptsPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

function recordPairedRun(run) {
  const paired = JSON.parse(fs.readFileSync(pairedPath, 'utf8'));
  paired.runs = (paired.runs || []).filter((existing) => !(existing.pair_id === run.pair_id && existing.arm === run.arm));
  paired.runs.push(run);
  paired.runs.sort((left, right) => left.repo.localeCompare(right.repo)
    || left.repetition - right.repetition
    || left.arm.localeCompare(right.arm));
  fs.writeFileSync(pairedPath, `${JSON.stringify(paired, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const suite = loadSuite(options.suite);
  const check = checkDefinition(suite.check);
  const selected = options.cases.length
    ? suite.cases.filter((caseData) => options.cases.includes(caseData.id))
    : suite.cases.filter((caseData) => caseData.eligible_for_lift !== false);
  if (selected.length === 0) throw new Error('no cases selected');
  if (options.cases.some((id) => !suite.cases.some((caseData) => caseData.id === id))) throw new Error('an unknown case was selected');

  const requestedTasks = [];
  for (const caseData of selected) {
    for (let repetition = 1; repetition <= options.repetitions; repetition += 1) {
      for (const arm of options.arms) requestedTasks.push({ suiteId: suite.id, caseData, repetition, arm });
    }
  }
  const recorded = JSON.parse(fs.readFileSync(pairedPath, 'utf8'));
  const completed = new Set((recorded.runs || []).map((run) => `${run.pair_id}\n${run.arm}`));
  const tasks = requestedTasks.filter((task) => {
    const pairId = `P-${suite.check}-${task.caseData.id.toUpperCase()}-R${task.repetition}`;
    return !completed.has(`${pairId}\n${task.arm}`);
  });

  const model = modelAttribution(options.model);
  const harness = harnessAttribution(options, check);
  const fixtureCommit = git('rev-parse', 'HEAD');
  const allSkills = discoverSkillFiles();
  const plan = {
    suite: suite.id,
    check: suite.check,
    cases: selected.map((caseData) => caseData.id),
    repetitions: options.repetitions,
    arms: options.arms,
    requested_runs: requestedTasks.length,
    pending_runs: tasks.length,
    concurrency: options.concurrency,
    model,
    harness,
    fixture_commit: fixtureCommit,
    skill_commit: fixtureCommit,
    isolated_filesystem_skills: allSkills.length
  };
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (options.plan) return;

  const context = { options, suite, check, allSkills };
  const results = await runPool(tasks, options.concurrency, async (task, index) => {
    const pairId = `P-${suite.check}-${task.caseData.id.toUpperCase()}-R${task.repetition}`;
    const attemptId = crypto.randomUUID();
    const started = new Date().toISOString();
    process.stdout.write(`[${index + 1}/${tasks.length}] ${task.caseData.id} repetition ${task.repetition} ${task.arm}\n`);
    try {
      const execution = await runCodex(task, context);
      const artifacts = artifactPaths(task);
      writeArtifact(artifacts.audit, `${JSON.stringify(execution.audit, null, 2)}\n`);
      writeArtifact(artifacts.transcript, execution.stdout);
      const run = {
        pair_id: pairId,
        arm: task.arm,
        repo: `${suite.id}/${task.caseData.id}`,
        check: suite.check,
        repetition: task.repetition,
        captured: new Date().toISOString().slice(0, 10),
        model,
        harness: {
          name: harness.name,
          version: harness.version,
          config_sha256: harness.config_sha256
        },
        fixture_commit: fixtureCommit,
        skill_commit: task.arm === 'skill' ? fixtureCommit : null,
        skill_installed: task.arm === 'skill',
        ground_truth_revision_at_run: suite.revision,
        grading_revision: suite.revision,
        eligible_for_lift: task.caseData.eligible_for_lift !== false,
        capabilities: ['static'],
        result: grade(task.caseData, execution.audit),
        artifacts,
        cost: {
          input_tokens: execution.usage && Number.isInteger(execution.usage.input_tokens) ? execution.usage.input_tokens : null,
          output_tokens: execution.usage && Number.isInteger(execution.usage.output_tokens) ? execution.usage.output_tokens : null,
          elapsed_ms: execution.elapsed
        }
      };
      recordPairedRun(run);
      appendAttempt({
        attempt_id: attemptId,
        pair_id: pairId,
        arm: task.arm,
        started,
        completed: new Date().toISOString(),
        status: 'recorded',
        transcript: artifacts.transcript,
        error: null
      });
      return { run, error: null };
    } catch (error) {
      appendAttempt({
        attempt_id: attemptId,
        pair_id: pairId,
        arm: task.arm,
        started,
        completed: new Date().toISOString(),
        status: 'technical-failure',
        transcript: null,
        error: error.message.slice(0, 2000)
      });
      return { run: null, error };
    }
  });

  const successful = results.filter((result) => result.run).map((result) => result.run);
  const failures = results.filter((result) => result.error);
  process.stdout.write(`${JSON.stringify({
    recorded: successful.length,
    technical_failures: failures.length,
    hits: successful.reduce((sum, run) => sum + run.result.hits, 0),
    misses: successful.reduce((sum, run) => sum + run.result.misses, 0),
    false_positives: successful.reduce((sum, run) => sum + run.result.false_positives, 0)
  }, null, 2)}\n`);
  if (failures.length) {
    for (const failure of failures) process.stderr.write(`${failure.error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildPrompt,
  grade,
  parseArgs,
  parseTranscript
};
