#!/usr/bin/env node
'use strict';

// Generates the authored half of the seeded-defect corpus. Each case is an
// independent audit that seeds exactly one defect against one catalog check, so
// a catalog change that renames or drops that check orphans a seed and turns the
// gate red.
//
// These are AUTHORED fixtures: a maintainer wrote both the defect and the audit
// that finds it, so they detect their own seeds by construction. They are worth
// exactly one thing, regression coverage, and calibrate.js refuses to let them
// contribute to a detection rate. Replacing any of them with a recorded real
// audit run is a strict upgrade.

const fs = require('node:fs');
const path = require('node:path');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'benchmarks/detectors');

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
  process.stdout.write(`Wrote ${cases.length} authored corpus case(s) covering ${[...new Set(SEEDS.map((seed) => seed.failCheck))].join(', ')}\n`);
}
