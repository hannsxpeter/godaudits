# Changelog

All notable changes to godaudits are documented here. The format follows
Keep a Changelog; versioning follows SemVer.

## [2.10.0] - 2026-07-16

The detector corpus now measures something real. 2.9.0 built the machinery and
honestly reported nothing, because authored fixtures cannot support a rate. This
release supplies the missing input: recorded blind audit runs.

### Added

- Six seeded fixture repositories under `benchmarks/fixtures/seeded/`, graded
  from blatant to genuinely subtle: an unscoped lookup of medical PII; a service
  whose list and update bind the tenant while the by-id read does not; a scoping
  helper that one later handler bypasses; a handler that loads unscoped and
  filters afterward; an export path that ignores the account predicate its
  siblings apply; and one control with no seeded defect at all.
- `benchmarks/seeded-ground-truth.json`, authored before any audit ran and kept
  outside the repositories so an auditor reading a fixture cannot see it.
- `benchmarks/blind-runs.json`: six real audit runs captured verbatim. Each
  auditor received one repository path and the catalog's own A-SEC-3 definition,
  with no ground truth, no defect count, and no hint that a control existed.
  Recorded exactly as returned, hits and misses alike.
- The corpus derives `recorded` cases from those runs, so A-SEC-3 now clears the
  five-independent-audit floor and reports a measured detection rate with its
  Wilson lower bound. Five for five reports as a rate of 1.0 with a lower bound
  of 0.57, because five for five is not a perfect detector and the artifact must
  not read as though it were. Every check still carried only by authored
  fixtures continues to report `authored-only` and no rate.

### Fixed

- Ground truth for the post-filter case said High. The blind run said Critical
  and was right: A-SEC-3's rule keys severity on the data class ("Critical on
  PII, financial, or cross-tenant data"), and support tickets across
  organizations are cross-tenant data. The original entry had imported a
  compensating-control discount the rule does not contain, and had not weighed
  that the handler is fail-open when `req.user` is absent, since it throws only
  after the row is already in memory, nor that the 404-versus-403 split is a
  cross-tenant existence oracle. Corrected, with the correction recorded in the
  file rather than quietly rewritten.

### Changed

- Recorded findings carry Firm rather than the label the run reported, because
  the capture schema collected a single citation per finding and one evidence
  path cannot support Certain. That is the corroboration invariant from 2.8.0
  applied to real output.
- Recorded prose passes through the same secret redactor a real audit uses. It
  fires conservatively: one run's remediation advice suggested resolving by
  `shareToken: req.query.token`, and the scanner masked the expression. Masking a
  code expression is the right direction to be wrong in, so the redactor was
  applied rather than loosened, and `blind-runs.json` keeps the verbatim capture.

## [2.9.0] - 2026-07-16

Finishes the detector-regression gate that 2.8.0 left parked at one case, and
closes the laundering trap that growing it would otherwise have opened.

### Added

- Corpus provenance. Every case declares itself `authored` (a maintainer-built
  fixture) or `recorded` (a real audit run captured verbatim). An authored case
  detects its own seeded defect by construction, so counting it toward a
  detection rate would manufacture a reliability-shaped number out of data
  written to pass. Authored cases now earn regression coverage and nothing else:
  only recorded runs can support a rate, and a case with no declared provenance
  is rejected rather than assumed.
- The reporting floor counts independent audits, not seeded instances. Five
  defects seeded inside one audit are one observation of a detector, not five:
  they share a repository, a model run, and every correlated mistake in it.
  Authored cases cannot top up a recorded sample toward the floor.
- The corpus grew from one case to five, each an independent audit seeding one
  defect against a different check (A-SEC-3, A-SEC-30, A-CODE-25, A-CODE-26,
  A-DB-24) across three domains, so a catalog change that renames or drops any
  of them orphans a seed and turns the gate red. Because all five are authored,
  the gate reports `authored-only` and no rate: broader coverage bought no
  false precision.
- `npm run corpus` generates the corpus and `corpus:check` gates its freshness,
  matching the treatment of every other generated artifact, so a hand-edited
  fixture cannot silently drift from its generator.

### Fixed

- The routing-exemption test proved its point on an audit that was invalid for
  an unrelated reason (domain weights no longer summed to 100). It now holds the
  audit valid, so the zero-weight exemption is what the test demonstrates.

## [2.8.0] - 2026-07-16

Narrow the gap between the confidence the report projects and the confidence a
static read can justify. The theme is saying less with more warrant: no score
math changed, and no check was added.

### Fixed

- Certainty now costs corroboration in both directions. A Certain Critical or
  High finding already required two independent evidence paths, but a Certain
  pass rode on a single evidence id of any strength, so a clean bill of health,
  the more dangerous error, was structurally cheaper to assert than an alarm. A
  Certain pass on a weighted check now carries the same two independent evidence
  methods, or it cannot be Certain. Two quotes from one file are one method, not
  two. Both gates derive from one shared corroboration helper.
- The catalog's own fixture proved the point: it claimed a Certain pass from a
  single line showing authorization middleware mounted centrally, which cannot
  establish that every path is guarded. It is recorded as Firm.
- The skill description claimed 429 checks; the catalog holds 431.

### Added

- Every consumer surface names its own method. The report headline reads
  `Static-read grade X/100 (verdict): an arithmetic roll-up of model-assigned
  pass/fail from a source read, not a test result, scan, or certification`, and
  the same scope travels into the YAML frontmatter (`grade_method`,
  `grade_scope`) and the SARIF run properties, so a machine or skim consumer
  cannot lift an unqualified signal.
- `evidence_basis`, a coarse ordinal on the overall grade and on every domain
  (`mostly Certain`, `mixed`, `none`), stating what the grade rests on. It is
  pooled on the same domain weighting the score uses, and it is deliberately a
  word rather than a count: a tally would launder self-assigned labels into a
  hard-looking statistic.
- Standards coverage reports control-evidence readiness, never certification.
  The column is relabelled from `Disposition`, and the not-certification caveat
  now renders in the artifact instead of living only in a reference the model
  reads. The compliance gate states that it is a policy-allowability screen, not
  a legal-compliance determination.
- An internal detector-regression gate (`npm run test:detectors`, wired into
  `npm run check`): a seeded-defect corpus plus a rollup over `evaluateAudit`
  that goes red when a catalog change orphans a seeded defect, when a recorded
  audit stops detecting one, or when a detector falsely flags a declared clean
  check. It withholds a detection rate below a five-observation floor and
  reports a Wilson lower bound above it, because three-for-three is not a 100%
  detector. It is internal by construction: it makes no claim about unseen
  repositories and no number it produces feeds a per-repo score.

### Changed

- The behavioral check set is derived, not duplicated. The six runtime-eligible
  ids moved out of `verify-runtime.js` into the catalog, which now emits a
  `verifiability` axis (`static` or `behavioral`) per check and fails the build
  when a behavioral id no longer exists, a guard the hardcoded set never had.

## [2.7.0] - 2026-07-16

### Added

- A-ARCH-23 (API contract design), a routing check for systems that expose an
  API or service surface: the API style is declared and applied consistently
  (REST, GraphQL, or RPC); a versioning strategy protects existing consumers; a
  machine-readable contract (an OpenAPI document or a GraphQL schema) is checked
  in and matches the routes; and errors use one consistent envelope (RFC 7807
  Problem Details or a documented equivalent). Scores into architecture.
- A-SEC-33 (API interaction safety), a routing check paired with A-ARCH-23:
  retryable unsafe operations (a POST or PATCH that creates or charges) accept
  and honor an idempotency key so a retry does not double-apply, and real-time
  surfaces (WebSocket, Server-Sent Events) authenticate the connection at
  handshake, authorize each subscription, and bound per-connection resource use.
  Scores into security.
- Both new checks carry no weight of their own; like the other ROUTING_CHECKS
  they score into their implicated dimension, so the catalog grows to 431 checks
  without shifting the scoring denominator.

## [2.6.0] - 2026-07-16

### Added

- Dynamic verification runtime that begins to close the static ceiling.
  `godaudits verify-runtime plan AUDIT.json` emits a runtime-probe handoff for the
  behavioral findings (races, dead controls, early transitions, authorization gaps
  on non-primary paths); an authorized harness (Godpowers god-browser-tester or a
  project Playwright suite) executes them; `godaudits verify-runtime apply
  AUDIT.json RESULTS.json` folds confirmed and refuted dispositions into a
  verification report (confirmed raises confidence, refuted marks for removal on
  re-audit). Static stays the default; nothing runs the app or the network.
- `docs/CHECK-MAP.md`, a generated, browsable map of all 429 checks by domain,
  scoring role, dimension, and standards, so the surface is legible without
  reading 18 modules. Regenerated on release; `npm run check-map:check` gates it.
- SKILL documents the verify-runtime commands and a second-opinion pass (an
  unconstrained read that hunts what the control-presence catalog structurally
  misses, then verifies each candidate with the normal discipline).

## [2.5.0] - 2026-07-16

### Changed

- Derive-not-duplicate refactor to remove the brittleness of hand-maintained
  counts. Tests now assert invariants, not magic numbers: `check_count` equals
  the actual check list length, ids are unique, and every domain's check ids are
  contiguous 1..N, so growing a domain never edits a test. The `doctor`
  standards-categories health check is a floor (OWASP baseline), not an exact
  count.

### Added

- `npm run version:sync` writes the single source of version truth (package.json)
  into every version surface and regenerates the catalog and prompts; `version:check`
  verifies without writing and prints the fix command. `version:check` is gated in
  `npm run check`.
- `npm run release:prepare -- <patch|minor|major|X.Y.Z>` bumps the version, syncs
  all surfaces, and stubs a CHANGELOG entry, one command instead of editing files
  in lockstep.

## [2.4.0] - 2026-07-16

### Added

- Documentation profile: intake derives the expected documentation set from the
  detected product form, scale, risk profile, and regulatory overlays, so a
  missing document is a finding only when the profile expects it (a prototype is
  not faulted for a missing continuity plan; a regulated platform is expected to
  carry a threat model and traceability record).
- Two routing checks (429 total): A-REPO-24 documentation-profile completeness
  (the required doc set for the detected profile exists, scaled, including the
  governance documents, initiation brief, traceability matrix, and closeout, at
  enterprise or regulated scale) and A-PRD-21 requirements traceability (each
  requirement links to its design, build task, and verifying test).

## [2.3.0] - 2026-07-16

### Added

- Compliance frameworks modeled as standards mapped to existing checks (never a
  separate scored domain), alongside OWASP Web Top 10:2025: privacy and
  sovereignty (GDPR, CCPA/CPRA, PIPEDA), accessibility (WCAG 2.2 AA, AODA,
  ADA/Section 508), security frameworks (SOC 2 Trust Services Criteria, ISO/IEC
  27001:2022 Annex A), and industry standards (PCI DSS v4.0, HIPAA Security
  Rule). Each framework's categories map to the checks that provide code
  evidence, so a framework is dispositioned per applicability without
  double-scoring.
- Three compliance routing checks (427 checks total): A-SEC-31 consent and
  tracking lifecycle, A-SEC-32 regulated-data governance records (ROPA, DPA/BAA,
  transfer basis, scope), and A-UI-24 WCAG 2.2 pointer target size and focus
  appearance.
- compliance.md section E: framework conformance via the standards ledger, the
  gate-versus-conformance distinction, and a technical-readiness (not
  certification) boundary.
- An opt-in dynamic verification section: behavioral findings can be confirmed
  or refuted at runtime by an authorized harness (Godpowers god-browser-tester
  or a project Playwright suite); static remains the safe default.

## [2.2.0] - 2026-07-16

### Added

- Five behavioral checks that verify a control is correctly wired on the live
  path, not merely present, closing a structural blind spot of a
  control-presence catalog (419 -> 424 checks):
  - A-SEC-29 authorization parity across every caller path (interactive
    session, API key or token, publicly exported function, action-in-query
    context, agent or tool call); suspension and step-up enforced at the data
    or function tier, not only a page or edge gate.
  - A-SEC-30 caller-supplied selectors (id, email, slug, hostname, model
    output) are ownership-bound to the authenticated principal before use.
  - A-DB-24 money flows reconcile end to end across charge, invoice,
    settlement, refund, and payout or transfer, with provider status confirmed
    before a record is final and transfers reversed on refund.
  - A-CODE-25 control flags are read on the enforcement path and lifecycle
    transitions never release a still-committed resource early or out of order.
  - A-CODE-26 scheduling and availability use the entity timezone, not UTC.
- The five new checks score as routing checks (findings land in the dimension
  of the control they implicate), so domain scoring weights are unchanged.

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
