#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildCatalog } = require('./lib/catalog');
const { compileAudit } = require('./lib/audit');
const { fingerprintRepository } = require('./lib/evidence');
const { evaluateAudit } = require('./lib/evaluate');
const { diffAudits } = require('./lib/diff');
const { initAudit } = require('./lib/init');
const { renderAudit } = require('./lib/render');
const { auditToSarif } = require('./lib/sarif');
const { importSarif } = require('./lib/sarif-import');

const skillRoot = path.resolve(__dirname, '..');
const packageRoot = path.resolve(skillRoot, '..', '..');

function usage() {
  return `godaudits evidence [repo] [--output file]
godaudits catalog [--output file]
godaudits init --name slug --archetype type --scale scale --profile balanced --applicable all|domain,domain [--output file]
godaudits validate <AUDIT.json> [--write]
godaudits render <AUDIT.json> [--output AUDIT.mdx]
godaudits sarif <AUDIT.json> [--output AUDIT.sarif]
godaudits import-sarif <tool.sarif> [--start 1] [--output TOOL-EVIDENCE.json]
godaudits diff <previous.json> <current.json>
godaudits evaluate <AUDIT.json> <expected.json>
godaudits benchmark [directory]
godaudits doctor`;
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function writeOrPrint(value, output) {
  const text = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, text);
    process.stdout.write(`Wrote ${path.resolve(output)}\n`);
  } else process.stdout.write(text);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function benchmark(corpusFile) {
  const file = path.resolve(corpusFile || path.join(packageRoot, 'benchmarks/corpus.json'));
  const corpus = readJson(file);
  const root = path.dirname(file);
  if (corpus.schema_version !== '1.0' || !Array.isArray(corpus.fixtures) || corpus.fixtures.length === 0) {
    throw new Error('benchmark corpus must use schema_version 1.0 and contain fixtures');
  }
  const names = new Set();
  for (const fixture of corpus.fixtures) {
    if (!fixture.name || names.has(fixture.name)) throw new Error(`benchmark fixture name is missing or duplicated: ${fixture.name || 'missing'}`);
    names.add(fixture.name);
    if (!fixture.repo || path.isAbsolute(fixture.repo) || path.resolve(root, fixture.repo).indexOf(`${root}${path.sep}`) !== 0) {
      throw new Error(`${fixture.name} repository must stay inside the corpus directory`);
    }
    if (!fs.statSync(path.resolve(root, fixture.repo)).isDirectory()) throw new Error(`${fixture.name} repository does not exist`);
    if (!fixture.expected_archetype) throw new Error(`${fixture.name} expected_archetype is required`);
    for (const field of ['required_signals', 'forbidden_signals', 'required_absences']) {
      if (fixture[field] !== undefined && !Array.isArray(fixture[field])) throw new Error(`${fixture.name}.${field} must be an array`);
    }
  }
  const results = corpus.fixtures.map((fixture) => {
    const fingerprint = fingerprintRepository(path.join(root, fixture.repo));
    const kinds = new Set(fingerprint.signals.map((signal) => signal.kind));
    const absences = new Set(fingerprint.absence_evidence.map((item) => item.subject));
    const failures = [];
    if (fingerprint.archetype.primary !== fixture.expected_archetype) failures.push(`archetype ${fingerprint.archetype.primary}`);
    for (const kind of fixture.required_signals || []) if (!kinds.has(kind)) failures.push(`missing signal ${kind}`);
    for (const kind of fixture.forbidden_signals || []) if (kinds.has(kind)) failures.push(`forbidden signal ${kind}`);
    for (const subject of fixture.required_absences || []) if (!absences.has(subject)) failures.push(`missing absence ${subject}`);
    const secretFragments = [...(fixture.secret_fragments || []), ...(fixture.secret_fragment ? [fixture.secret_fragment] : [])];
    for (const fragment of secretFragments) if (JSON.stringify(fingerprint).includes(fragment)) failures.push(`secret fragment was not redacted: ${fragment}`);
    return { name: fixture.name, passed: failures.length === 0, failures };
  });
  const summary = { cases: results.length, passed: results.filter((item) => item.passed).length, results };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary.passed === summary.cases ? 0 : 1;
}

function main() {
  const [, , command, ...args] = process.argv;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (command === 'evidence') {
    const repo = args.find((arg) => !arg.startsWith('--') && arg !== option(args, '--output')) || process.cwd();
    writeOrPrint(fingerprintRepository(repo), option(args, '--output'));
    return 0;
  }
  if (command === 'catalog') {
    writeOrPrint(buildCatalog(skillRoot), option(args, '--output'));
    return 0;
  }
  if (command === 'init') {
    const name = option(args, '--name');
    const archetype = option(args, '--archetype');
    const scale = option(args, '--scale');
    const applicableValue = option(args, '--applicable');
    if (!name || !archetype || !scale || !applicableValue) throw new Error('init requires --name, --archetype, --scale, and --applicable');
    const applicable = applicableValue === 'all' ? 'all' : applicableValue.split(',').filter(Boolean);
    const audit = initAudit(buildCatalog(skillRoot), {
      name,
      archetype,
      scale,
      riskProfile: option(args, '--profile', 'balanced'),
      applicable,
      root: option(args, '--repo', process.cwd()),
      planAware: args.includes('--plan-aware'),
      policyPack: option(args, '--policy-pack', 'provider-neutral@1')
    });
    writeOrPrint(audit, option(args, '--output', '.godaudits/AUDIT.json'));
    return 0;
  }
  if (command === 'validate') {
    if (!args[0]) throw new Error('validate requires AUDIT.json');
    const result = compileAudit(readJson(args[0]), {
      catalog: buildCatalog(skillRoot),
      allowDerivedRewrite: args.includes('--write')
    });
    if (result.errors.length) {
      process.stderr.write(`${result.errors.map((error) => `- ${error}`).join('\n')}\n`);
      return 1;
    }
    if (args.includes('--write')) fs.writeFileSync(path.resolve(args[0]), `${JSON.stringify(result.audit, null, 2)}\n`);
    process.stdout.write(`valid: ${args[0]} (score ${result.audit.computed.overall.score}, coverage ${result.audit.computed.coverage.percent}%)\n`);
    return 0;
  }
  if (command === 'render') {
    if (!args[0]) throw new Error('render requires AUDIT.json');
    const result = compileAudit(readJson(args[0]), { catalog: buildCatalog(skillRoot) });
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    writeOrPrint(renderAudit(result.audit), option(args, '--output', path.join(path.dirname(args[0]), 'AUDIT.mdx')));
    return 0;
  }
  if (command === 'sarif') {
    if (!args[0]) throw new Error('sarif requires AUDIT.json');
    const result = compileAudit(readJson(args[0]), { catalog: buildCatalog(skillRoot) });
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    writeOrPrint(auditToSarif(result.audit), option(args, '--output', path.join(path.dirname(args[0]), 'AUDIT.sarif')));
    return 0;
  }
  if (command === 'import-sarif') {
    if (!args[0]) throw new Error('import-sarif requires a SARIF file');
    const start = Number(option(args, '--start', '1'));
    if (!Number.isInteger(start) || start < 1) throw new Error('--start must be a positive integer');
    const imported = importSarif(readJson(args[0]), { source: args[0], start });
    writeOrPrint(imported, option(args, '--output'));
    return 0;
  }
  if (command === 'diff') {
    if (!args[0] || !args[1]) throw new Error('diff requires previous.json and current.json');
    const catalog = buildCatalog(skillRoot);
    const previous = compileAudit(readJson(args[0]), { catalog });
    const current = compileAudit(readJson(args[1]), { catalog });
    if (previous.errors.length || current.errors.length) throw new Error([...previous.errors, ...current.errors].join('\n'));
    const delta = diffAudits(previous.audit, current.audit);
    process.stdout.write(`${JSON.stringify(delta, null, 2)}\n`);
    return delta.valid ? 0 : 1;
  }
  if (command === 'evaluate') {
    if (!args[0] || !args[1]) throw new Error('evaluate requires AUDIT.json and expected.json');
    const result = compileAudit(readJson(args[0]), { catalog: buildCatalog(skillRoot) });
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    const metrics = evaluateAudit(result.audit, readJson(args[1]));
    process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
    return metrics.passed ? 0 : 1;
  }
  if (command === 'benchmark') return benchmark(args[0]);
  if (command === 'doctor') {
    const catalog = buildCatalog(skillRoot);
    const generated = readJson(path.join(skillRoot, 'catalog/checks.json'));
    const packageFile = path.join(packageRoot, 'package.json');
    const ownsPackageRoot = fs.existsSync(packageFile) && readJson(packageFile).name === 'godaudits'
      && path.resolve(packageRoot, 'skills/godaudits') === skillRoot;
    const testDirectory = path.join(packageRoot, 'test');
    const testFiles = ownsPackageRoot && fs.existsSync(testDirectory)
      ? fs.readdirSync(testDirectory).filter((name) => name.endsWith('.test.js')).sort().map((name) => path.join(testDirectory, name))
      : [];
    const testsAvailable = testFiles.length > 0;
    const test = testsAvailable
      ? spawnSync(process.execPath, ['--test', ...testFiles], { cwd: packageRoot, encoding: 'utf8' })
      : { status: 0, stdout: '', stderr: '' };
    const nodeSupported = Number(process.versions.node.split('.')[0]) >= 18;
    const result = {
      node: process.version,
      node_supported: nodeSupported,
      domains: catalog.domain_count,
      checks: catalog.check_count,
      catalog_fresh: JSON.stringify(generated) === JSON.stringify(catalog),
      tests_available: testsAvailable,
      tests_passed: testsAvailable ? test.status === 0 : null
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (test.status !== 0) process.stderr.write(test.stdout + test.stderr);
    return !nodeSupported || !result.catalog_fresh || (testsAvailable && test.status !== 0) ? 1 : 0;
  }
  throw new Error(`unknown command: ${command}\n${usage()}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
