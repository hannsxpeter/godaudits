# Runtime engine

The godaudits runtime is zero-dependency CommonJS compatible with Node 22 and
newer. It lives inside `skills/godaudits/runtime/` so Agent Skills installers do
not lose it when they copy only the canonical skill directory.

## Components

| Component | Responsibility |
|---|---|
| `lib/catalog.js` | Parse modules, checks, Look and Fail guidance, scoring dimensions, cost tiers, depth and escalation labels, routing checks, weights, risk profiles, version, and source hash |
| `lib/evidence.js` | Deterministic file inventory, hashes, language counts, static signals, absence evidence, context composition, exclusions, and redaction |
| `lib/project-context.js` | Validate six forms and 37 arc-ready profiles, detect overlays, and audit arc-ready artifact and ledger drift |
| `lib/pillars.js` | Parse and validate Pillars 1.1 memory, nested scopes, portable routing, references, state, and budgets |
| `lib/init.js` | Create complete applicability rows and unknown check ledgers from the catalog |
| `lib/audit.js` | Semantic validation, score and coverage computation, caps, counters, links, risks, and task DAG rules |
| `lib/render.js` | Render GFM-safe MDX from compiled state |
| `lib/sarif.js` | Export SARIF 2.1.0 findings and source locations |
| `lib/sarif-import.js` | Import SARIF 2.1.0 results as secret-safe tool evidence |
| `lib/tool-import.js` | Normalize Semgrep, ast-grep, Gitleaks, OSV-Scanner, and SARIF reports as versioned evidence leads |
| `lib/diff.js` | Compare stable finding ids and score movement across re-audits |
| `lib/evaluate.js` | Measure expected-finding recall, precision, severity, citations, closure, and clean controls |
| `lib/verify-runtime.js` | Plan runtime probes for behavioral findings and fold executed results into a verification report |
| `lib/refute.js` | Plan independent refutation briefs for open Critical and High findings and fold verdicts into a disposition report |
| `godaudits.js` | CLI command routing and file I/O |

The root `bin/godaudits.js` is a package wrapper around the self-contained
runtime.

## Canonical state

`AUDIT.json` conforms to `schemas/audit.schema.json`. Runtime validation adds
cross-record rules that JSON Schema cannot express conveniently:

- Pack version and complete catalog coverage.
- Risk-profile domain weights and catalog check weights.
- Medium or full budget semantics, including deep-trace unknowns at medium.
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
- Project form and conservative overlay metadata.
- Complete OWASP standards dispositions when the standards ledger is present.
- Evidence fingerprint and commit freshness when the release gate is enabled.
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
Every check is also labeled `screening` or `deep-trace`. A medium-budget audit
keeps the full selected-domain ledger but must leave deep-trace checks unknown,
so the normal coverage compiler exposes skipped work. Domain metadata labels
security and build completeness deep-capable, labels the rest screening-grade,
and carries a specialist escalation criterion for each domain.
`catalog/standards.json` maps OWASP Web Top 10:2025 categories to existing
checks. `catalog/project-context.json` pins the six forms, 37 arc-ready profiles,
regulatory candidates, and canonical artifact paths. Both catalogs are
validated and included in the generated source hash.

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
- Detects primary and secondary project forms independently from product,
  industry, and regulatory overlays.
- Inventories arc-ready 1.1 table-ledger state and validates Pillars 1.1 scopes
  without executing repository code.
- Produces a deterministic fingerprint hash.

`schemas/evidence.schema.json` constrains every emitted nested project-context,
Pillars, file, signal, and absence record. Release validation uses a pinned
JSON Schema 2020-12 implementation against both Pillars-present and
Pillars-absent evidence, then proves malformed nested state is rejected.

The collector intentionally uses conservative regex signals. Domain evaluators
must trace reachability, framework behavior, and compensating controls.

`import-sarif` and `import-tool` provide the same trust separation for external
scanners. Adapters cover SARIF, Semgrep, ast-grep, Gitleaks, and OSV-Scanner.
They normalize tool name, version, producing command, result text, rule or
package scope, and location, mask credential-shaped values, and create evidence
records only. Non-SARIF adapters refuse missing command provenance and refuse an
unknown tool version when the report does not embed one. Gitleaks never emits
the matched secret; it emits only a short SHA-256 fingerprint.

## Freshness and artifact truth

Initialization can bind AUDIT.json to EVIDENCE.json with the evidence SHA-256
and commit. `validate --repo . --require-fresh-evidence` recomputes the static
fingerprint and fails closed on either mismatch. `.godaudits/` is excluded, so
writing the audit itself does not invalidate evidence.

The project-context engine reads the canonical arc-ready 1.1 step table and the
legacy bullet ledger. It validates the seven-state vocabulary, complete tier
coverage, claimed artifact existence, empty artifacts, timestamps, disk hashes,
dependency order, unrecorded canonical artifacts, downstream freshness, and the
content or Git revision recorded by `.launch-ready/PREPUBLICATION.md`.

Freshness uses the last Git change timestamp for each clean tracked artifact. A
modified or untracked file, or a non-Git repository, uses a named
filesystem-mtime fallback.
The volatile timestamps and their source labels are excluded from the project
context fingerprint, so clone location and checkout time cannot change evidence
identity.

## Pillars routing

The Pillars engine contains a small local YAML subset parser, exact eight-heading
validation, path-derived depth-one identities, floor-pillar rules, reference
integrity, present/stub/excluded/absent states, portable contiguous-token
matching, nested-scope precedence, and context budgets. The `pillars` command
returns both the complete inherited load and nearest-scope winners so ancestor
guidance remains visible without overriding child policy.

Scope discovery ignores dependency, build, coverage, VCS, generated, and audit
trees. It stops with a structured incompatibility finding after 20,000 visited
directories. Serialized Pillars roots are repository-relative, so evidence
does not leak a machine-local parent path or vary across clone locations.

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
