# Evaluation methodology

Auditor quality is not established by a well-formed report. It is measured
against known defects and known clean controls.

## Metric evaluator

`godaudits evaluate AUDIT.json expected.json` reports:

- Recall: required findings detected.
- Precision: detected findings that were expected.
- Severity accuracy: expected findings with the expected severity.
- Citation validity: findings whose evidence type has the required provenance.
- Remediation closure: findings with required reciprocal tasks.
- Clean-control rate: clean checks that remain finding-free.
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
- Go CLI archetype detection.
- Clean Rust library controls.
- Web application form detection.
- Mobile or desktop form detection.
- Data or ML form detection.
- Infrastructure or IaC form detection.

Run it with `npm run benchmark`. This corpus tests the runtime, not model
judgment. It must stay fast, offline, deterministic, and safe for CI.

## Deterministic product evaluations

`npm run eval` runs focused suites for Pillars 1.1 routing, all six project
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
6. Repeat across models, harnesses, and at least three runs.
7. Report mean, worst run, score variance, token cost, and elapsed time.

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

## What the benchmark does not prove

A passing built-in corpus does not certify an unseen repository, a policy
conclusion, runtime behavior, or vulnerability absence. Every real audit reports
its own coverage, capabilities, assumptions, and evidence confidence.
