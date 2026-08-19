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
const { importTool, ADAPTERS } = require('./lib/tool-import');
const { analyzePillars } = require('./lib/pillars');
const { validateProjectContextCatalog } = require('./lib/project-context');
const { planProbes, applyResults } = require('./lib/verify-runtime');
const { planRefutations, applyRefutations } = require('./lib/refute');
const { planWayfinding, renderWayfinding } = require('./lib/wayfind');
const {
  applyBlastRadiusResults,
  exportChangeReviewEvidence,
  planBlastRadius,
  renderBlastRadius,
  validateChangeReview
} = require('./lib/blast-radius');

const skillRoot = path.resolve(__dirname, '..');
const packageRoot = path.resolve(skillRoot, '..', '..');

function usage() {
  return `godaudits evidence [repo] [--output file]
godaudits pillars [repo] --task "work description" [--target path] [--output file]
godaudits catalog [--output file]
godaudits init --name slug [--archetype type] --scale scale --profile balanced --applicable domain,domain [--budget medium|full] [--evidence file] [--output file]
godaudits validate <AUDIT.json> [--repo directory] [--require-fresh-evidence] [--write]
godaudits render <AUDIT.json> [--output AUDIT.mdx]
godaudits sarif <AUDIT.json> [--output AUDIT.sarif]
godaudits import-sarif <tool.sarif> [--start 1] [--output TOOL-EVIDENCE.json]
godaudits import-tool <report.json> --tool sarif|semgrep|ast-grep|gitleaks|osv-scanner --command "scanner command" [--tool-version version] [--start 1] [--output TOOL-EVIDENCE.json]
godaudits diff <previous.json> <current.json>
godaudits evaluate <AUDIT.json> <expected.json>
godaudits verify-runtime plan <AUDIT.json> [--output PROBES.json]
godaudits verify-runtime apply <AUDIT.json> <RESULTS.json> [--output VERIFICATION.json]
godaudits refute plan <AUDIT.json> [--output REFUTATION-BRIEFS.json]
godaudits refute apply <AUDIT.json> <RESULTS.json> [--output REFUTATION.json]
godaudits blast-radius plan [repo] --base REV --head REV --fact "SAFETY FACT" [--fact "SECOND FACT"] --verify "COMMAND" [--audit AUDIT.json] [--output CHANGE-REVIEW.json]
godaudits blast-radius validate <CHANGE-REVIEW.json>
godaudits blast-radius apply <CHANGE-REVIEW.json> <RESULTS.json> [--output file]
godaudits blast-radius render <CHANGE-REVIEW.json> [--output CHANGE-REVIEW.mdx]
godaudits blast-radius evidence <CHANGE-REVIEW.json> [--start 1] [--output CHANGE-EVIDENCE.json]
godaudits wayfind <AUDIT.json> [--format text|json] [--output file]
godaudits benchmark [directory]
godaudits doctor`;
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function options(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1] && !args[index + 1].startsWith('--')) values.push(args[index + 1]);
  }
  return values;
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
    if (fixture.expected_project_form !== undefined && typeof fixture.expected_project_form !== 'string') throw new Error(`${fixture.name}.expected_project_form must be a string`);
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
    if (fixture.expected_project_form && fingerprint.project_context.project_forms.primary.id !== fixture.expected_project_form) {
      failures.push(`project form ${fingerprint.project_context.project_forms.primary.id}`);
    }
    for (const overlay of fixture.expected_overlays || []) {
      const detected = new Set([
        ...fingerprint.project_context.product_archetype.candidates.map((item) => item.slug),
        ...fingerprint.project_context.industry_overlays.map((item) => item.slug),
        ...fingerprint.project_context.regulatory_overlays.map((item) => item.id)
      ]);
      if (!detected.has(overlay)) failures.push(`missing overlay ${overlay}`);
    }
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
  if (command === 'pillars') {
    const repo = args[0] && !args[0].startsWith('--') ? args[0] : process.cwd();
    writeOrPrint(analyzePillars(repo, {
      task: option(args, '--task', ''),
      target: option(args, '--target', '.')
    }), option(args, '--output'));
    return 0;
  }
  if (command === 'catalog') {
    writeOrPrint(buildCatalog(skillRoot), option(args, '--output'));
    return 0;
  }
  if (command === 'init') {
    const name = option(args, '--name');
    const evidenceFile = option(args, '--evidence');
    const evidence = evidenceFile ? readJson(evidenceFile) : null;
    const archetype = option(args, '--archetype', evidence && evidence.project_context
      ? (evidence.project_context.product_archetype.primary || {}).slug || evidence.project_context.project_forms.primary.id
      : null);
    const scale = option(args, '--scale');
    const applicableValue = option(args, '--applicable');
    if (!name || !archetype || !scale || !applicableValue) throw new Error('init requires --name, --scale, --applicable, and either --archetype or --evidence');
    const applicable = applicableValue === 'all' ? 'all' : applicableValue.split(',').filter(Boolean);
    const audit = initAudit(buildCatalog(skillRoot), {
      name,
      archetype,
      scale,
      riskProfile: option(args, '--profile', 'balanced'),
      applicable,
      budget: option(args, '--budget', 'medium'),
      root: option(args, '--repo', process.cwd()),
      planAware: args.includes('--plan-aware'),
      policyPack: option(args, '--policy-pack', 'provider-neutral@1'),
      evidence
    });
    writeOrPrint(audit, option(args, '--output', '.godaudits/AUDIT.json'));
    return 0;
  }
  if (command === 'validate') {
    if (!args[0]) throw new Error('validate requires AUDIT.json');
    const requireFreshEvidence = args.includes('--require-fresh-evidence');
    const currentEvidence = requireFreshEvidence ? fingerprintRepository(option(args, '--repo', process.cwd())) : null;
    const result = compileAudit(readJson(args[0]), {
      catalog: buildCatalog(skillRoot),
      allowDerivedRewrite: args.includes('--write'),
      requireFreshEvidence,
      currentEvidence
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
    const catalog = buildCatalog(skillRoot);
    const result = compileAudit(readJson(args[0]), { catalog });
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    writeOrPrint(renderAudit(result.audit, { catalog }), option(args, '--output', path.join(path.dirname(args[0]), 'AUDIT.mdx')));
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
  if (command === 'import-tool') {
    if (!args[0] || args[0].startsWith('--')) throw new Error('import-tool requires a report file');
    const tool = option(args, '--tool');
    if (!tool) throw new Error(`import-tool requires --tool (${Object.keys(ADAPTERS).join('|')})`);
    const start = Number(option(args, '--start', '1'));
    if (!Number.isInteger(start) || start < 1) throw new Error('--start must be a positive integer');
    const imported = importTool(tool, readJson(args[0]), {
      source: args[0],
      start,
      toolVersion: option(args, '--tool-version'),
      command: option(args, '--command')
    });
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
  if (command === 'verify-runtime') {
    const mode = args[0];
    if (mode === 'plan') {
      if (!args[1]) throw new Error('verify-runtime plan requires AUDIT.json');
      const probes = planProbes(readJson(args[1]));
      writeOrPrint(`${JSON.stringify(probes, null, 2)}\n`, option(args, '--output', path.join(path.dirname(args[1]), 'runtime', 'PROBES.json')));
      return probes.probes.length ? 0 : 0;
    }
    if (mode === 'apply') {
      if (!args[1] || !args[2]) throw new Error('verify-runtime apply requires AUDIT.json and RESULTS.json');
      const report = applyResults(readJson(args[1]), readJson(args[2]));
      writeOrPrint(`${JSON.stringify(report, null, 2)}\n`, option(args, '--output', path.join(path.dirname(args[1]), 'runtime', 'VERIFICATION.json')));
      return 0;
    }
    throw new Error('verify-runtime requires a mode: plan <AUDIT.json> | apply <AUDIT.json> <RESULTS.json>');
  }
  if (command === 'refute') {
    const mode = args[0];
    if (mode === 'plan') {
      if (!args[1]) throw new Error('refute plan requires AUDIT.json');
      const briefs = planRefutations(readJson(args[1]));
      writeOrPrint(`${JSON.stringify(briefs, null, 2)}\n`, option(args, '--output', path.join(path.dirname(args[1]), 'REFUTATION-BRIEFS.json')));
      return 0;
    }
    if (mode === 'apply') {
      if (!args[1] || !args[2]) throw new Error('refute apply requires AUDIT.json and RESULTS.json');
      const report = applyRefutations(readJson(args[1]), readJson(args[2]));
      writeOrPrint(`${JSON.stringify(report, null, 2)}\n`, option(args, '--output', path.join(path.dirname(args[1]), 'REFUTATION.json')));
      return 0;
    }
    throw new Error('refute requires a mode: plan <AUDIT.json> | apply <AUDIT.json> <RESULTS.json>');
  }
  if (command === 'blast-radius') {
    const mode = args[0];
    if (mode === 'plan') {
      const repo = args[1] && !args[1].startsWith('--') ? args[1] : process.cwd();
      const base = option(args, '--base');
      const head = option(args, '--head');
      const facts = options(args, '--fact');
      const verify = option(args, '--verify');
      const auditFile = option(args, '--audit');
      if (!base || !head) throw new Error('blast-radius plan requires --base and --head');
      const review = planBlastRadius(repo, {
        base,
        head,
        facts,
        verify,
        audit: auditFile ? readJson(auditFile) : null
      });
      writeOrPrint(review, option(args, '--output', path.join(repo, '.godaudits', 'CHANGE-REVIEW.json')));
      return 0;
    }
    if (mode === 'validate') {
      if (!args[1] || args[1].startsWith('--')) throw new Error('blast-radius validate requires CHANGE-REVIEW.json');
      const errors = validateChangeReview(readJson(args[1]));
      if (errors.length) {
        process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
        return 1;
      }
      process.stdout.write(`valid change review: ${args[1]}\n`);
      return 0;
    }
    if (mode === 'apply') {
      if (!args[1] || !args[2] || args[1].startsWith('--') || args[2].startsWith('--')) {
        throw new Error('blast-radius apply requires CHANGE-REVIEW.json and RESULTS.json');
      }
      const applied = applyBlastRadiusResults(readJson(args[1]), readJson(args[2]));
      if (applied.errors.length) {
        process.stderr.write(`${applied.errors.map((error) => `- ${error}`).join('\n')}\n`);
        return 1;
      }
      writeOrPrint(applied.review, option(args, '--output'));
      return applied.review.merge_gate.status === 'blocked' ? 1 : 0;
    }
    if (mode === 'render') {
      if (!args[1] || args[1].startsWith('--')) throw new Error('blast-radius render requires CHANGE-REVIEW.json');
      writeOrPrint(renderBlastRadius(readJson(args[1])), option(args, '--output', path.join(path.dirname(args[1]), 'CHANGE-REVIEW.mdx')));
      return 0;
    }
    if (mode === 'evidence') {
      if (!args[1] || args[1].startsWith('--')) throw new Error('blast-radius evidence requires CHANGE-REVIEW.json');
      const start = Number(option(args, '--start', '1'));
      if (!Number.isInteger(start) || start < 1) throw new Error('--start must be a positive integer');
      writeOrPrint(exportChangeReviewEvidence(readJson(args[1]), { start, source: args[1] }), option(args, '--output'));
      return 0;
    }
    throw new Error('blast-radius requires a mode: plan | validate | apply | render | evidence');
  }
  if (command === 'wayfind') {
    // Guard the positional the way import-tool does. option() returns the raw
    // next token, so an audit path written after a flag would otherwise be
    // read as that flag's value and the flag itself read as the audit path.
    if (!args[0] || args[0].startsWith('--')) throw new Error('wayfind requires AUDIT.json as the first argument');
    const map = planWayfinding(readJson(args[0]));
    const format = option(args, '--format', 'text');
    if (!['text', 'json'].includes(format)) throw new Error('wayfind --format must be text or json');
    // Text by default: this is an orientation read, taken at the start of a
    // remediation session before any task is chosen. JSON is for a caller that
    // wants the frontier as data rather than as a briefing.
    const body = format === 'json' ? `${JSON.stringify(map, null, 2)}\n` : renderWayfinding(map);
    writeOrPrint(body, option(args, '--output'));
    return 0;
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
    const nodeSupported = Number(process.versions.node.split('.')[0]) >= 22;
    const projectContextErrors = validateProjectContextCatalog(readJson(path.join(skillRoot, 'catalog/project-context.json')));
    const standardsCategories = Object.values(catalog.standards.frameworks).reduce((sum, framework) => sum + framework.categories.length, 0);
    const schemasValid = fs.readdirSync(path.join(skillRoot, 'schemas')).filter((name) => name.endsWith('.json')).every((name) => {
      try {
        readJson(path.join(skillRoot, 'schemas', name));
        return true;
      } catch {
        return false;
      }
    });
    const result = {
      node: process.version,
      node_supported: nodeSupported,
      domains: catalog.domain_count,
      checks: catalog.check_count,
      project_forms: catalog.project_context.form_count,
      arc_profiles: catalog.project_context.profile_count,
      project_context_valid: projectContextErrors.length === 0,
      standards_categories: standardsCategories,
      schemas_valid: schemasValid,
      catalog_fresh: JSON.stringify(generated) === JSON.stringify(catalog),
      tests_available: testsAvailable,
      tests_passed: testsAvailable ? test.status === 0 : null
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (test.status !== 0) process.stderr.write(test.stdout + test.stderr);
    return !nodeSupported || !result.project_context_valid || standardsCategories < 10 || !schemasValid
      || !result.catalog_fresh || (testsAvailable && test.status !== 0) ? 1 : 0;
  }
  throw new Error(`unknown command: ${command}\n${usage()}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
