# Accuracy evidence

Accuracy evidence version: 1.1.0

Published: 2026-07-23

This file reports only retained model-run evidence. Deterministic runtime tests,
authored detector fixtures, catalog size, and a polished audit report are not
model-accuracy evidence.

## Paired installed-skill experiment

The first complete paired suite covers A-SEC-6. Five seeded repositories and
one clean control were each audited three times per arm. Every pair held the
repository, fixture commit, model, model catalog observation, harness, harness
configuration, target check, capability, and repetition constant.

The control arm disabled every discoverable filesystem skill. The treatment
arm enabled only the pinned godaudits skill. Both arms used OpenAI
`gpt-5.6-terra`, Codex CLI 0.145.0, medium reasoning, static read-only access,
and no plugins, repository instructions, network, application execution, tests,
or package installation.

| Measure | Control | Installed skill |
|---|---:|---:|
| Eligible runs | 18 | 18 |
| Pre-authored seeded hits | 15 | 15 |
| Pre-authored seeded misses | 0 | 0 |
| False positives after adjudication | 0 | 0 |
| Recall | 1.0000 | 1.0000 |
| Precision | 1.0000 | 1.0000 |
| Severity matches | 14 of 15 | 14 of 15 |
| Clean controls without a finding | 3 of 3 | 3 of 3 |
| Post-run true findings, excluded from lift | 15 | 11 |
| Duplicate citations | 1 | 0 |
| Input tokens | 972,898 | 1,887,593 |
| Output tokens | 14,030 | 27,570 |
| Elapsed milliseconds | 350,405 | 638,434 |

This suite measured no skill lift. Both arms saturated the five intentionally
small seeded cases and stayed clean on the control. The installed-skill arm used
1.94 times the input tokens, 1.96 times the output tokens, and 1.82 times the
elapsed time. The result therefore does not prove that installing the skill
improves model judgment. It proves that the causal arm can be run, attributed,
retained, corrected, and reported without hiding a null result.

The 15 hits are repeated observations across five seeded repositories, not 15
independent repository designs. No reliability estimate for unseen projects is
supported.

## Correction and failure record

Ground truth is in `benchmarks/accuracy-ground-truth.json`, outside the fixture
repositories. Its correction log is append-only:

1. The first diagnostic control observation found an unintended missing
   single-use-token transition in case-01 and cited a valid alternate mount
   line. Case-01 was excluded from causal lift, and replacement case-07 was
   authored before its first audit.
2. The completed matrix exposed real additional defects in cases 02-05.
   Revision 3 records them as post-run true findings with
   `eligible_for_metrics: false`. They remain visible but cannot become
   hindsight-supported hits. A repeated citation to one defect is recorded as
   a duplicate rather than a false positive.

The attempt ledger retains 37 technical failures from harness development. All
occurred before inference because the first response schema was rejected by the
service or by a deliberate schema-validation probe. They produced no audit
observation and are excluded from accuracy metrics. The subsequent eligible
matrix completed 36 of 36 model runs without a technical failure.

Run `npm run accuracy:check` to validate chronology, attribution, paired fields,
current grading revision, retained artifacts, correction eligibility, attempt
status, and the compiled summary. `npm run accuracy:regrade` deterministically
replays the current adjudication over the retained structured outputs.

## Public OSS retrospective

The first external dogfood audit covers
[`auth0/node-jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) at
`f9f3c34f8478b1b81070bf0a6da3fd48f2ee70be`, the parent of the documented
verification-bypass fix.

GitHub's reviewed
[`GHSA-c7hr-j4mj-j2w6`](https://github.com/advisories/GHSA-c7hr-j4mj-j2w6)
describes CVE-2015-9235, and fix commit
[`1bb584bc382295eeb7ee8c4452a673a77a68b687`](https://github.com/auth0/node-jsonwebtoken/commit/1bb584bc382295eeb7ee8c4452a673a77a68b687)
adds algorithm-family restrictions and the regression case.

The medium-budget security audit found the broader absence of an algorithm
allowlist, but described only unsigned `alg:none` acceptance when no key is
supplied. It did not identify the advisory's asymmetric-public-key to
HMAC-secret confusion path. The retrospective therefore records zero hits, one
miss, and zero adjudicated false positives. A near hit was not promoted after
disclosure.

The audit also recorded two source-supported findings outside the single-CVE
ground truth. Twenty selected checks remained unknown. The complete evidence,
audit, report, run attribution, redacted transcript, hash manifest, and
adjudication are under `dogfood/node-jsonwebtoken-cve-2015-9235/`.

## Highest-weight domain program

`benchmarks/accuracy-program.json` records one highest-weight target in every
catalog domain. Ties use the lowest numeric check id. Each target specifies a
defect and nearby clean control before future fixtures or runs are created.

| Program state | Count |
|---|---:|
| Domain targets with authored ground truth | 18 |
| Fixture sets ready or recorded | 1 |
| Complete paired target suites | 1 |
| Targets still lacking a complete paired suite | 17 |

There are no implied successes in the remaining 17. Results become publishable
only after standalone fixtures and three matched runs per arm are retained.

## Legacy blind pilot

The earlier A-SEC-3 pilot remains in `benchmarks/blind-runs.json`. It recorded
five seeded hits and one clean control, but the capture did not record model or
harness and supplied the check definition without the installed skill. Those
fields remain explicit nulls. The pilot is a historical regression signal, not
skill-lift evidence.

## Reporting rule

Every future result includes hits, misses, false positives, severity accuracy,
clean-control rate, input tokens, output tokens, elapsed time, excluded
post-run truth, duplicates, and technical failures. Results remain versioned by
program version, fixture commit, skill commit, model snapshot description, and
harness configuration. Corrections append an explanation rather than silently
rewriting history.

Retrospective audits of public projects are eligible only when a public advisory
or postmortem identifies an affected revision and a specific code-level defect.
Disclosure material stays outside the repository presented to the auditor until
the blind run completes. A broader root-cause observation counts as a miss when
it does not name the documented exploit path.
