# Product audit module

Audits whether the codebase can still answer the questions a PRD exists to settle: what problem, for whom, what counts as done, and what was refused. It runs the prd-ready disciplines forward against a live repo: does a product record exist, does the code keep the promises the record and the README make, and is success measured by instrumentation that actually emits. Findings ship as F-PRD-n blocks and a 0-100 product score into `.godaudits/AUDIT.mdx`. The orchestrator loads this module first in the domain-pass order for every archetype, because every later domain scores the code against what the product claims to be. No archetype excludes product by default; the only defensible exclusion is a repo with no product of its own (a dotfiles mirror, a config sync repo), and the applicability matrix must record that specific reason.

## Lineage

Descends from aihxp prd-ready, the top of the ready-suite planning tier, by way of the godplans product module that inverted it into R-PRD-1 through R-PRD-17. The disciplines that carry into audit time: the three-label test (every product sentence is a decision, a hypothesis, or an owned open question), the substitution test against two named competitors, the MoSCoW caps (at most 50% Must, hard cap 7), sourced metrics with named instrumentation, the ten-dimension NFR sweep, separate risk and assumption registers, the banned-phrase grep, and the have-nots list, which becomes this module's severity convention: a have-not that blocks a PRD at plan time is at least Medium when found live in a shipped codebase. prd-ready is not one of the seven aihxp auditors, but it carries audit DNA in its Mode C protocol (quote the failing sentence, name the dominant failure mode, list the remediation); this module runs Mode C against the whole repo instead of one document.

## Surface map

Inventory before any check runs; declare each conditional sub-surface present or absent with the reason recorded in the audit.

- Product record: `.prd-ready/PRD.md`, `.prd-ready/HANDOFF.md`, `docs/PRD*.md`, `docs/product*.md`, `docs/brief*.md`, the top third of `README.md`. Plan-aware mode adds the product section of `.godplans/PLAN.mdx`.
- Metrics surface: `docs/metrics.md`, `analytics/`, and emit call sites: grep `track(`, `capture(`, `logEvent(`, `gtag(`, plus imports of `posthog`, `amplitude`, `mixpanel`, `segment`, `plausible`.
- Requirements-to-test surface: `tests/acceptance/`, `e2e/`, `*.feature` files, spec names carrying Given/When/Then criteria.
- Promise surface: README feature lists, `docs/pricing*`, landing copy checked into the repo (`site/`, `www/`, `marketing/`).
- Closure surface: `docs/runbook.md`, `docs/retro*.md`, `docs/prior-art.md`, `docs/validation/`, `CHANGELOG.md`, and the git history of the product record itself.
- Conditional declarations: the PRD document (absent means checks run against README plus reconstruction and A-PRD-1 fires), the analytics layer (absent at funded scale is the A-PRD-5 finding, not an exemption), the outward promise surface (absent drops A-PRD-18 and A-PRD-20), and deployment (never-shipped repos drop A-PRD-17).

The intake fingerprint already inventories routes, entities, roles, contributor count, and deploy recency; cite it for the code side of every doc-versus-code comparison instead of re-scanning.

## Checks

Severities are funded-product calibration; scale them per `intake.md`. A-PRD-1 through A-PRD-17 mirror R-PRD-1 through R-PRD-17 one to one; A-PRD-18 through A-PRD-20 are audit-only. In plan-aware mode each check also reads the matching PLAN.mdx section and tags the R-id.

1. A-PRD-1 Verify the repo carries a product definition answering the seven pre-flight questions: problem, who has it, today's workaround, why now, concrete cost, 90-day success as an outcome, appetite; unknowns recorded as assumptions, never fabricated.
   Look: the product record surfaces above; plan-aware: the PLAN.mdx mode declaration and pre-flight block.
   Fail: no artifact anywhere answers the problem-user-success trio: High. Answers present but gaps papered over with invented specifics: Medium.
2. A-PRD-2 Verify appetite or timeline is expressed as a duration bound to a scope-cut rule, never as an effort estimate.
   Look: product record, `ROADMAP.md`, milestone docs; grep `appetite`, `deadline`, `estimate`, `weeks`.
   Fail: time appears only as feature-complete estimates, or a funded product has no time bound at all: Medium.
3. A-PRD-3 Verify the problem statement is solution-free and specific: the "users today do X manually, which takes Y and costs Z" shape, surviving substitution against two named competitors.
   Look: product record problem section, README pitch paragraph; grep `Users need a tool`, `Our product`, `The system`.
   Fail: solution-shaped problem, or a pitch that reads plausibly for a competitor: Medium; quote the failing sentence in Evidence.
4. A-PRD-4 Verify one primary user in five bullets: role, context, constraint, current workaround, citation or flagged research gap; no persona fiction, no decorative demographics.
   Look: product record target-user section; compare against the role and permission models in the intake fingerprint.
   Fail: "everyone who X", narrative personas, or code roles that contradict the stated user: Medium.
5. A-PRD-5 Verify at most 5 success metrics, each with number, deadline, outcome frame, and named source; at least one leading and one lagging; and the emitting instrumentation is live in code.
   Look: `docs/metrics.md`, product record success section; grep emit call sites in `src/` per the metrics surface.
   Fail: documented metrics with zero emitting call sites, or no success definition anywhere: High. Vanity-only metrics (signups, pageviews, downloads): Medium.
6. A-PRD-6 Verify functional requirements are user-observable, MoSCoW ranked under the caps (at most 50% Must, hard cap 7), with Given/When/Then criteria that trace to acceptance tests.
   Look: product record requirements; `tests/acceptance/`, `e2e/`, `*.feature`.
   Fail: Must requirements with no acceptance test or criteria: Medium. More than 7 Musts or an unranked laundry list: Medium. When the repo lacks any test suite, suite existence cross-references F-REPO; this check scores only the missing criteria.
7. A-PRD-7 Verify all ten NFR dimensions carry a threshold with a stated basis or an owned open question; security and compliance are never silent.
   Look: product record NFR section; code traces such as a11y lint config, i18n scaffold, retention jobs.
   Fail: silent security or compliance statement: High. Invented numbers with no basis (a bare `99.99%`): Medium. Actual security defects cross-reference F-SEC per the ownership map; SLO wiring cross-references F-OBS.
8. A-PRD-8 Verify the negative-space record: 3 or more reasoned no-gos with reconsider conditions, a deferral, a non-ownership statement, and a rabbit hole with its smallest-version alternative.
   Look: product record out-of-scope section; compare against half-built features visible in the repo.
   Fail: no out-of-scope record while the repo carries abandoned half-features: Medium. Missing entirely: Medium at funded scale, Low below.
9. A-PRD-9 Verify risks and assumptions live in two separate complete registers, and validation artifacts exist for assumptions the build depended on.
   Look: product record registers; `docs/validation/*.md` with a `Decision:` line.
   Fail: merged or missing registers, or load-bearing assumptions with no validation trace: Medium.
10. A-PRD-10 Verify every open product question carries owner, due date, blocking flag, and recommended default.
    Look: product record open-questions section; grep `TBD`, `TODO` across `docs/` product files (code-level TODO handlers belong to build).
    Fail: unowned TBD or TODO in product docs: Medium.
11. A-PRD-11 Verify the product record passes the three-label test and contains none of the banned phrases.
    Look: grep product docs and README for `seamless`, `best-in-class`, `world-class`, `cutting-edge`, `game-chang`, `revolutionary`, `industry-leading`, `enterprise-grade`, `AI-powered` on a non-AI product.
    Fail: banned phrases in the product record or README: Low. Hits in landing copy cross-reference F-LAUNCH.
12. A-PRD-12 Verify a prior-art record: 3 comparables, each with honest status (thriving, stagnant, dead, pivoted) and a one-line lesson.
    Look: `docs/prior-art.md` or the product record's prior-art section, entries carrying `Status:`.
    Fail: absent at funded scale: Low.
13. A-PRD-13 Verify the downstream pre-fill is reconstructable and true: entities, flows with error paths, roles, integration points, and trust boundaries documented and matching the code.
    Look: `.prd-ready/HANDOFF.md` or the plan's handoff block; compare the entity and route inventory in the intake fingerprint.
    Fail: documented entities or roles the code contradicts: Medium. No record and not reconstructable from code: Low.
14. A-PRD-14 Verify a sign-off roster with specific attestations (problem, feasibility, flows, testability), never blanket approval.
    Look: product record sign-off section; PR review history on the PRD file via `git log`.
    Fail: approved status with blanket or absent attestations on a multi-contributor repo: Low.
15. A-PRD-15 Verify change control: lifecycle state declared, changelog rule followed, fork threshold named; post-approval edits are logged.
    Look: the product record's changelog section against `git log --follow` on the same file.
    Fail: post-approval edits with no changelog entry (the moving-target record): Medium.
16. A-PRD-16 Verify exactly one visual-identity direction phrase exists for UI and launch to inherit.
    Look: product record, `docs/design*`, `agents/` pillars.
    Fail: absent while the project renders pixels it owns: Low. Execution quality cross-references F-UI.
17. A-PRD-17 Verify closure artifacts: a 30-day retro record or schedule with metric baselines, a top-5 support runbook, and a one-paragraph rollback statement.
    Look: `docs/runbook.md` with `## Failure:` entries, `docs/retro*.md` with `Baseline:` lines.
    Fail: deployed product with no runbook or no rollback statement: Medium. Rollback pipeline mechanics cross-reference F-DEPLOY.
18. A-PRD-18 Verify every outward promise has a shipped counterpart: README and landing feature claims map to live routes, commands, or screens.
    Look: promise surface claims against the route and handler inventory in the intake fingerprint.
    Fail: an advertised capability with no code path: High. A stub-backed promise cites the F-BUILD stub finding per the ownership map instead of re-scoring it here.
19. A-PRD-19 Verify the metric-event mapping holds in both directions: every documented metric is computable from emitted events, and "active" has an event-level definition.
    Look: emitted event names in code versus the mappings in `docs/metrics.md`.
    Fail: a success metric no event can compute, or an undefined "active": Medium. Orphan events no metric consumes: Low.
20. A-PRD-20 Verify monetization promises are enforced: every documented tier cap, quota, or plan boundary has an enforcement branch in code.
    Look: pricing copy and tier constants; grep `tier`, `quota`, `limit`, `plan` in `src/` for the enforcing conditionals.
    Fail: a documented cap with no enforcement code (silent revenue leak or overpromise): High.

## Scoring

Weights derive from the godplans product self-audit rubric, collapsed into auditable dimensions. Sum is 100; re-normalize when a conditional dimension's sub-surface is declared absent in the Surface map.

- Problem, user, and framing (A-PRD-1 to A-PRD-4): 25.
- Success metrics and live instrumentation (A-PRD-5, A-PRD-19): 20.
- Requirements and promise integrity (A-PRD-6, A-PRD-18, A-PRD-20): 20. Conditional: with no outward promise surface, A-PRD-18 and A-PRD-20 drop and the dimension rests on A-PRD-6.
- NFR coverage (A-PRD-7): 10.
- Scope negative space (A-PRD-8): 10.
- Registers and question hygiene (A-PRD-9 to A-PRD-11): 10.
- Lifecycle, prior art, and closure (A-PRD-12 to A-PRD-17): 5. Conditional: never-shipped repos drop A-PRD-17 and score this dimension on change control and prior art alone.

Any open Critical finding caps this domain at 69.

## Remediation seeds

Representative tasks in the audit-format grammar; at audit time the agent assigns real GA ids and adds the Fixes: line with real finding ids.

- [ ] GA-xxx Wire emitting instrumentation for every documented success metric
  - Files: src/lib/analytics.ts, docs/metrics.md
  - Acceptance: every metric in the product record has a named emit call; docs/metrics.md maps each metric to its event, dashboard, or query; leading and lagging indicators both emit
  - Verify: `grep -q "track(" src/lib/analytics.ts && grep -q "Source:" docs/metrics.md`
  - Checks: A-PRD-5, A-PRD-19
- [ ] GA-xxx Reconstruct the product definition from code reality
  - Files: docs/product.md
  - Acceptance: problem stated as "users today do X manually, which takes Y and costs Z" with zero solution-naming sentences; one primary user in five bullets with citation or flagged research gap; appetite as a duration bound to a cut rule
  - Verify: `grep -q "Workaround:" docs/product.md && ! grep -qE "Users need a tool|Our product" docs/product.md`
  - Checks: A-PRD-1, A-PRD-3, A-PRD-4
- [ ] GA-xxx Reconcile README promises with the shipped surface
  - Files: README.md
  - Acceptance: every advertised capability maps to a live route, command, or screen; unshipped claims move under a section titled Planned; stub-backed claims link their F-BUILD findings
  - Verify: `! grep -qiE "coming soon" README.md`
  - Checks: A-PRD-18, A-PRD-11
- [ ] GA-xxx Enforce documented tier caps in code
  - Files: src/billing/limits.ts, docs/pricing.md
  - Acceptance: every cap named in pricing copy has an enforcement branch; exceeding a cap returns a typed error the UI renders; a test covers each boundary value
  - Verify: `npm test -- tests/billing/limits.test.ts`
  - Checks: A-PRD-20
- [ ] GA-xxx Own every TBD and strip banned phrases from the product docs
  - Files: docs/product.md, docs/metrics.md
  - Acceptance: zero TBD or TODO without owner and due date; every open question carries owner, due date, blocking flag, and recommended default; banned marketing phrases removed
  - Verify: `! grep -riE "seamless|best-in-class|world-class|cutting-edge|game-chang|revolutionary|industry-leading|enterprise-grade" docs/product.md`
  - Checks: A-PRD-10, A-PRD-11
- [ ] GA-xxx Write the support runbook and rollback statement
  - Files: docs/runbook.md
  - Acceptance: five failure modes each with detection signal, user-facing symptom, and remediation steps; a one-paragraph rollback statement; retro date scheduled 30 days post-launch with metric baselines
  - Verify: `test "$(grep -c "^## Failure:" docs/runbook.md)" -eq 5 && grep -q "Rollback" docs/runbook.md`
  - Checks: A-PRD-17
- [ ] GA-xxx Turn Must-requirement criteria into failing acceptance skeletons
  - Files: tests/acceptance/
  - Acceptance: one spec file per Must requirement; each Given/When/Then criterion appears as a named pending test case
  - Verify: `test "$(ls tests/acceptance/*.spec.ts | wc -l)" -ge 1 && grep -rq "describe(" tests/acceptance/`
  - Checks: A-PRD-6

## Anti-patterns hunted

- The invisible product: a README pitch or problem statement that reads equally true for two named competitors. Hunt: run the substitution test on the pitch; a sentence that decides nothing is a finding, and the failing sentence is quoted in Evidence.
- Solution-first framing: `Users need a tool that` or `Our product` inside the problem record. Hunt: grep the product record; the Fix line prescribes the "do X manually, takes Y, costs Z" rewrite.
- Paper metrics: a polished `docs/metrics.md` with zero emitting call sites, the product domain's paper control. Hunt: cross-check every documented metric against the emit call-site inventory before crediting the doc.
- Vanity telemetry: the only events in code are signups and pageviews. Hunt: read emitted event names; no activation or outcome event at funded scale is a finding, not a style note.
- Promise theater: a README feature list running ahead of the code. Hunt: claims versus handlers; the stub evidence itself belongs to build, so cite the F-BUILD id and score only the broken promise here.
- Moving-target record: the PRD edited after approval with no changelog entry. Hunt: diff `git log --follow` on the product record against its changelog section.
- Fabricated personas: narrative demographic paragraphs with no research citation. Hunt: persona fiction in the target-user section; decorative demographics are Evidence, the missing citation is the finding.
- Vague findings, refused: every F-PRD block quotes a file:line or the exact failing sentence; "the PRD is weak" never ships.
- Double-billing, refused: stubs belong to build, plan drift to roadmap, landing copy to launch, security substance to security; this module cross-references per the ownership map instead of re-scoring.
- Severity inflation, refused: a missing prior-art dossier is Low, not High; calibration moves severity with scale, and the evidence bar never moves.
