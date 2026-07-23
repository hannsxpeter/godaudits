# Accuracy evidence

Accuracy evidence version: 1.0.0

Published: 2026-07-22

This file reports only retained model-run evidence. Deterministic runtime tests,
authored detector fixtures, catalog size, and a polished audit report are not
model-accuracy evidence.

## Published result

The only recorded blind pilot covers A-SEC-3. Five seeded repositories were
correctly flagged and one clean repository remained clean.

| Measure | Result |
|---|---:|
| Seeded defects | 5 |
| Hits | 5 |
| Misses | 0 |
| Clean controls | 1 |
| False positives | 0 |
| Severity matches after the recorded ground-truth correction | 5 of 5 |
| Recorded detection rate | 1.0 |
| 95 percent Wilson lower bound | 0.5655 |

This is not a skill-lift result. The original runs received the A-SEC-3 check
definition without the installed skill, and the capture did not record model or
harness. Those fields remain explicit nulls in
`benchmarks/blind-runs.json`. The repositories contain only three to five files,
so the result cannot separate method quality from fixture difficulty.

## Highest-weight domain program

`benchmarks/accuracy-program.json` now records ground truth before runs for one
highest-weight check in every catalog domain. Ties use the lowest numeric check
id. Each target specifies one defect and a nearby clean control outside the
future fixture repository.

| Program state | Count |
|---|---:|
| Domain targets with authored ground truth | 18 |
| Fixture sets ready for blind runs | 0 |
| Targets with attributed blind runs | 0 |
| Complete control versus installed-skill pairs | 0 |

There are no hidden successes in those zeroes. The fixture and run arms have not
been completed, so this file publishes no aggregate recall, precision, or skill
lift for the domain program.

## Required paired experiment

New results go in `benchmarks/paired-runs.json`. A publishable pair holds the
repository, fixture commit, check, repetition, model provider, model id, model
snapshot, harness name, harness version, harness configuration hash, and
capabilities constant. The control arm has no installed skill. The skill arm
pins the skill commit. Each target requires at least three runs per arm.

The repository gate rejects missing model or harness attribution, unknown target
checks, incomplete pairs, duplicate arms, or any pair whose pinned fields differ.
`npm run accuracy:check` prints whether skill lift has actually been measured.

## Reporting rule

Every future table includes hits, misses, false positives, severity accuracy,
clean-control rate, input tokens, output tokens, and elapsed time. Results stay
versioned by program version, fixture commit, skill commit, model snapshot, and
harness configuration. Corrections append an explanation to ground truth rather
than silently rewriting it.

Retrospective audits of public projects with documented CVEs or postmortems are
eligible only when the public record identifies a repository revision and a
specific code-level defect. Disclosure dates, fixes, and non-applicable claims
must remain outside the repository presented to the auditor.
