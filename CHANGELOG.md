# Changelog

All notable changes to godaudits are documented here. The format follows
Keep a Changelog; versioning follows SemVer.

## [2.1.0] - 2026-07-13

godaudits 2.1 closes the context, agent-memory, artifact-truth, standards, and release-evidence gaps while preserving the version 2.0 audit schema.

### Added

- Six-form project detection with primary and secondary forms, separate product and industry overlays, conservative regulatory candidates, and a validated registry of all 37 arc-ready profiles.
- A zero-dependency Pillars 1.1 parser, structural validator, nested-scope router, absent and excluded state handling, context budgets, and a `godaudits pillars` command.
- Arc-ready 1.1 table-ledger validation, canonical and legacy artifact inventory, dependency-order drift, Git-history freshness with an mtime fallback, and launch prepublication checks bound to content or Git revision.
- Evidence fingerprint and commit binding with fail-closed `validate --require-fresh-evidence` behavior.
- A complete OWASP Web Top 10:2025 crosswalk and structured standards ledger, including explicit A10 exceptional-condition coverage.
- Eight form-aware benchmark repositories, five deterministic evaluation suites, and eight live-harness behavioral cases.
- Pinned official Agent Skills validation and validator dependencies, immutable GitHub Actions, scheduled release parity, package smoke tests, and a local release-check command.
- Fully constrained Evidence JSON Schema 2020-12 validation against real Pillars-present and Pillars-absent outputs.

### Changed

- Expanded the catalog from 414 to 419 checks with A-SEC-28 and A-MEM-21 through A-MEM-24. New audit-only routing checks do not add duplicate score weight.
- EVIDENCE.json now uses schema 1.1 and includes project context, arc artifacts, and Pillars state. AUDIT.json remains schema 2.0 with backward-compatible optional metadata and standards fields.
- Intake now routes form first across four independent axes instead of collapsing delivery form, product behavior, industry, and regulation into one archetype.
- Release validation now checks catalog and prompt freshness, schemas, evaluations, shell syntax, action pins, skill size, version parity, the official validator, and GitHub tag-release parity.
- Pillars evidence is clone-location independent, generated trees are excluded from scope discovery, and traversal stops safely at a fixed directory budget.

### Security

- Regulatory clues remain candidates until verified, repository drift invalidates release-grade evidence, and public activation evidence is rejected when its hardening content revision is stale.

## [2.0.0] - 2026-07-13

godaudits 2.0 turns the prompt-only skill into a portable evidence and audit
system while preserving the original 18-domain judgment model.

### Added

- A zero-dependency Node.js runtime bundled inside the skill with commands for
  static evidence collection, catalog compilation, state initialization,
  validation, rendering, SARIF import and export, re-audit diffs, evaluation,
  benchmarks, and installation diagnostics.
- Canonical `.godaudits/AUDIT.json` state with JSON Schema, explicit
  pass/fail/unknown/not-applicable outcomes, typed evidence provenance,
  reciprocal finding-task traceability, accepted-risk expiry, and a validated
  remediation DAG.
- A generated catalog containing all 414 checks across 18 domains, default
  scoring weights, routing checks, source locations, and content freshness
  hashes.
- Balanced, security-critical, growth, and library risk profiles with explicit
  domain weights.
- Deterministic score compilation, coverage caps, severity caps, secret-safe
  source fingerprints, stable re-audit deltas, and SARIF 2.1.0 output.
- Evaluation metrics for recall, precision, severity accuracy, citation
  validity, remediation closure, and clean-control rate.
- A cross-language runtime benchmark corpus, Node tests, schemas, threat model,
  engine documentation, evaluation guidance, and a 1.0 migration guide.
- Provider-neutral and Anthropic-dated policy packs that keep compliance claims
  versioned and auditable.
- A compact portable prompt and a full portable prompt, both generated from
  canonical skill sources with explicit coverage declarations.

### Changed

- Reports are generated from validated JSON instead of mixing mutable machine
  state and prose in one hand-edited MDX file.
- Critical or High findings marked Certain now require two independent evidence
  paths. Every evidence type has mandatory provenance fields.
- Catalog completeness, stale generated artifacts, expired waivers, task
  cycles, wrong weights, missing citations, and broken traceability are hard
  validation failures.
- Accepted risks retain their severity factors, caps, counters, and SARIF
  suppressions. Risk acceptance never improves the quality score.
- Re-audit diffs fail closed on project mismatch, invalid version transitions,
  or removed finding and task history.
- CI now runs the complete release gate, installer portability smoke test, and
  package dry run on Node.js 22.

### Security

- Scanner messages and static secret signals are redacted before evidence is
  emitted. Sensitive evidence cannot validate unless marked redacted.
- The installer marks managed copies and refuses to replace or remove an
  unowned destination.
- Static mode remains read-only and execution-free. Sandbox and connected
  evidence require explicit authorization and recorded capabilities.

## [1.0.0] - 2026-07-02

Initial release.

### Added

- The godaudits Agent Skill: one command that fingerprints an existing
  codebase, audits every applicable domain with evidence-backed findings,
  scores each domain with risk caps, and emits a master audit report at
  `.godaudits/AUDIT.mdx` with an agent-executable remediation plan.
- 18 domain reference modules: the seven hannsxpeter auditors carried forward
  (security from secauditor and harden-ready, code-quality from
  codeauditor, database from dbauditor, llm from llmauditor, seo from
  seoauditor, ui from uiauditor, ux from uxauditor) and the aihxp
  arc-ready and ready-suite tier disciplines audited as reality checks
  (product, architecture, roadmap, stack, repo, build, deploy, observe,
  launch), plus hannsxpeter/pillars (agent-memory) and hannsxpeter/codedna
  (style-genome).
- Check ids `A-<DOM>-n` mirroring godplans requirement ids `R-<DOM>-n`
  one to one, closing the plan-build-audit loop; plan-aware mode audits
  conformance against `.godplans/PLAN.mdx` when present.
- Four core modules: audit-format (the AUDIT.mdx contract: finding and
  task grammar, scoring bands, executor rules), intake (mode detection,
  fingerprint, applicability matrix, domain weights, ownership map),
  compliance (Anthropic Usage Policy gate, account safety, and in-code
  compliance findings), exemplar (the quality bar, worked).
- AUDIT.mdx template with GFM-safe MDX body, F-numbered findings with a
  severity triple, GA-numbered checkbox remediation tasks, waves,
  executor rules, and a session log.
- Cross-tool packaging: canonical skill under `skills/godaudits/`,
  `.agents/skills` and `.claude/skills` projections, `install.sh` with a
  six-destination matrix, generated `PROMPT.md` fallback for T3 Chat,
  Aider, and plain chat surfaces.
- Meta-linter (`scripts/lint.sh`) enforcing unicode cleanliness, version
  parity, spec-bound description length, module contract completeness,
  and PROMPT.md freshness; wired into CI with an installer smoke test.
