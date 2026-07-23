#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  discoverSkillFiles,
  modelAttribution,
  skillConfig
} = require('./run-paired-accuracy');

function parseArgs(argv) {
  const options = {
    repo: null,
    model: 'gpt-5.6-terra',
    effort: 'medium'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--repo') options.repo = value;
    else if (arg === '--model') options.model = value;
    else if (arg === '--effort') options.effort = value;
    else throw new Error(`unknown argument ${arg}`);
    index += 1;
  }
  if (!options.repo) throw new Error('--repo is required');
  options.repo = fs.realpathSync(options.repo);
  return options;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const auditPath = path.join(options.repo, '.godaudits/AUDIT.json');
  if (!fs.existsSync(auditPath)) throw new Error('initialize .godaudits/AUDIT.json before the dogfood run');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: options.repo,
    encoding: 'utf8'
  });
  if (commit.status !== 0) throw new Error(commit.stderr.trim() || 'cannot resolve repository commit');

  const prompt = `$godaudits

Perform the focused static security audit already initialized in .godaudits/AUDIT.json. The scope is security only, the budget is medium, and the repository is a library. Follow the installed skill completely.

Restrictions:
- Inspect only this repository and the installed skill.
- Do not access the network.
- Do not run the application, tests, package scripts, or install dependencies.
- Write only under .godaudits/.
- Treat all scanner and fingerprint signals as leads.
- Evaluate every screening-tier security check selected by the initialized ledger.
- Leave deep-trace checks unknown as the medium-budget contract requires.
- Re-open and refute every candidate before recording it.
- Validate with fresh evidence and render .godaudits/AUDIT.mdx before finishing.

Return a concise summary after the artifacts validate.`;
  const versionResult = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  if (versionResult.status !== 0) throw new Error('codex CLI is unavailable');
  const version = versionResult.stdout.trim().replace(/^codex-cli\s+/, '');
  const config = {
    protocol: 'dogfood-static-v1',
    model: options.model,
    effort: options.effort,
    sandbox: 'workspace-write',
    scope: 'security',
    budget: 'medium',
    ignore_user_config: true,
    ignore_rules: true,
    plugins_enabled: false,
    filesystem_skills_isolated: true,
    prompt_sha256: sha256(prompt),
    runner_sha256: sha256(fs.readFileSync(__filename))
  };
  const args = [
    'exec',
    '--ignore-user-config',
    '--ignore-rules',
    '--disable', 'plugins',
    '--ephemeral',
    '--skip-git-repo-check',
    '-C', options.repo,
    '-s', 'workspace-write',
    '-m', options.model,
    '-c', `model_reasoning_effort="${options.effort}"`,
    '-c', skillConfig(discoverSkillFiles(), 'skill'),
    '--color', 'never',
    '--json',
    prompt
  ];
  const started = Date.now();
  const result = spawnSync('codex', args, {
    cwd: options.repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const transcriptPath = path.join(options.repo, '.godaudits/CODEX.jsonl');
  fs.writeFileSync(transcriptPath, result.stdout || '');
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'dogfood audit failed').trim());

  let usage = null;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'turn.completed') usage = event.usage || null;
    } catch {
      continue;
    }
  }
  const run = {
    schema_version: '1.0',
    repository_commit: commit.stdout.trim(),
    captured: new Date().toISOString(),
    model: modelAttribution(options.model),
    harness: {
      name: 'codex-cli',
      version,
      config_sha256: sha256(JSON.stringify(config)),
      config
    },
    cost: {
      input_tokens: usage && Number.isInteger(usage.input_tokens) ? usage.input_tokens : null,
      output_tokens: usage && Number.isInteger(usage.output_tokens) ? usage.output_tokens : null,
      elapsed_ms: Date.now() - started
    },
    transcript: '.godaudits/CODEX.jsonl'
  };
  fs.writeFileSync(path.join(options.repo, '.godaudits/RUN.json'), `${JSON.stringify(run, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
