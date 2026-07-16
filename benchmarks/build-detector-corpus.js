#!/usr/bin/env node
'use strict';

// Generates the seeded-defect corpus, which has two halves.
//
// AUTHORED cases are built here from SEEDS: a maintainer wrote both the defect
// and the audit that finds it, so they detect their own seeds by construction.
// They are worth exactly one thing, regression coverage, and calibrate.js
// refuses to let them contribute to a detection rate.
//
// RECORDED cases are assembled from blind-runs.json: real audit runs where an
// agent saw only a repository and the A-SEC-3 definition, with no ground truth,
// no defect count, and no hint that one repository was a clean control. Their
// verdicts, findings, severities, and citations are the auditor's; only the
// AUDIT.json assembly is mechanical. Ground truth in seeded-ground-truth.json
// was authored before any of them ran. These are what a detection rate may be
// computed from. Regenerating never re-runs the audits, so the measurement
// stays what the tool actually produced at capture time.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { redactSecrets } = require('../skills/godaudits/runtime/lib/evidence');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'benchmarks/detectors');
const seededRoot = path.join(root, 'benchmarks/fixtures/seeded');

function sha256OfFile(repo, file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(seededRoot, repo, file))).digest('hex');
}

// Builds a recorded case from a blind audit run captured verbatim in
// blind-runs.json. The verdict, the finding, the severity, and the citation are
// the auditor's; only the AUDIT.json assembly around them is mechanical.
//
// The runs carry a single citation per finding because the capture schema asked
// for one. The tool's own rule is that a single evidence path cannot support a
// Certain label, so recorded findings are written as Firm regardless of the
// label the run reported. That is the corroboration invariant applied to the
// recording, not a judgement that the run over-claimed.
// A report never carries a credential-shaped value outside a redacted evidence
// record, so recorded prose passes through the same redactor a real audit uses.
// It fires conservatively: one run's remediation advice suggested resolving by
// `shareToken: req.query.token`, and the scanner masked the expression. Masking
// a code expression is the right direction to be wrong in, so the redactor is
// applied rather than loosened. blind-runs.json keeps the verbatim capture.
function scrub(value) {
  return typeof value === 'string' ? redactSecrets(value).text : value;
}

function recordedAuditFor(run, truth) {
  const failed = run.outcome === 'fail';
  const finding = run.findings[0] || null;
  // A pass records the file the auditor read; the capture schema collected
  // citations for findings only.
  const citedPath = finding ? finding.path : truth.pass_evidence.path;
  const citedLine = finding ? finding.line : truth.pass_evidence.line;
  const citedQuote = finding ? finding.quote : truth.pass_evidence.quote;
  const findingId = 'F-SEC-1';

  return {
    schema_version: '2.0',
    audit: {
      name: `blind-${run.repo}`,
      audit_version: 1,
      status: 'reported',
      created: '2026-07-16',
      updated: '2026-07-16',
      mode: 'fresh',
      plan_aware: false,
      commit: 'seeded0',
      archetype: 'api-service',
      scale: 'side-project',
      risk_profile: 'balanced',
      engine_version: '2.0.0',
      pack_version: '2.0.0',
      capabilities: ['static'],
      assumptions: ['Blind run: the auditor received only the repository path and the A-SEC-3 definition.']
    },
    compliance: { result: 'pass', screened: '2026-07-16', policy_pack: 'provider-neutral@1' },
    domains: [
      {
        id: 'security',
        status: 'applicable',
        weight: 15,
        checks: [
          {
            id: 'A-SEC-3',
            outcome: run.outcome,
            confidence: 'Firm',
            weight: 100,
            evidence: ['E-1'],
            finding_ids: failed ? [findingId] : []
          }
        ]
      }
    ],
    evidence: [
      {
        id: 'E-1',
        type: 'source',
        path: citedPath,
        line: citedLine,
        quote: scrub(citedQuote),
        sha256: sha256OfFile(run.repo, citedPath),
        redacted: scrub(citedQuote) !== citedQuote
      }
    ],
    strengths: [],
    findings: failed ? [{
      id: findingId,
      domain: 'security',
      title: scrub(finding.title),
      severity: finding.severity,
      confidence: 'Firm',
      effort: 'S',
      evidence: ['E-1'],
      impact: scrub(finding.impact),
      fix: scrub(finding.fix),
      verify: 'node --test test/security.test.js',
      checks: ['A-SEC-3'],
      status: 'open',
      remediation: ['GA-101']
    }] : [],
    tasks: failed ? [
      {
        id: 'GA-101',
        phase: 1,
        wave: '1.1',
        title: scrub(`Bind the query to the caller: ${finding.title}`.slice(0, 120)),
        parallel: false,
        files: [citedPath, 'test/security.test.js'],
        depends_on: [],
        reuses: 'the scoping already applied by the sibling handlers',
        fixes: [findingId],
        acceptance: [
          'The load binds the owner or tenant predicate inside the query.',
          'A cross-tenant id returns 404 rather than the record.'
        ],
        verify: 'node --test test/security.test.js',
        checks: ['A-SEC-3'],
        status: 'open'
      },
      {
        id: 'GA-601',
        phase: 6,
        wave: '6.1',
        title: 'Re-run godaudits',
        parallel: false,
        files: [],
        depends_on: ['GA-101'],
        reuses: 'the current audit state',
        fixes: [],
        acceptance: ['No open Critical findings remain.'],
        verify: 'godaudits validate .godaudits/AUDIT.json',
        checks: [],
        status: 'open',
        final_gate: true
      }
    ] : [
      {
        id: 'GA-601',
        phase: 6,
        wave: '6.1',
        title: 'Re-run godaudits',
        parallel: false,
        files: [],
        depends_on: [],
        reuses: 'the current audit state',
        fixes: [],
        acceptance: ['A-SEC-3 still passes on a re-read.'],
        verify: 'godaudits validate .godaudits/AUDIT.json',
        checks: [],
        status: 'open',
        final_gate: true
      }
    ],
    accepted_risks: [],
    open_questions: [],
    session_log: [{ date: '2026-07-16', summary: `Blind A-SEC-3 audit of ${run.repo}.` }]
  };
}

// Each seed: one domain, one failing check (the seeded defect), one clean check
// in the same domain, and the source path the defect lives at.
const SEEDS = [
  {
    name: 'tenant-predicate-omitted',
    domain: 'security',
    weight: 15,
    failCheck: 'A-SEC-3',
    passCheck: 'A-SEC-4',
    severity: 'Critical',
    path: 'src/boards.js',
    quote: 'db.boards.findOne({ id })',
    cleanQuote: 'router.use(authorize)',
    cleanPath: 'src/router.js',
    seeded: 'A board lookup queries by id with no tenant predicate, so an authenticated user can read another tenant board.',
    title: 'Board lookup omits the tenant predicate',
    impact: 'An authenticated user can read another tenant board by id.',
    fix: 'Add the tenant predicate inside the board query.'
  },
  {
    name: 'caller-supplied-selector-unbound',
    domain: 'security',
    weight: 15,
    failCheck: 'A-SEC-30',
    passCheck: 'A-SEC-4',
    severity: 'High',
    path: 'src/profile.js',
    quote: 'getUserByEmail(req.query.email)',
    cleanQuote: 'router.use(authorize)',
    cleanPath: 'src/router.js',
    seeded: 'A caller-supplied email selects the record without being bound to the authenticated principal.',
    title: 'Caller-supplied selector is not ownership-bound',
    impact: 'A caller can read another user profile by passing their email.',
    fix: 'Bind the lookup to the authenticated principal instead of the query parameter.'
  },
  {
    name: 'control-flag-never-read',
    domain: 'code-quality',
    weight: 10,
    failCheck: 'A-CODE-25',
    passCheck: 'A-CODE-1',
    severity: 'High',
    path: 'src/export.js',
    quote: 'const { exportsDisabled } = settings;',
    cleanQuote: 'module.exports = { runExport };',
    cleanPath: 'src/index.js',
    seeded: 'An exports-disabled flag is stored and read into scope but never consulted on the enforcement path.',
    title: 'Control flag is stored but never enforced',
    impact: 'Disabling exports in settings has no effect; the export still runs.',
    fix: 'Consult the flag on the enforcement path before running the export.'
  },
  {
    name: 'scheduling-uses-utc',
    domain: 'code-quality',
    weight: 10,
    failCheck: 'A-CODE-26',
    passCheck: 'A-CODE-1',
    severity: 'Medium',
    path: 'src/schedule.js',
    quote: 'new Date().toISOString().slice(0, 10)',
    cleanQuote: 'module.exports = { runExport };',
    cleanPath: 'src/index.js',
    seeded: 'Availability is computed in UTC rather than the entity timezone, so the day boundary is wrong for other zones.',
    title: 'Scheduling computes the day in UTC, not the entity timezone',
    impact: 'Availability windows are off by a day for entities outside UTC.',
    fix: 'Compute the day boundary in the entity timezone.'
  },
  {
    name: 'money-flow-not-reconciled',
    domain: 'database',
    weight: 8,
    failCheck: 'A-DB-24',
    passCheck: 'A-DB-1',
    severity: 'Critical',
    path: 'src/billing.js',
    quote: 'await markInvoicePaid(invoiceId)',
    cleanQuote: 'await migrate({ to: latest })',
    cleanPath: 'src/migrate.js',
    seeded: 'An invoice is marked paid before the provider confirms the charge status, so a failed charge still settles.',
    title: 'Invoice settles before provider confirmation',
    impact: 'A failed or disputed charge can still mark an invoice paid.',
    fix: 'Confirm provider status before marking the invoice final.'
  }
];

function auditFor(seed) {
  // Finding ids follow F-<PREFIX>-N, mirroring the check family they belong to.
  const findingId = `F-${seed.failCheck.split('-')[1]}-1`;
  return {
    schema_version: '2.0',
    audit: {
      name: `seeded-${seed.name}`,
      audit_version: 1,
      status: 'reported',
      created: '2026-07-13',
      updated: '2026-07-13',
      mode: 'fresh',
      plan_aware: false,
      commit: 'abc1234',
      archetype: 'api-service',
      scale: 'side-project',
      risk_profile: 'balanced',
      engine_version: '2.0.0',
      pack_version: '2.0.0',
      capabilities: ['static'],
      assumptions: []
    },
    compliance: { result: 'pass', screened: '2026-07-13', policy_pack: 'provider-neutral@1' },
    domains: [
      {
        id: seed.domain,
        status: 'applicable',
        weight: seed.weight,
        checks: [
          { id: seed.failCheck, outcome: 'fail', confidence: 'Certain', weight: 60, evidence: ['E-1', 'E-2'], finding_ids: [findingId] },
          { id: seed.passCheck, outcome: 'pass', confidence: 'Firm', weight: 40, evidence: ['E-2'], finding_ids: [] }
        ]
      }
    ],
    evidence: [
      { id: 'E-1', type: 'source', path: seed.path, line: 8, quote: seed.quote, sha256: 'a'.repeat(64), redacted: false },
      { id: 'E-2', type: 'source', path: seed.cleanPath, line: 4, quote: seed.cleanQuote, sha256: 'b'.repeat(64), redacted: false }
    ],
    strengths: [],
    findings: [
      {
        id: findingId,
        domain: seed.domain,
        title: seed.title,
        severity: seed.severity,
        confidence: 'Certain',
        effort: 'S',
        evidence: ['E-1', 'E-2'],
        impact: seed.impact,
        fix: seed.fix,
        verify: 'node --test test/seeded.test.js',
        checks: [seed.failCheck],
        status: 'open',
        remediation: ['GA-101']
      }
    ],
    tasks: [
      {
        id: 'GA-101',
        phase: 1,
        wave: '1.1',
        title: `Fix: ${seed.title}`,
        parallel: false,
        files: [seed.path, 'test/seeded.test.js'],
        depends_on: [],
        reuses: 'the existing module under audit',
        fixes: [findingId],
        acceptance: [
          'The seeded defect no longer reproduces.',
          `${seed.failCheck} passes with evidence on the remediated path.`
        ],
        verify: 'node --test test/seeded.test.js',
        checks: [seed.failCheck],
        status: 'open'
      },
      {
        id: 'GA-601',
        phase: 6,
        wave: '6.1',
        title: 'Re-run godaudits',
        parallel: false,
        files: [],
        depends_on: ['GA-101'],
        reuses: 'the current audit state',
        fixes: [],
        acceptance: ['No open Critical findings remain.'],
        verify: 'godaudits validate .godaudits/AUDIT.json',
        checks: [],
        status: 'open',
        final_gate: true
      }
    ],
    accepted_risks: [],
    open_questions: [],
    session_log: [{ date: '2026-07-13', summary: 'Seeded corpus fixture.' }]
  };
}

const check = process.argv.includes('--check');
const stale = [];

function emit(file, contents) {
  const target = path.join(root, 'benchmarks', file);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) stale.push(file);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

fs.mkdirSync(outputDir, { recursive: true });
const cases = [];
for (const seed of SEEDS) {
  const { audit, errors } = compileAudit(auditFor(seed));
  if (errors.length) {
    process.stderr.write(`${seed.name} is not a valid audit: ${errors.join('; ')}\n`);
    process.exitCode = 1;
    continue;
  }
  const file = `detectors/${seed.name}.audit.json`;
  emit(file, `${JSON.stringify(audit, null, 2)}\n`);
  cases.push({
    name: seed.name,
    provenance: 'authored',
    audit: file,
    seeded: seed.seeded,
    expected: {
      required_findings: [{ check: seed.failCheck, severity: seed.severity, path: seed.path }],
      clean_checks: [seed.passCheck]
    }
  });
}

// Recorded cases: real blind audit runs, captured verbatim, scored against
// ground truth that was authored before any of them ran.
const blind = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/blind-runs.json'), 'utf8'));
const truthById = new Map(
  JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/seeded-ground-truth.json'), 'utf8')).repos.map((item) => [item.repo, item])
);

for (const run of blind.runs) {
  const truth = truthById.get(run.repo);
  if (!truth) {
    process.stderr.write(`blind run ${run.repo} has no ground-truth entry\n`);
    process.exitCode = 1;
    continue;
  }
  const { audit, errors } = compileAudit(recordedAuditFor(run, truth));
  if (errors.length) {
    process.stderr.write(`recorded ${run.repo} is not a valid audit: ${errors.join('; ')}\n`);
    process.exitCode = 1;
    continue;
  }
  const file = `detectors/blind-${run.repo}.audit.json`;
  emit(file, `${JSON.stringify(audit, null, 2)}\n`);
  cases.push({
    name: `blind-${run.repo}`,
    provenance: 'recorded',
    audit: file,
    seeded: truth.defect,
    expected: {
      required_findings: truth.seeded ? [{ check: 'A-SEC-3', severity: truth.severity, path: truth.path }] : [],
      clean_checks: truth.seeded ? [] : ['A-SEC-3']
    }
  });
}

if (process.exitCode === 1) process.exit(1);

const corpus = {
  schema_version: '1.0',
  scope: 'Seeded-defect corpus for the internal detector-regression gate. Each case pairs an AUDIT.json with the defect deliberately seeded in the audited source, mapped to the A-check that owns it. The gate asks one question: after a catalog change, do the seeded defects still get detected? Cases marked authored are maintainer-built fixtures that detect their own seeds by construction, so they earn regression coverage and nothing else; only a recorded real audit run may contribute to a detection rate. These cases are not a sample of real-world repositories, so nothing here estimates reliability on unseen code and no number derived from them feeds a per-repo score.',
  cases
};
emit('detectors.json', `${JSON.stringify(corpus, null, 2)}\n`);

if (check) {
  if (stale.length) {
    process.stderr.write(`Generated detector corpus is stale: ${stale.join(', ')}. Run npm run corpus.\n`);
    process.exitCode = 1;
  } else process.stdout.write('Detector corpus is fresh.\n');
} else {
  const authored = cases.filter((item) => item.provenance === 'authored').length;
  const recorded = cases.filter((item) => item.provenance === 'recorded').length;
  const covered = [...new Set(cases.flatMap((item) => item.expected.required_findings.map((entry) => entry.check)))].sort();
  process.stdout.write(`Wrote ${cases.length} corpus case(s): ${authored} authored, ${recorded} recorded; covering ${covered.join(', ')}\n`);
}
