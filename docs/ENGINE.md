# Runtime engine

The godaudits runtime is zero-dependency CommonJS compatible with Node 18 and
newer. It lives inside `skills/godaudits/runtime/` so Agent Skills installers do
not lose it when they copy only the canonical skill directory.

## Components

| Component | Responsibility |
|---|---|
| `lib/catalog.js` | Parse modules, checks, Look and Fail guidance, scoring dimensions, routing checks, weights, risk profiles, version, and source hash |
| `lib/evidence.js` | Deterministic file inventory, hashes, language counts, static signals, absence evidence, archetype inference, exclusions, and redaction |
| `lib/init.js` | Create complete applicability rows and unknown check ledgers from the catalog |
| `lib/audit.js` | Semantic validation, score and coverage computation, caps, counters, links, risks, and task DAG rules |
| `lib/render.js` | Render GFM-safe MDX from compiled state |
| `lib/sarif.js` | Export SARIF 2.1.0 findings and source locations |
| `lib/sarif-import.js` | Import SARIF 2.1.0 results as secret-safe tool evidence |
| `lib/diff.js` | Compare stable finding ids and score movement across re-audits |
| `lib/evaluate.js` | Measure expected-finding recall, precision, severity, citations, closure, and clean controls |
| `godaudits.js` | CLI command routing and file I/O |

The root `bin/godaudits.js` is a package wrapper around the self-contained
runtime.

## Canonical state

`AUDIT.json` conforms to `schemas/audit.schema.json`. Runtime validation adds
cross-record rules that JSON Schema cannot express conveniently:

- Pack version and complete catalog coverage.
- Risk-profile domain weights and catalog check weights.
- Unique ids and evidence references.
- Pass, fail, unknown, and not-applicable semantics.
- Mandatory per-type evidence provenance and credential-shape rejection.
- Two independent evidence paths for Certain Critical and High findings.
- Routing-check ownership.
- Finding and task reciprocity.
- Critical and High closure.
- Task dependency existence, order, cycles, and final-gate closure.
- Parallel-task file isolation and bounded active report size.
- Accepted-risk ownership and expiry.
- Compliance findings and owned unknowns.
- Derived score, coverage, cap, and counter state.

## Catalog compilation

Domain modules remain the authored source. `npm run catalog` parses every check
and scoring section into `catalog/checks.json`. The generated artifact records a
source hash. `npm run catalog:check` rebuilds in memory and compares bytes without
mutating the working tree.

Scoring dimension weights are divided across their listed checks. Conditional
checks retain catalog weights and drop out through `not-applicable`, after which
the compiler normalizes active evaluated weights. Sweep checks that score inside
another control are marked `routing` with zero direct weight.

## Evidence fingerprint

The static collector:

- Walks files in stable lexical order.
- Excludes generated, dependency, VCS, build, coverage, and audit directories.
- Skips content inspection above 1 MiB while recording the file.
- Hashes inspected files with SHA-256.
- Detects text by content so extensionless environment and configuration files
  are not silently skipped.
- Records high-signal locations as leads, never findings.
- Redacts credential-shaped values before serialization.
- Records zero-hit searches for CI, tests, lockfiles, and agent instructions.
- Produces a deterministic fingerprint hash.

The collector intentionally uses conservative regex signals. Domain evaluators
must trace reachability, framework behavior, and compensating controls.

`import-sarif` provides the same trust separation for external scanners. It
normalizes tool name, version, command provenance, result text, and location,
masks credential-shaped values, and creates evidence records only.

## Score computation

Each evaluated check contributes its catalog weight multiplied by an outcome
factor: pass 1.0, Low failure 0.75, Medium 0.5, High 0.25, Critical 0. Unknown is
excluded from the quality denominator and reduces coverage. Not-applicable drops
out with evidence.

Domain scores normalize evaluated active weight. Overall uses the chosen risk
profile over applicable domains. Coverage and risk caps apply last.

## Adding an engine feature

1. Add a failing built-in `node:test` case.
2. Implement in the smallest owning module.
3. Add schema coverage when state changes.
4. Add a corpus fixture when evidence behavior changes.
5. Update SKILL.md and the relevant contract.
6. Regenerate catalog and portable prompts.
7. Run `npm run check`.
