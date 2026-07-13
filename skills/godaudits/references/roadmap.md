# Roadmap audit module

Audits whether the project's plan and roadmap artifacts tell the truth: capacity behind every date, dependencies sorted before work, gates that are binary, checkboxes that match the disk, and a launch that is scheduled rather than wished for. It runs the roadmap-ready and kickoff-ready disciplines forward against a live repo and its delivery history. Findings ship as F-ROAD-n blocks and a 0-100 roadmap score into `.godaudits/AUDIT.json` and its generated AUDIT.mdx view. The orchestrator loads this module whenever a plan, roadmap, or tracker artifact exists in or beside the repo; any archetype excludes it when no such artifact exists, in which case delivery reality reduces to a single check inside the repo domain and the applicability matrix records that specific reason. In plan-aware mode this module owns plan drift for the whole audit.

## Lineage

Descends from aihxp roadmap-ready (the ready-suite sequencer) with kickoff-ready (the suite's only meta-tier orchestrator) folded in, by way of the godplans roadmap module that inverted them into R-ROAD-1 through R-ROAD-20. From roadmap-ready the audit inherits the three-label row test (commitment, direction, or owned open question), the capacity corollary (no dates without engineer-week math), the precision gradient across horizons, the 8-field milestone anatomy with binary gates, topological sequencing over the dependency DAG, the gated launch sub-tree with its D-calendar, and the have-nots list, which becomes this module's severity convention: a have-not that disqualifies a roadmap at plan time is at least Medium when found live in a shipped repo. From kickoff-ready it inherits filesystem-as-truth completion, the seven-status ledger vocabulary, the rubber-stamp, ghost-handoff, and phantom-resume guards, and the critical-finding launch gate. Neither ancestor is one of the seven hannsxpeter auditors, but roadmap-ready's Mode B protocol (quote the failing item, name the dominant failure mode, prescribe the remediation) is this module's method DNA: run Mode B against every roadmap artifact the repo carries.

## Surface map

Inventory before any check runs; declare each conditional sub-surface present or absent with the reason recorded in the audit.

- Roadmap artifacts: `.godplans/PLAN.mdx` (plan-aware mode), `ROADMAP.md`, `docs/roadmap*.md`, `docs/milestones*.md`, `.roadmap-ready/ROADMAP.md`, `.roadmap-ready/HANDOFF.md`, `.kickoff-ready/PROGRESS.md`, and any tracker export checked into the repo.
- Delivery-reality surface: `git log` on the roadmap files themselves, tags and releases, `CHANGELOG.md`, `docs/retrospectives/`, `spikes/` with `Verdict:` lines.
- Launch surface: launch sections and D-calendars in the artifacts above, `docs/launch*`, `docs/runbooks/rollback.md`.
- Public surface: `docs/ROADMAP-PUBLIC.md` or an equivalent named derivative.
- Conditional declarations: the plan file (present activates plan-aware R-id tagging on every domain's findings), the launch block (absent with a stated reason drops A-ROAD-12 and A-ROAD-13), the public derivative (audience declared internal-only drops A-ROAD-19), and the capacity block (absent with zero calendar dates is legal; absent with dates is the A-ROAD-1 finding, not an exemption).

The intake fingerprint already carries contributor count, commit recency, tags, releases, and CI reality; cite it for every delivery-reality comparison instead of re-walking history.

## Checks

Severities are funded-product calibration; scale them per `intake.md`. A-ROAD-1 through A-ROAD-20 mirror R-ROAD-1 through R-ROAD-20 one to one; A-ROAD-21 through A-ROAD-23 are audit-only. In plan-aware mode each check also reads the matching PLAN.mdx section and tags the R-id.

1. A-ROAD-1 Verify every calendar date rests on capacity math: executor count, engineer-weeks per cycle, rotation share, and a serial-fraction estimate.
   Look: roadmap artifacts; grep `20[0-9]{2}-[0-9]{2}-[0-9]{2}` for dates and `engineer-weeks`, `capacity` for the block.
   Fail: dated commitments with no capacity block covering them: High. Appetites and bands only, no dates: pass.
2. A-ROAD-2 Verify a cadence model is declared by name as an ADR-shaped paragraph with two rejected alternatives and a re-evaluation trigger.
   Look: grep `Shape Up`, `quarterly`, `SAFe`, `PI`, `continuous`, `milestone-based` across roadmap artifacts.
   Fail: no named cadence anywhere: Medium. Cadence named without alternatives or trigger: Low.
3. A-ROAD-3 Verify every scheduled row passes the three-label test: grounded commitment, outcome-framed direction, or owned open question; bare feature names banned.
   Look: every row and task title in the roadmap artifacts.
   Fail: bare feature rows ("SSO", "dark mode") with no outcome, appetite, or label: Medium; quote the failing row in Evidence.
4. A-ROAD-4 Verify every phase and task anchors to an upstream artifact: a requirements id, a named architecture component, or a named external constraint.
   Look: Requirements lines and component references on tasks; external-constraint tags.
   Fail: anchor-less speculative items: Medium; a schedule where most rows have no anchor is a wishlist: High.
5. A-ROAD-5 Verify the precision ceiling matches upstream quality: full decomposition only where requirements and architecture are complete; thin upstream labeled directional.
   Look: `.prd-ready/`, `.architecture-ready/`, or the plan's product and architecture sections versus decomposition depth.
   Fail: a fully decomposed dated schedule atop absent or sketch-level upstream, unlabeled: Medium.
6. A-ROAD-6 Verify the task queue is topologically sorted and cycle-free: every Depends on line names an earlier task id or none.
   Look: walk all Depends on lines in queue order; detect forward references and cycles.
   Fail: a task scheduled before its dependency, or any cycle: High (the queue is unexecutable as written).
7. A-ROAD-7 Verify the riskiest unknowns come first: every flagged hypothesis has a validation task (spike, prototype, measurement) before work that assumes it.
   Look: hypotheses in the Decisions section; `spikes/` with `Verdict:` lines; wave placement of validation tasks.
   Fail: dependent work scheduled or shipped before the hypothesis validation: Medium.
8. A-ROAD-8 Verify parallelism stays within capacity: tracks per wave at or below executor count; `[P]` tasks have disjoint Files lists; an Amdahl note exists.
   Look: wave packing against the capacity block; intersect the Files lines of every `[P]` pair in a wave.
   Fail: `[P]` tasks sharing files or more tracks than executors: Medium. Missing Amdahl note on a multi-executor plan: Low.
9. A-ROAD-9 Verify a named prioritization framework fits items to appetites, and oversized items were shrunk or deferred, never carried at full scope.
   Look: grep `RICE`, `ICE`, `WSJF`, `MoSCoW`, `Kano`, `appetite` in roadmap artifacts; deferral records.
   Fail: no framework and items visibly carried past their appetite at full scope: Medium; framework absent but appetites honored: Low.
10. A-ROAD-10 Verify full phase anatomy: concrete name, binary Checkpoint gate, Must-haves block, anchored in-scope list, non-empty out-of-scope with reasons, rabbit holes, dependencies.
    Look: every phase block in the roadmap artifacts.
    Fail: a non-binary gate ("improve X") or an empty out-of-scope list: Medium per pattern, root phase quoted.
11. A-ROAD-11 Verify the precision gradient: current cycle fully decomposed; later horizons decay to themes then outcomes; no day-level dates beyond cycle one; no bare single-point dates.
    Look: date resolution per horizon; decomposition depth per horizon.
    Fail: day-level dates in later horizons or a bare single-point target date without band or appetite: Medium.
12. A-ROAD-12 Verify any launch block is complete: named mode, banded date, readiness gates each scheduled as dated tasks (observability-live, rollback-tested, runbooks-reviewed, support-briefed), a D-calendar with at least D-7, D-0, D+7, and a slip protocol.
    Look: launch sections; `docs/runbooks/rollback.md`; gate tasks in the queue.
    Fail: a launch date with any gate task missing: High (paper launch gate). Gate substance cross-references F-DEPLOY and F-OBS per the ownership map.
13. A-ROAD-13 Verify launch is gated on hardening: the first launch task depends on the security findings check, and any open Critical carries a dated, named, time-bounded risk acceptance.
    Look: Depends on lines of launch tasks; risk-acceptance entries; this audit's own F-SEC blocks on re-audit.
    Fail: launch scheduled or shipped past an open Critical with no complete risk acceptance: High. The finding substance stays with F-SEC.
14. A-ROAD-14 Verify the task list works as the downstream handoff: each build task carries owner or lane, appetite, anchors, Depends on, and phase; deploy cadence and rollback posture stated; Must-haves name KPIs.
    Look: task field completeness across the queue; the deploy phase statement.
    Fail: tasks an executor cannot start without questions (missing Files, Acceptance, or Verify lines): Medium.
15. A-ROAD-15 Verify completion is artifact verification: every checked task's named artifacts exist non-empty on disk, every Verify line is an exact command, and the final phase is Verification.
    Look: `test -s` every artifact named by a `[x]` task's Must-haves and Files lines; read Verify lines for command shape.
    Fail: a checked task whose named artifact is missing or empty: High (rubber-stamp done). Prose Verify lines that no shell can run: Medium.
16. A-ROAD-16 Verify upstream prerequisite guards: no phase started before its upstream artifacts existed, and upstream edits after downstream check-offs carry reconciliation notes.
    Look: `git log` dates on upstream artifacts versus the commits that flipped downstream boxes.
    Fail: upstream artifact modified after dependent tasks were checked, no reconciliation note: Medium.
17. A-ROAD-17 Verify the ledger is complete: every domain or sibling appears as done, skipped (with reason), imported (with source), or failed (with note); failed Verify keeps the box unchecked with a dated note.
    Look: the seven-status vocabulary in `.kickoff-ready/PROGRESS.md` or the plan's ledger; notes under unchecked tasks.
    Fail: work absent from the ledger entirely (silence as status), or a checked box above a failure note: Medium.
18. A-ROAD-18 Verify governance is written down: review cadence, authority map per horizon, re-plan triggers, freeze conditions, archive rule, and per-session `updated:` bumps.
    Look: governance section; frontmatter `updated:` stamps against session log entries.
    Fail: no review cadence or authority map on a multi-contributor repo: Medium; stale `updated:` stamp alone: Low (observed drift is A-ROAD-22).
19. A-ROAD-19 Verify the audience declaration and, if mixed, a redacted public derivative: no capacity math, no owner names, no rabbit-hole specifics, "won't" phrased as "Not planned".
    Look: `docs/ROADMAP-PUBLIC.md`; grep it for `engineer-weeks`, owner names from git, rabbit-hole text copied from the internal file.
    Fail: a public derivative leaking capacity math or owners, or the internal file designated public: High. Mixed audience with no derivative: Medium.
20. A-ROAD-20 Verify sign-off and retrospectives are scheduled work: attestation tasks before commitments hardened, and a retro artifact per completed cycle.
    Look: sign-off tasks in the queue; `docs/retrospectives/` against completed phases.
    Fail: hardened commitments with no attestation record on a multi-contributor repo, or a completed cycle with no retro: Low.
21. A-ROAD-21 Verify the plan matches the code (audit-only; this is the plan-drift check the ownership map assigns here): decisions the code contradicts, checked feature tasks with no code trace, requirements with no trace in source, bulk check-off commits.
    Look: plan decisions versus the intake fingerprint; `git log -p` on the plan file for many boxes flipped in one commit with no matching work commits.
    Fail: a plan decision the code contradicts or a checked feature with no code path: High. Bulk check-offs in a single commit: Medium.
22. A-ROAD-22 Verify freshness against delivery (audit-only): the roadmap moved while the repo moved.
    Look: `git log -1 --format=%ci` on each roadmap artifact versus commit volume since.
    Fail: a cadence cycle of commits (or 50 or more commits) since the roadmap was last touched: Medium (shelf roadmap, observed).
23. A-ROAD-23 Verify one source of truth (audit-only): multiple roadmap artifacts agree on what is done and what is next, or a canonical pointer names the live one.
    Look: cross-compare status and sequence across `ROADMAP.md`, PLAN.mdx, PROGRESS.md, and tracker exports.
    Fail: two artifacts disagreeing on status or sequence with no canonical pointer: Medium.

## Scoring

Weights derive from the godplans roadmap self-audit rubric, collapsed into auditable dimensions. Sum is 100; re-normalize when a conditional dimension's sub-surface is declared absent in the Surface map.

- Grounding and classification (A-ROAD-3, A-ROAD-4): 15.
- Capacity and cadence honesty (A-ROAD-1, A-ROAD-2, A-ROAD-9): 15.
- Sequencing correctness (A-ROAD-6, A-ROAD-7, A-ROAD-8): 20.
- Phase anatomy and gates (A-ROAD-10, A-ROAD-16): 15.
- Precision gradient and ceiling (A-ROAD-5, A-ROAD-11): 10.
- Launch and hardening gates (A-ROAD-12, A-ROAD-13): 10. Conditional: launch excluded with a stated reason drops both checks and re-normalizes.
- Executor handoff and delivery truth (A-ROAD-14, A-ROAD-15, A-ROAD-21): 10.
- Governance, ledger, and freshness (A-ROAD-17, A-ROAD-18, A-ROAD-19, A-ROAD-20, A-ROAD-22, A-ROAD-23): 5. Conditional: internal-only audience drops A-ROAD-19.

Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Representative tasks in the audit-format grammar; at audit time the agent assigns real GA ids and adds the Fixes: line with real finding ids.

- [ ] GA-xxx Rebuild the capacity block and strip uncovered dates
  - Files: docs/ROADMAP.md
  - Acceptance: capacity block states executor count, engineer-weeks per cycle, rotation share, and serial fraction; every remaining calendar date is covered by the math or replaced with an appetite or confidence band
  - Verify: `grep -q "engineer-weeks" docs/ROADMAP.md` plus the manual path: every remaining calendar date traces to the capacity block math
  - Checks: A-ROAD-1, A-ROAD-11
- [ ] GA-xxx Break the dependency cycle and re-sort the task queue
  - Files: docs/ROADMAP.md, scripts/check-roadmap-dag.py
  - Acceptance: every Depends on line names an earlier task id or none; the checker script walks the queue and exits nonzero on any forward reference or cycle; the cycle member is split into two tasks
  - Verify: `python3 scripts/check-roadmap-dag.py docs/ROADMAP.md`
  - Checks: A-ROAD-6
- [ ] GA-xxx Reconcile checked tasks against artifacts on disk
  - Files: .godplans/PLAN.mdx
  - Acceptance: every `[x]` task's named artifacts exist non-empty; boxes whose artifacts are missing are unchecked with a dated note; frontmatter counters recounted in the same edit
  - Verify: `test "$(grep -c '^- \[x\] GP-' .godplans/PLAN.mdx)" -eq "$(grep -m1 'tasks_done:' .godplans/PLAN.mdx | grep -oE '[0-9]+')"`
  - Checks: A-ROAD-15, A-ROAD-21
- [ ] GA-xxx Schedule launch readiness gates or pull the launch date
  - Files: docs/ROADMAP.md, docs/runbooks/rollback.md
  - Acceptance: observability-live, rollback-tested, runbooks-reviewed, and support-briefed each exist as dated tasks before D-0; the D-calendar carries D-7, D-0, and D+7; or the launch date is removed with the removal noted
  - Verify: `grep -q "rollback-tested" docs/ROADMAP.md && grep -q "D-7" docs/ROADMAP.md`
  - Checks: A-ROAD-12, A-ROAD-13
- [ ] GA-xxx Rewrite bare feature rows under the three-label test
  - Files: docs/ROADMAP.md
  - Acceptance: every scheduled row is labeled commitment, direction, or question; each carries a requirement, component, or external anchor; rows fitting no label are deleted or routed to open questions with an owner
  - Verify: `grep -cE '\[(commitment|direction|question)\]' docs/ROADMAP.md` plus the manual path: the count equals the number of scheduled rows and no scheduled row lacks a label
  - Checks: A-ROAD-3, A-ROAD-4
- [ ] GA-xxx Write the governance block and refresh the stamps
  - Files: docs/ROADMAP.md
  - Acceptance: review cadence, authority map per horizon, re-plan triggers, freeze conditions, and archive rule all present; the `updated:` stamp reflects the current session
  - Verify: `grep -q "Review cadence:" docs/ROADMAP.md && grep -qE "updated: 20[0-9]{2}" docs/ROADMAP.md`
  - Checks: A-ROAD-18, A-ROAD-22
- [ ] GA-xxx Redact the public roadmap derivative
  - Files: docs/ROADMAP-PUBLIC.md
  - Acceptance: no capacity math, owner names, or rabbit-hole specifics survive; "won't" is phrased as "Not planned"; the internal file is neither referenced nor linked
  - Verify: `test -s docs/ROADMAP-PUBLIC.md && ! grep -qiE "engineer-weeks|owner:" docs/ROADMAP-PUBLIC.md`
  - Checks: A-ROAD-19

## Anti-patterns hunted

- Fictional precision: day-level dates deep in later horizons with no capacity block anywhere. Hunt: grep the dates, demand the covering math; quote the date and the absent block in Evidence.
- Fictional parallelism: more tracks in a wave than executors, or `[P]` tasks sharing files. Hunt: intersect Files lists pairwise; count tracks against the capacity block.
- Quarter-stuffing: every horizon filled to identical density and precision. Hunt: compare decomposition depth across horizons; uniform depth is the finding.
- Feature-factory rows: bare feature names as schedule entries. Hunt: run the three-label test row by row; the failing row is quoted, never paraphrased.
- Paper launch gate: a launch date with no observability-live, rollback-tested, or runbooks-reviewed tasks behind it. Hunt: resolve every launch date to its gate tasks; gate substance cross-references F-DEPLOY and F-OBS per the ownership map.
- Rubber-stamp done: checked boxes whose named artifacts are missing, or dozens of boxes flipped in one commit. Hunt: `git log -p` on the plan file against the work commits between flips.
- Ghost handoff: a phase started before its upstream artifacts existed. Hunt: compare the first task commit of each phase against upstream artifact history.
- Shelf roadmap: the repo moves for weeks while the roadmap does not. Hunt: last-touch date on roadmap artifacts versus commit volume since, from the intake fingerprint.
- Perpetual-now: everything decomposed into the current phase with nothing beyond, or an all-Later plan with no executable first wave. Hunt: horizon distribution of tasks.
- Vague findings, refused: every F-ROAD block quotes the failing row, date, checkbox, or Depends on line with file:line; "the roadmap is stale" never ships.
- Double-billing, refused: stub code belongs to build, rollback mechanics to deploy, dashboards to observe, security substance to security; this module scores only scheduling, gating, and drift, and cross-references the rest.
- Severity inflation, refused: a missing retrospective is Low, not High; calibration moves severity with scale, and the evidence bar never moves.
