# Changelog

All notable changes to godaudits are documented here. The format follows
Keep a Changelog; versioning follows SemVer.

## [2.18.0] - 2026-08-19

Repository health and change safety are now separate evidence claims. A new
diff-scoped workflow records the one or two facts a change depends on, follows
contract and lifecycle edges beyond a caller search, imports proof produced by
an authorized harness, and compiles whether the change is blocked, unproven, or
ready to merge. A convincing source read cannot round itself up to executable
proof.

This is a minor feature release inside the 30-day window in
`docs/RELEASE-POLICY.md`. It uses the security exception because change-proof
imports add a new text-ingestion surface and the shared redactor now masks bare
GitHub, OpenAI-style, and Google API credential forms wherever they occur, not
only after a `token=` or `Authorization: Bearer` label. No audit check id,
check count, dimension, weight, score, or AUDIT.json schema changes.

### Added

- `godaudits blast-radius plan`, `validate`, `apply`, `render`, and `evidence`.
  Planning is static and reads only explicit Git revisions. Applying results
  imports and redacts proof but never executes the recorded commands. Evidence
  export creates source and runtime leads without creating findings or moving
  scores.
- A deterministic impact inventory for direct reverse references plus public
  contracts, database schemas, dependency versions and local patches,
  configuration and feature flags, serialized wire formats, cross-language
  readers, asynchronous lifecycle ordering, cache invalidation, generated
  artifacts, public entry points, and open audit findings whose evidence paths
  changed.
- One or two explicit safety facts and a five-level proof ledger: assertion,
  source citation, failure path shown unreachable, executable proof against
  shipped code, and running-app reproduction. Levels 4 and 5 require recorded
  authority, environment, and isolation.
- Proof-results files bind to the exact base, head, and patch hash under review;
  executable proof must match its recorded authorization environment and
  isolation boundary.
- Confirmed risks with separate likelihood and consequence, cleared risks with
  proof and an invalidation condition, an exact before-merge reproduction, and
  a compiled gate which blocks refuted facts, failed reproductions, and open
  High or Critical consequence risks.
- `change-review.schema.json`, `change-review-results.schema.json`, the complete
  `references/change-safety.md` operating contract, runtime and CLI regression
  coverage, and MIT attribution for the pstack `blast-radius` concepts that
  informed the workflow.

### Changed

- The compact and full portable prompts include the change-safety contract.
  README, runtime architecture, threat model, package metadata, and the
  canonical skill document the new artifact and capability boundary.
- The shared credential redactor recognizes bare provider-token prefixes in
  commands, quotes, and results while retaining one-way fingerprints.

### Fixed

- Runtime verification no longer looks for `finding.runtime_probe`, a property
  the closed AUDIT.json finding schema never permitted. Custom diff probes now
  live in the validated CHANGE-REVIEW.json sidecar instead of an unreachable
  audit field.

## [2.17.0] - 2026-08-19

Reader-facing prose now follows the same evidence boundary as code findings.
The runtime narrows review to high-confidence copy candidates, then product, UX,
and launch evaluators reopen the source and decide whether the complete sentence
is specific, supported, and appropriate for its reader. A phrase match never
establishes AI authorship and never becomes a finding by itself.

This is a minor accuracy release inside the 30-day window in
`docs/RELEASE-POLICY.md`. It uses the material-accuracy exception because newly
generated evidence changes from schema 1.1 to 1.2 and the interpretation of
A-PRD-11, A-UX-6, A-UX-7, A-LAUNCH-6, and A-LAUNCH-7 can change audit outcomes.
No check id, check count, dimension, or weight changes.

### Added

- A zero-dependency `copy-signals` collector with eight candidate kinds for
  puffery, promotional formulas, vague attribution, stock formulas, filler,
  stacked hedging, chatbot residue, and generic conclusions.
- Reader-facing path scope for Markdown, MDX, HTML, JSX, TSX, Vue, Svelte, and
  message files under marketing, site, email, locale, message, and launch
  directories. Test and fixture directories, release history, licenses,
  notices, generated prompts, and Markdown code blocks are excluded.
- A ninth deterministic benchmark case and direct unit coverage. Positive
  fixtures exercise all eight signal kinds; clean controls cover precise
  technical terms, fenced examples, release history, and non-rendered source.
- `guides/copy-signals.md`, `docs/MIGRATION-2.17.md`, and a third-party NOTICE
  recording the MIT-licensed pstack `unslop` concepts that informed the
  taxonomy.

### Changed

- A-PRD-11, A-UX-6, A-UX-7, A-LAUNCH-6, and A-LAUNCH-7 now separate
  deterministic phrase discovery from contextual judgment. Broad technical
  vocabulary passes when it names a real mechanism, source, decision, or
  measured result.
- The ownership map routes product records and README copy to product, rendered
  product and CLI messages to UX, and landing, email, and channel copy to
  launch.
- The audit-format contract and exemplar add a final prose pass for titles,
  impacts, fixes, strengths, destinations, and summaries. Required technical
  terms and structural headings remain intact.
- EVIDENCE.json schema 1.2 extends `signals[].kind` with the eight `copy-*`
  values and records the limit that each remains a review lead.
- Compact and full portable prompts inline the copy-signal interpretation guide.

## [2.16.0] - 2026-08-04

Two gates that could not fire, and the drift each one let through.

The detector gate validated its fixtures without a catalog, so the two rules
that need catalog weights never ran over them and four fixtures drifted into
naming a routing check with no weighted owner. 2.15.1 fixed the fixtures by
hand and recorded the gap; this release closes the gap itself.

The balanced-profile table in `references/intake.md` published the legacy
pre-profile weights from `audit.js`, which sum to 110, while
`catalog/profiles.json` scored with weights summing to 100. Ten of eighteen
domains disagreed. Nothing caught it because both files were internally
consistent, and the module states that a reader can reproduce the overall score
from the recorded profile and weights, which a reader following that table
could not.

No check text, check count, dimension, or scoring behavior changes. An audit
re-run under 2.16.0 scores exactly what it scored under 2.15.1.

### Added

- `validateAudit(audit, { catalog, fragment: true })` scopes the catalog-aware
  rules to a deliberately partial audit: a seeded corpus fixture, a
  single-domain excerpt, a hand-built test case. Fragment scope drops what a
  fragment cannot satisfy by construction (pinned versions, an applicability row
  per domain, a complete per-domain ledger, and the domain and per-check
  weights, since a weight normalizes across an audit the fragment does not
  contain) and keeps the conformance rules that still catch a real defect in
  one: an unknown check id, routing-check ownership, and a finding with no
  weighted owner in its domain. A full audit passes no flag and is held to
  everything.
- `scripts/lint.sh profile-table` compares the balanced-profile table published
  in `references/intake.md` against `catalog/profiles.json` and fails when they
  disagree or when the published weights do not sum to 100.
- Three regression tests covering fragment scope: that it drops the whole-audit
  rules, that it keeps routing ownership in both directions, and that it still
  rejects a check id the catalog no longer defines.

### Fixed

- `scripts/detector-gate.js` validates every corpus case catalog-aware and
  fragment-scoped. Removing a seed's `ownerCheck` now turns the gate red with
  the exact rule text instead of passing silently.
- The balanced-profile table in `references/intake.md` matches
  `catalog/profiles.json`. It previously published security 15, code-quality 10,
  build 10, database 8, architecture 8, product 7, ux 7, llm 6, deploy 6,
  observe 5, and repo 5 against actual weights of 15, 9, 9, 7, 7, 6, 6, 5, 5, 4,
  and 4.

### Changed

- `DOMAIN_WEIGHTS` in `lib/audit.js` carries a comment recording that it is the
  legacy pre-profile fallback for audits validated without a catalog, that it
  does not sum to 100, and that it is not the balanced profile. Copying it into
  documentation is what produced the table above.
- `docs/ENGINE.md` and `docs/EVALUATION.md` document fragment scope and correct
  the note, added one release earlier, that said the gate runs without a
  catalog.

## [2.15.1] - 2026-08-04

2.14.0 and 2.15.0 shipped six checks with no regression coverage. No benchmark
fixture held a cache, a queue, or a replica count; the detector corpus covered
eight checks and none in architecture; and nothing under `benchmarks/`,
`evals/`, or `test/` referenced A-ARCH-24 through A-ARCH-29. A rename or a
deletion would have stopped detecting them silently. This release closes that
and the rule gap that allowed it.

No check text, weight, dimension, or scoring behavior changes. An audit re-run
under 2.15.1 scores exactly what it scored under 2.15.0.

This is a patch release inside the 30-day window in `docs/RELEASE-POLICY.md`
and matches none of its three exceptions. It is cut because `benchmarks/` ships
in the published package, so the corpus a consumer receives is part of the
artifact rather than repository-local scaffolding.

### Added

- Six seeded fixtures, one per system-design check, each a small repository
  whose architecture record carries numeric targets and whose code contradicts
  exactly one of them: a price write that never invalidates the cached key
  (A-ARCH-24), a consumer that inherits its concurrency from the broker
  (A-ARCH-25), a published 5 minute RPO behind a once-per-day backup plan
  (A-ARCH-26), session and rate-limit state in module scope behind six replicas
  (A-ARCH-27), a rename confirmation read back from the async replica
  (A-ARCH-28), and a 99.95 percent target served by one replica (A-ARCH-29).
  The corpus goes from 11 cases to 17.
- `SEEDS` accepts an optional `ownerCheck`. A routing check carries no weight of
  its own, so a seed whose failing check is one now names the weighted check in
  the same domain whose dimension the defect scores into, and the generated
  ledger carries both. That is what a real audit must do to satisfy the
  routing-ownership rule in `lib/audit.js`.
- `CONTRIBUTING.md` ground rule 6: a new check ships with a seeded fixture, and
  a routing check's seed also names its owner. The rule exists because six
  checks reached two releases without one.
- `docs/EVALUATION.md` documents the authored half of the corpus: what it
  covers, the one-clause-per-fixture rule, the no-collateral rule, the routing
  owner convention, and the fact that the gate runs without a catalog so the
  two catalog-aware rules are checked by hand when a seed is added.
- README describes the seeded-defect corpus and `npm run test:detectors`
  alongside the existing fixture corpus and evaluations.

### Fixed

- Four pre-existing authored fixtures seeded a routing check and named no
  weighted owner, so each failed catalog-aware validation on both the
  routing-ownership rule and the weighted-owner rule. The gate never caught it
  because `detector-gate.js` calls `validateAudit` without a catalog and the
  corpus builder calls `compileAudit` the same way, so the fixtures backing the
  gate were exempt from a rule enforced on every real audit. A-SEC-30 now routes
  to A-SEC-3, A-CODE-25 to A-CODE-5, A-CODE-26 to A-CODE-3, and A-DB-24 to
  A-DB-15, each chosen from the control the seeded defect implicates rather than
  from a fixed table.
- The README lead described 2.13 as the current release.

## [2.15.0] - 2026-08-03

Closes the mirror against godplans 1.12.0. That release added R-ARCH-21
through R-ARCH-24 to the plan-time architecture module: read consistency and
partition key per entity group, redundancy topology behind each availability
number, cache tiering with a staleness budget, and an overload posture per
entry surface. 2.14.0 had already covered caching, backpressure, recovery
objectives, and scale-out readiness from the audit side, so two obligations
were left with nothing checking them: what a read is allowed to see, and
whether an availability target has any redundancy standing behind it.

Two checks, 435 to 437. Both are audit-only and both are zero-weight routing
checks, so a repo's architecture score moves only through the dimension the
finding implicates, never through a new bucket. No scoring dimension changed
weight, so a 2.14.0 audit re-run under 2.15.0 scores the same unless one of the
two new checks fires.

### Added

- A-ARCH-28 (audit-only, deep-trace, conditional on read replicas or a
  partitioned store) checks that read consistency was decided rather than
  inherited: replica-served paths tolerate the staleness they get, post-write
  reads on money, auth, and inventory resolve to the primary, and a table
  projected past single-node scale carries a partition key instead of an open
  growth curve. A balance or post-write confirmation served from a replica with
  no recorded staleness tolerance is High. Partition mechanics, index shape, and
  replication lag tuning stay F-DB's; this check cites them.
- A-ARCH-29 (audit-only, conditional on a deployed runtime the project
  operates) checks that availability claims have redundancy behind them: a
  component carrying an availability target runs more than one instance behind a
  health-checked router, or its single instance is recorded with an accepted
  downtime number, and the router removes an unhealthy instance instead of
  continuing to route to it. A stated target above the single-instance baseline
  running one replica with no recorded acceptance is High, as is a replicated
  service with no liveness or readiness probe. A-ARCH-11 remains the home for
  targets with no arithmetic at all; this one is about the means, not the math.
- Two remediation seeds: pin post-write reads to the primary and record the
  staleness budget, and put redundancy behind the availability target.
- Two anti-patterns hunted: replica-served truth (a balance or permission read
  pointed at a replica because it was faster, with no record of the staleness
  that buys) and availability theater (an uptime target with one instance behind
  it, or a replica set whose router has no probe to remove a broken member).
- Surface map gains redundancy and routing signals (replica counts, autoscaling
  ranges, liveness and readiness probes, load-balancer health checks, standby
  and failover declarations, multi-zone placement) and read-routing signals
  (reader endpoints and their call sites, ORM read/write splitting, partition
  and shard key declarations). Conditional sub-surfaces gain a deployed runtime
  the project operates and read replicas, so a library is never graded on
  replicas it never runs.

### Changed

- The architecture mirror boundary line records `R-ARCH-1..24 defined`, up from
  `R-ARCH-1..20`, matching godplans 1.12.0. The boundary itself stays at 19: the
  audit-only range is numbered by arrival, not renumbered to track godplans,
  because a published check id has to keep resolving to the same check.
- The zero-weight routing note covers A-ARCH-24 through A-ARCH-29 and names
  where each lands: caching and backpressure into integration discipline,
  recovery objectives and read consistency into data architecture and
  invariants, scale-out readiness into component boundaries, redundancy behind
  an availability claim into NFR reality.

## [2.14.0] - 2026-08-03

The architecture domain already audited the structural half of system design:
shape, bounded contexts, invariant ownership, trust boundaries, decision
records. It was thin on the half that only shows up under load or after a
failure. Four audit-only checks close that gap. All four are routing checks, so
the catalog grows to 435 without shifting the scoring denominator.

This is a minor feature release inside the 30-day window in
`docs/RELEASE-POLICY.md` and matches none of its three exceptions. It is cut
because `catalog/checks.json` is a pinned contract: consumers resolve checks by
`pack_version`, and the same version resolving to a different check count is
worse than an off-cadence bump.

### Added

- A-ARCH-24 (caching contract), conditional on a caching layer existing: each
  layer records what it holds and for how long, every cached entity has a write
  path that invalidates or versions it, and no per-user or per-tenant value is
  served from a key carrying neither identifier. Unbounded in-process caches
  stay A-CODE-16's and the exploitable cross-tenant disclosure stays F-SEC's;
  this check owns the design decision and its missing invalidation.
- A-ARCH-25 (backpressure), conditional on async infrastructure: every consumer
  bounds its in-flight work, unbounded producer paths carry admission control,
  and overload has a recorded shed-or-degrade behavior rather than an
  out-of-memory kill. Retries with no circuit breaker into a saturated
  dependency are graded here; queue-depth alerting stays F-OBS's.
- A-ARCH-26 (recovery objectives), conditional on the project owning a durable
  store: a numeric RTO and RPO per store, a backup mechanism that satisfies the
  RPO arithmetically, and at least one restore actually performed and dated. An
  RPO shorter than the backup interval is arithmetic that already failed, the
  same treatment A-ARCH-11 gives latency budgets. Backup configuration stays
  F-DEPLOY's and migration reversibility stays F-DB's.
- A-ARCH-27 (scale-out readiness): no request-serving state in one process, no
  scheduled job firing once per replica by accident, no correctness depending
  on session affinity. The finding pairs the declared replica count with the
  state site that blocks it, so an architecture record promising horizontal
  scale over an in-memory session store is a finding rather than a claim.
- Four remediation seeds and four anti-patterns for the new checks: accidental
  cache, unbounded intake, backup theater, and scale-out fiction.
- Surface-map inventory for the new sub-surfaces (caching layers, backpressure
  signals, recovery records, scale-out state signals), and three new conditional
  sub-surfaces so a domain absent a cache, a durable store, or a replicated
  runtime records that reason instead of grading a surface it does not have.

### Changed

- A-ARCH-24, A-ARCH-25, and A-ARCH-27 are deep-trace: each needs a cross-module
  join (cache reads against every writer, consumer bounds against producer
  paths, in-process state against the deploy topology) that a targeted read
  cannot settle. A medium budget leaves them unknown, which lowers coverage
  rather than inventing a verdict. A-ARCH-26 is screening: its evidence is
  recorded objectives and dated drill artifacts.

## [2.13.0] - 2026-07-31

A readability release, drawn from reviewing what the wayfinder skill
(mattpocock/skills, MIT) could contribute. Its planning machinery has no place
here: godaudits does not chart decision tickets, and the audit already produces
the graph wayfinder assembles by hand. What was worth taking was its discipline
about reading a graph back, which godaudits had never applied to its own
remediation plan.

This is a minor feature release outside the 30-day cadence in
`docs/RELEASE-POLICY.md` and matches none of its three exceptions. It is cut
because the change alters the shape of the generated report and the published
AUDIT.json contract, and a documented contract change is clearer as a version
than as unversioned drift on main.

### Added

- `godaudits wayfind AUDIT.json` reads the remediation plan as a route:
  destination, frontier, claims, blockers, fog, and scope boundary. `--format
  json` returns the same map as data. It compiles nothing and mutates nothing,
  so it stays correct on a half-written plan and the instant a task closes. The
  frontier is deliberately not written into `computed`: a frontier committed
  into the audit record is stale the moment a task closes.
- The frontier is the open tasks whose every dependency is closed and which no
  session has claimed. A `superseded` dependency counts as closed, because a
  replaced task will never complete and waiting on it would strand its
  dependents. The final re-audit gate is the destination rather than a member
  of the route, so it never appears as a blocked task and never inflates a
  task's unblock count. Frontier tasks that share a file are reported as a
  concurrency conflict, which validation only rejects inside a single wave.
- Optional `audit.destination`: one or two sentences of prose naming what
  reaching the end of the remediation plan looks like. An audit that states
  none is reported as stating none rather than silently omitting it.
- Optional `task.claim` with owner and date. A session claims a task before
  starting work so a concurrent session skips it. A claim on a task that is no
  longer open is rejected, where it would read as work in flight that is not.
- Optional `check.question` on unknown checks: the precise question whose
  answer resolves the check, which is what makes an unknown takeable rather
  than merely uncounted. It is rejected on any resolved outcome. There is no
  rule requiring every unknown to carry one, because a fresh audit initializes
  every check to unknown and a medium budget holds every deep-trace check
  unknown by design.
- Optional root `not_yet_specified`: leads the audit can see but cannot yet
  phrase as a check. Its domain must be applicable, because fog only gathers
  toward the destination, and any check it names must still be unknown, because
  fog that graduated is cleared rather than restated.
- `docs/WAYFINDING.md` records the borrowed disciplines, what was cut, and why.

### Changed

- The generated report leads the remediation plan with the destination and the
  frontier, both of which are read before a task is chosen, and reports fog and
  scope in separate sections. Collapsing the two would let a coverage gap read
  as a deliberate boundary, or a boundary read as a gap.
- Task and finding references in the report carry their title with the id
  inside, replacing bare id lists on `Depends on` and `Fixes`. Check ids stay
  bare: their titles live in the catalog rather than in AUDIT.json, and the
  plan-aware mirror already uses that slot for the godplans R-id.
### Compatibility

Every wayfinding field is optional and nothing was added to `computed`. Audits
written before 2.13, including the committed dogfood and detector artifacts,
validate unchanged and still produce a map.

The published `auth0/node-jsonwebtoken` dogfood report is deliberately not
re-rendered. Its AUDIT.json pins `engine_version` and `pack_version` to 2.12.0,
so rendering it with this engine would require editing those fields and would
misattribute the run. A retained dogfood report is evidence of a specific
engine at a specific commit, not a live view, so it stays as it was published
and the next dogfood run will show the current report shape.

## [2.12.0] - 2026-07-23

The first measured-results release. It is cut under the accuracy-evidence
exception to the normal 30-day cadence because it replaces an unexecuted
protocol with a retained causal experiment and publishes the first external
retrospective, including their null and negative results.

### Added

- A complete paired A-SEC-6 experiment: five seeded repositories, one clean
  control, three repetitions per arm, and 36 eligible observations. Every pair
  pins the model, observed service alias, Codex CLI version, harness
  configuration, fixture commit, check, capability, and repetition. The
  control disables every discoverable filesystem skill; the treatment enables
  only the pinned godaudits skill.
- A retained attempt ledger with 37 pre-inference technical failures from
  harness development. Failed schema submissions never become model misses,
  hits, or false positives.
- Append-only ground-truth corrections and deterministic regrading.
  Post-run-discovered true defects remain visible but cannot contribute to
  causal lift, and repeated citations to one expected defect are counted as
  duplicates rather than false positives.
- The first qualifying external OSS dogfood package:
  `auth0/node-jsonwebtoken` at the parent of the CVE-2015-9235 fix. It retains
  EVIDENCE.json, compiled AUDIT.json, generated AUDIT.mdx, model and harness
  attribution, a secret-safe path-redacted transcript, artifact hashes, public
  advisory ground truth, and claim-specific adjudication.
- Reusable dogfood and transcript-redaction runners plus a strengthened
  publication gate that verifies commits, attribution, ground-truth counts,
  open unknowns, escalation leads, transcript safety, and every packaged hash.

### Changed

- `ACCURACY.md` now publishes the measured result: both A-SEC-6 arms reached 15
  of 15 pre-authored observations with no false positives, so the measured
  skill lift is zero on the small suite. The installed-skill arm used 1.94
  times the input tokens and 1.82 times the elapsed time.
- The public OSS retrospective records zero hits, one miss, and zero
  adjudicated false positives. The run found a broad missing algorithm
  allowlist but did not name the advisory's asymmetric-key to HMAC-key
  confusion path, so disclosure did not convert the near hit into a hit.
- Evaluation and release documentation now distinguish causal metrics,
  post-run truth, duplicates, technical failures, outside-ground-truth
  findings, and claim-specific retrospective misses.

### Fixed

- Accuracy grading no longer punishes a correct post-run-discovered finding as
  a false positive or rewards it as a hindsight-supported hit.

## [2.11.0] - 2026-07-23

A measurement-and-honesty release, drawn from reviewing what the parallel-
ideation project uditakhourii/adhd could contribute. Its reasoning machinery was
already present here as weighted checks; its discipline about provenance,
limits, and a mechanical generator/critic split was the part worth taking.

### Added

- `godaudits refute plan` and `godaudits refute apply`: serialize independent
  refutation into a brief-and-apply handoff. `plan` emits one brief per open
  Critical or High finding (claim, source citation, owning check, expected
  behavior) with the originating reasoning stripped so a separate pass reads the
  code fresh; `apply` folds verdicts (refuted, weakened, no-refutation) into a
  read-only disposition report. It adds no evidence to a finding: a refuted
  finding's guard citation supports a strength or the check's pass, never the
  finding. New zero-dependency `runtime/lib/refute.js`, covered by tests.
- `recall_by_severity` and `missed_by_severity` in `godaudits evaluate`: a
  dangerous miss can no longer hide behind many Low findings. Critical and High
  are always reported, as null when unseeded, never a perfect ratio.
- `tasks.closures` in `godaudits diff`: one entry per completed task with its
  fixes and a closure (all-resolved, partly-open, none-resolved,
  no-linked-findings), computed only from open-to-resolved transitions, tying a
  score move to the remediation that earned it. Auditor-asserted, not observed,
  and not joined to check outcomes.
- `attribution` block in `benchmarks/blind-runs.json`: fixture and recording
  commit, capture-era engine and pack version, capabilities, and explicit
  model/harness null. The corpus builder reads the anchors instead of
  placeholders and refuses to build recorded cases without the block. The
  block and the docs also state the standing limits of the recorded detection
  rate: no control arm, small fixtures, model and harness not captured.
- lint gates `catalog-claims` (every prose "N checks"/"N domains" claim must
  match the generated catalog) and `zero-dependency` (no runtime/optional/peer
  dependency, no model-client devDependency, no third-party require in the
  shipped runtime).
- `.nvmrc` pinning Node 22.
- `ACCURACY.md` and a versioned accuracy program covering the highest-weight
  check in every domain. The protocol requires ground truth before runs,
  model and harness attribution, clean controls, misses and false positives,
  and matched with-skill versus without-skill arms before reporting skill
  lift. The validator currently reports the honest baseline: zero replicated
  target pairs and no measured lift.
- `godaudits import-tool` adapters for SARIF, Semgrep, ast-grep, Gitleaks, and
  OSV-Scanner. Imported scanner output remains evidence leads rather than
  findings, preserves command and version provenance, and fingerprints rather
  than reproduces detected secrets.
- A versioned dogfood publication contract and repository index. A published
  entry must pin the audited revision, record model and harness attribution,
  include source evidence plus generated audit artifacts, and disclose misses
  and false positives. The empty index makes the current absence of qualifying
  public OSS audits explicit.

### Changed

- Supported Node floor raised from 18 (end of life) to 22, matching CI, across
  `engines`, the runtime doctor gate, and the docs.
- Second-opinion pass and Phase 6 remediation gained merge discipline and a
  class-fix rule: apply the pass whole, collide candidates against the catalog
  before calling them novel, cross-reference rather than delete, and fix a
  three-or-more-site finding at one shared enforcement point with a regression
  guard.
- Renamed `npm run eval` to `npm run eval:suites`; it runs deterministic Node
  suites, not the behavioral cases under `evals/cases/`.
- The npm tarball now ships `CONTRIBUTING.md`, `SECURITY.md`, and
  `CODE_OF_CONDUCT.md`.
- Every catalog check now declares a `screening` or `deep-trace` cost tier.
  `godaudits init` defaults to `--budget medium`, which keeps the complete
  ledger but leaves deep-trace checks unknown. `--budget full` enables both
  tiers, so a smaller budget cannot silently overstate coverage.
- Focused audits are now the documented default. Per-domain work runs in fresh
  context with the domain module, selected checks, and only the relevant leads
  from `EVIDENCE.json`; full all-domain audits are an explicit exception.
- Domain metadata now labels security and build as deep-capable and all other
  domains as screening-grade. Each domain carries an escalation criterion, and
  reports surface up to three repository-specific leads when the catalog
  ceiling is reached.
- Stable releases are limited to one per 30-day window except for security,
  broken installation, or material accuracy corrections. Ordinary changes
  accumulate without a version bump.

### Fixed

- Reconciled the check count: nine surfaces had claimed 419, 424, or 429 while
  the catalog holds 431. The prompt generator now derives the count from the
  catalog instead of a frozen literal, and `catalog-claims` gates it.

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
