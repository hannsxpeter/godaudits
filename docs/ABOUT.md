# About godaudits

godaudits exists because an audit is useful only when three things hold at the
same time:

1. The judgment is specific to the repository.
2. The evidence and arithmetic are reproducible.
3. The result turns into verifiable work.

Version 1 established the judgment discipline: evidence at file and line,
adversarial refutation, root-cause clustering, one owning domain, calibrated
severity, risk caps, strengths, and executable remediation tasks.

Version 2 makes that discipline enforceable. The system now has two halves.

## Judgment layer

The Agent Skill and 18 reference modules define 414 checks across product,
architecture, stack, database, security, LLM integration, UX, UI, SEO, code
quality, style genome, agent memory, repository, build completeness, roadmap,
deployment, observability, and launch readiness.

Agents trace execution paths, compare claims to code, distinguish root causes
from symptoms, refute candidate findings, and write fixes specific enough for a
different agent to execute.

## Deterministic layer

The bundled runtime performs operations where discretion is a liability:

- Compile the authored modules into a versioned check catalog.
- Fingerprint repository files, hashes, manifests, languages, signals, and
  absences without executing product code.
- Initialize every selected check as unknown.
- Validate outcomes, evidence, ids, weights, reciprocal links, task DAGs, risk
  expiry, and final-gate closure.
- Compute scores, coverage, caps, counters, and verdicts.
- Render MDX and SARIF from canonical JSON state.
- Diff re-audits without losing historical ids.
- Measure audit output against expected findings and clean controls.

## Why the split matters

A model is good at interpreting code in context. It should not be trusted to
remember 414 checks, maintain counters by hand, reproduce score arithmetic,
notice every broken cross-reference, or keep generated views synchronized.

A deterministic program is good at those invariants. It cannot decide whether
an authorization middleware truly binds, whether a product promise is honest,
or whether twelve symptoms share one root cause.

The two layers are stronger together than either is alone.

## Safety boundary

Static mode remains the default and makes no product execution or network
requests. Runtime and connected evidence require explicit authority and retain
their provenance. Secret values are masked before entering audit artifacts.
Unknown stays visible and caps the verdict rather than being converted into a
convenient pass.

## The closed loop

godaudits mirrors godplans through shared `R-DOM-n` and `A-DOM-n` ids. Planning
states the requirement, implementation builds it, auditing evaluates it,
remediation fixes it, and re-audit proves the movement with a score and coverage
delta.

The audit is not an opinion with a scorecard. It is a versioned evidence graph
that compiles into work.
