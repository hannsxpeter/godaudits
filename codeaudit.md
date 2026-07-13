# godaudits code audit

Post-remediation audit completed 2026-07-13 for the 2.1.0 release candidate on
`codex/godaudits-2.1`.

## Outcome

**99/100, Grade A, release-ready. No active findings.**

The initial independent review scored 89/100 and found four Medium and two Low
gaps. All six were repaired, directly tested, documented, and passed through
the full release gate. The remaining point represents declared product limits:
static evidence cannot prove runtime behavior, regulatory applicability still
requires authorized primary-source verification, and final finding judgment
cannot be reduced to deterministic regex signals.

## Snapshot

- Product: public Agent Skill and deterministic Node.js 18+ auditing runtime.
- Runtime dependency posture: zero dependencies inside the portable skill.
- Audit catalog: 419 checks across 18 domains.
- Context coverage: six project forms and all 37 arc-ready profiles.
- Standards coverage: all ten OWASP Web Top 10:2025 categories.
- Entry points: `bin/godaudits.js` and
  `skills/godaudits/runtime/godaudits.js`.
- Review scope: exhaustive review of authored runtime, schemas, generated-file
  sources, CI, release tooling, package metadata, tests, evaluations, and docs.
- Generated artifacts: verified through deterministic freshness builders.
- External verification: pinned official Agent Skills validator and pinned JSON
  Schema 2020-12 validator.

## Scorecard

| Dimension | Score | Grade | Weight | Specific verdict |
|---|---:|---|---:|---|
| Security | 99 | A | 20% | Secret-safe evidence, repository-relative serialization, bounded traversal, and fail-closed launch provenance. |
| Architecture and Design | 99 | A | 15% | Cohesive zero-dependency modules, canonical state, generated views, and explicit upstream contracts. |
| Code Quality and Maintainability | 98 | A | 15% | Small owning modules, stable ids, validated catalogs, and documented fallback semantics. |
| Testing and Verification | 99 | A | 15% | 69 tests, 8 repository benchmarks, 5 focused eval suites, CLI subprocess cases, and schema rejection tests. |
| Error Handling and Resilience | 99 | A | 10% | Invalid, stale, missing, or unverifiable evidence fails closed with structured diagnostics. |
| Performance and Efficiency | 98 | A | 8% | Bounded reads and traversal, generated-tree exclusions, stable ordering, and no runtime dependency load. |
| Dependencies and Supply Chain | 98 | A | 7% | Zero runtime dependencies, immutable action SHAs, pinned upstream validator commit, and exact validator dependencies. |
| Documentation and Drift | 100 | A | 5% | Version parity, migration guide, generated prompt freshness, formal schemas, and release notes agree. |
| Observability and Operability | 100 | A | 5% | Doctor, deterministic checks, release script, scheduled parity, MDX, SARIF, and structured diffs. |
| Weighted overall | 99 | A | 100% | Release-ready with no confirmed product defects. |

## Remediation ledger

| Finding | Initial severity | Resolution | Verification |
|---|---|---|---|
| ERR-001: valid Git revisions rejected by prepublication | Medium | Content SHA-256 and Git revision provenance are both supported; missing, malformed, mismatched, and unresolvable revisions fail closed. | Temporary Git repository tests cover content, commit, and unverifiable cases. |
| QUAL-001: freshness depended on checkout mtime | Medium | Clean tracked artifacts use last Git change time; modified, untracked, and non-Git artifacts use an explicit mtime fallback. Volatile timestamps are excluded from fingerprints. | Commit-order, clone, touch, and dirty-worktree tests pass. |
| SEC-001: Pillars leaked an absolute root | Medium | Pillars serializes `.` and uses repository-relative paths throughout evidence. | Identical copies under different parents produce equal fingerprints and no parent-path disclosure. |
| PERF-001: Pillars traversed generated trees without a limit | Medium | Dependency, build, coverage, VCS, generated, and audit trees are excluded. Discovery stops with a structured error at 20,000 directories. | Exclusion and forced-budget regression cases pass. |
| TEST-001: new CLI seams lacked end-to-end tests | Low | Subprocess tests cover Pillars output, evidence-derived initialization, fresh validation, stale validation, output files, and exit codes. | Shipped CLI tests run in `npm test` and package prepack. |
| DOC-001: evidence schema left nested state unconstrained | Low | Every project-context, artifact, Pillars, file, signal, and absence shape now has required fields and closed object contracts. | A pinned JSON Schema 2020-12 validator accepts real outputs and rejects malformed nested state. |

## Release evidence

- `npm run check`: passed.
- Node tests: 69 passed, 0 failed.
- Benchmark corpus: 8 passed, 0 failed.
- Deterministic evaluation suites: 5 passed, 0 failed.
- Official Agent Skills validator: passed.
- JSON Schema 2020-12 validation: two real evidence modes passed; malformed
  nested evidence rejection passed.
- Generated catalog and prompts: fresh.
- Catalog: 18 domains, 419 unique checks.
- Context registry: six forms, 37 profiles.
- OWASP standards ledger: ten categories.
- Package dry run: 122 files, approximately 487 kB compressed and 1.6 MB
  unpacked.
- Doctor diagnostics: passed.
- Action pins, shell syntax, version parity, schema parsing, skill budget, and
  ASCII policy: passed.

## Strengths to preserve

- Deterministic state is authoritative in JSON; MDX and SARIF are generated
  views.
- Every applicable check remains explicit as pass, fail, unknown, or
  not-applicable. Unknown never becomes an implicit pass.
- Evidence collection is static, secret-safe, content-hashed, and does not run
  product code, tests, models, network calls, or live systems.
- Findings and remediation tasks retain reciprocal, validator-enforced
  traceability with stable re-audit ids.
- Project form, product archetype, industry overlay, and regulatory candidate
  remain separate axes, preventing applicability collapse.
- Pillars state distinguishes present, stub, excluded, absent, and unknown, and
  nested routing retains both ancestor guidance and nearest-scope winners.
- OWASP mappings reuse existing weighted checks, so standards coverage does not
  double-count quality scores.
- Release checks reproduce tests, benchmarks, evaluations, official validation,
  schema validation, package inspection, and diagnostics from one command.

## Systemic resolution

Repository identity is now separated from filesystem location and checkout
time. Integration contracts now cover the shipped CLI and the serialized JSON
boundary, not only in-process library functions. Release tooling treats local
virtual environments as tooling rather than authored source while keeping the
repository's ASCII policy strict.

## Active findings

None.

## Residual product limits

These are explicit scope limits, not release defects:

- Static collection produces evidence leads and absences, not final reachability
  judgments.
- Current legal or platform policy claims require authorized primary-source
  verification.
- Live runtime, deployment, model, and production behavior require separately
  authorized evidence collection.
