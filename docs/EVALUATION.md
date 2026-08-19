# Evaluation methodology

A well-formed report proves nothing. Any capable model can produce a document
that looks like a rigorous audit. Quality is only established by pointing the
auditor at code whose defects are already known, and at code that is known to
be clean, and counting what comes back.

This document describes how that is done here. Four separate harnesses answer
four different questions, and it matters which one a given number came from:

| Harness | Question it answers | Command |
|---|---|---|
| Deterministic corpus | Does the runtime read repositories correctly? | `npm run benchmark` |
| Authored seeded corpus | After a catalog change, are the planted defects still detected? | `npm run test:detectors` |
| Product evaluations | Do routing, forms, standards, and freshness contracts still hold? | `npm run eval:suites` |
| Accuracy program | Does a real model, on real code, actually find real defects? | `npm run accuracy:check` |

Only the last of those measures audit quality. The first three measure the
machinery around it. Conflating them is the most common way a tool in this
category overstates itself, so the rules below keep them apart by construction:
authored cases cannot contribute to a detection rate, and a run without
attribution cannot contribute at all.

The published results are in [`../ACCURACY.md`](../ACCURACY.md).

## Metric evaluator

`godaudits evaluate AUDIT.json expected.json` reports:

- Recall: required findings detected.
- Precision: detected findings that were expected.
- Severity accuracy: expected findings with the expected severity.
- Citation validity: findings whose evidence type has the required provenance.
- Remediation closure: findings with required reciprocal tasks.
- Clean-control rate: clean checks that remain finding-free.
- Recall by severity: recall within each expected severity, so a dangerous miss
  cannot hide behind many Low findings. Critical and High are always reported,
  as null when the benchmark seeds none, never as a perfect ratio.
- Misses and false positives.

A required finding matches only when both its check id and expected source path
match active evidence. Resolved or superseded history does not count as a
current false positive or clean-control violation. Duplicate check-path
expectations are rejected, and clean-control violations are counted by unique
check id.

The default passing thresholds are 95 percent recall, 95 percent precision, 90
percent severity accuracy, 100 percent citation validity, 100 percent
remediation closure, and 95 percent clean-control rate.

## Deterministic corpus

`benchmarks/corpus.json` currently covers:

- Node API route plus quoted and extensionless environment secret redaction.
- Python worker outbound-call and deferred-work signals.
- Reader-facing copy candidates across eight categories, with clean controls
  for precise technical terms, fenced examples, release history, and source
  files that do not render copy.
- Go CLI archetype detection.
- Clean Rust library controls.
- Web application form detection.
- Mobile or desktop form detection.
- Data or ML form detection.
- Infrastructure or IaC form detection.

Run it with `npm run benchmark`. This corpus tests the runtime, not model
judgment. It must stay fast, offline, deterministic, and safe for CI.

## Authored seeded corpus

The other half of `benchmarks/detectors.json` is the authored cases, built from
`SEEDS` in `benchmarks/build-detector-corpus.js`. Each pairs a small repository
under `benchmarks/fixtures/seeded/` carrying one deliberate defect with the
`AUDIT.json` that finds it. They exist for exactly one purpose: after a catalog
change, do the seeded defects still get detected? A maintainer wrote both the
defect and the audit, so they detect their own seeds by construction, and
`calibrate.js` refuses to let them contribute to a detection rate.

The authored cases currently cover A-SEC-3, A-SEC-30, A-CODE-25, A-CODE-26,
A-DB-24, and A-ARCH-24 through A-ARCH-29.

Three conventions make a seed worth having:

- One clause per fixture. A fixture satisfies exactly one Fail clause of its
  target check and closes the others, so a detection is attributable to the
  signal the seed is named for rather than a neighbouring one.
- No collateral. A fixture is a clean control for every check except its target.
  A stray second defect in another domain reads as a false alarm, so a seed
  closes the neighbouring checks its shape would otherwise trip: no runtime
  dependency without a lockfile, bounded collections, explicit timeouts and
  dedup, structured logging with stated retention, and an architecture record
  that names only what the fixture ships.
- Routing seeds name their owner. A routing check carries no weight of its own,
  so a seed whose failing check is one sets `ownerCheck` to the weighted check
  in the same domain whose dimension the defect scores into. The generated
  ledger then carries both, which is what a real audit must do to satisfy the
  routing-ownership rule in `lib/audit.js`. The owner is chosen from the control
  the defect implicates, the way each module's Scoring section routes them, not
  from a fixed per-check table.

The gate validates every case catalog-aware and fragment-scoped
(`validateAudit(audit, { catalog, fragment: true })`). Fragment scope drops the
whole-audit rules a single-domain fixture cannot satisfy by construction (pinned
versions, an applicability row per domain, a complete per-domain ledger, and the
domain and per-check weights, which are a normalization across an audit the
fragment does not contain) and keeps the conformance rules that expose a real
defect in one: a check id the catalog no longer defines, a routing check whose
finding names no weighted owner, and a finding with no weighted owner in its own
domain. Before that, the gate withheld the catalog entirely, which withheld
those rules too, and four fixtures drifted into exactly the shape the gate
exists to catch.

## Recorded detection rate and its limits

The detector gate (`npm run test:detectors`) may compute a detection rate, but
only from the `recorded` blind runs in `benchmarks/blind-runs.json`, and that
number is narrower than it reads. Three limits are recorded in the file's
`attribution` block and hold whatever the rate says:

- No control condition. Each blind auditor received one repository path and the
  A-SEC-3 definition alone, not the installed skill. It is a check-definition
  arm, not a skill arm, and nothing here compares an audit carrying the skill
  against the same model without it.
- Saturated fixtures. The seeded repositories are three to five files each, so a
  high rate cannot separate detector quality from fixture difficulty.
- Partial attribution. The original capture did not record the model or harness.
  The block carries them as explicit null, and pins the fixture commit and
  capture-era versions, so the gap is legible rather than hidden.

The rate is an internal regression signal, never a reliability estimate for
unseen repositories, and no number it produces reaches a per-repo score.

## Standing accuracy program

[`../ACCURACY.md`](../ACCURACY.md) is the versioned public result. It reports
hits, misses, false positives, severity matches, clean controls, and the gaps
that make a number ineligible for a broader claim.

`benchmarks/accuracy-program.json` records ground truth before runs for one
highest-weight check in each domain. A deterministic tie-break selects the
lowest numeric check id when weights tie. Every target records its intended
defect, clean control, severity, and ground-truth revision outside the future
fixture repository.

`benchmarks/paired-runs.json` is reserved for the missing causal arm: the same
model, snapshot, harness, harness configuration, repository, fixture commit,
check, capabilities, and repetition with and without the installed skill. New
runs require non-null model and harness attribution. `npm run accuracy:check`
rejects incomplete pairs, duplicate arms, target drift, attribution gaps, and
any pinned field that differs across the pair.

The first complete A-SEC-6 suite contains five seeded repositories, one clean
control, and three repetitions per arm. Both arms reached 15 of 15 pre-authored
hits with no false positives, so the measured skill lift is zero on that suite.
The installed-skill arm used materially more tokens and elapsed time. Post-run
true findings remain visible as unscored observations, and duplicate citations
are counted separately. Neither can change the causal metrics.

`benchmarks/run-attempts.json` retains technical failures separately from model
observations. A response rejected before inference cannot become a miss, hit, or
false positive. `npm run accuracy:regrade` applies the current append-only
ground-truth correction revision to retained structured outputs.

## Deterministic product evaluations

`npm run eval:suites` runs focused suites for Pillars 1.1 routing, all six project
forms and 37 arc-ready profiles, overlay conservatism, arc-ready table-ledger
drift, evidence freshness, all ten OWASP 2025 categories, and secret-safe
fingerprinting. These suites guard product contracts separately from the full
unit test command so release evidence shows which integration surface failed.

## Behavioral harness cases

The cases under `evals/cases/` test model behavior that deterministic code
cannot establish: form composition, regulatory restraint, Pillars routing,
artifact-truth judgment, stale-evidence response, standards completeness,
adversarial refutation, and remediation traceability.

Every run records the model, harness, skill commit, fixture commit, capabilities,
artifact locations, invariant scores, and automatic-fail review using
`evals/RESULTS-TEMPLATE.md`. No checked-in result means no claimed live-harness
score. A pass requires every critical invariant and at least 90 percent of
weighted points.

## Model audit benchmarks

For a full model benchmark:

1. Create a small repository with planted defects and explicit clean controls.
2. Record expected check id, severity, and primary path without embedding the
   answer in instructions visible to the auditor.
3. Run the audit in a fresh context at a pinned commit and pack version.
4. Validate and compile AUDIT.json.
5. Evaluate against the hidden expected manifest.
6. Pair the same model, repository, and harness without and with the installed
   skill.
7. Repeat each arm at least three times.
8. Report mean, worst run, score variance, misses, false positives, token cost,
   and elapsed time.

Critical and High recall should be reported separately because aggregate recall
can hide a dangerous miss behind many Low findings.

## Corpus contribution rules

- Every planted defect has one intended root cause and at least one refutation
  trap.
- Clean controls sit near superficially suspicious code to measure precision.
- Credentials are obviously non-live fixtures and evidence must still redact
  them.
- Expected manifests use check ids and paths, not prose matching.
- Licensing permits fixture redistribution.
- Fixture commits are immutable after publication; corrections create a new
  fixture version.
- Every run records model provider, model id, model snapshot, harness name,
  harness version, harness configuration hash, fixture commit, and skill commit.
- Public OSS retrospectives require a documented CVE or postmortem tied to a
  repository revision and specific code-level ground truth.
- A finding that identifies a broad missing control but not the documented
  exploit path remains a miss. Disclosure cannot be used to upgrade a near hit.
- Post-run defects discovered in a seeded fixture are retained but excluded
  from causal metrics.

## What the benchmark does not prove

A passing built-in corpus does not certify an unseen repository, a policy
conclusion, runtime behavior, or vulnerability absence. Every real audit reports
its own coverage, capabilities, assumptions, and evidence confidence.
