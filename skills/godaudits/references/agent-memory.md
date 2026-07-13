# Agent memory audit module

Audits the agent memory a repository ships for AI coding agents: the `AGENTS.md` loader, the `agents/` pillar tree, and every tool-native instruction file, checked against the code they describe. Feeds findings `F-MEM-n` and a 0-100 domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads this module for every archetype: the pillar set varies, but loader discipline, floor pillars, and exclusion hygiene are universal. It carries the smallest weight in `intake.md` (2) because its blast radius is the next agent session, not the end user. Exclusion is rare: only a repo whose policy demonstrably forbids AI-agent contribution (stated in `CONTRIBUTING.md` or equivalent) may exclude it, with that reason recorded in the applicability matrix.

## Lineage

Descends from the Pillars standard (github.com/hannsxpeter/pillars, spec v1.0.1) and its three operational skills: pillars-init (archetype detection, loader drop, exclusion defaults), pillars-author (evidence-based drafting, no-fabrication rule), and, most directly, pillars-verify, whose method DNA this module preserves: evidence-driven claim walking (stack claims against manifests, path claims against the tree, convention claims against 3-5 sampled files with a 2-of-5 failure threshold), the drift / rule-violation / minor severity ladder (mapped here to Medium / Medium / Low), and the false-positive guards (read imprecise claims at their most natural interpretation, stubs claim nothing so they cannot drift, exclusions are intentional and not gaps). The godplans agent-memory module inverted pillars-verify into plan-time truth-by-construction; this module runs the verify pass forward again against real code, with A-MEM numbering aligned one to one to those R-MEM requirements. The ancestor's read-only, no-auto-fix discipline binds: findings quote evidence, remediation is a task, never an edit.

## Surface map

Inventory before any check runs. The intake fingerprint already locates the instruction surface ("Conventions already recorded: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `agents/` pillars") and the code-side facts claims are checked against (manifests, lockfiles, directory shape, entry points); cite the fingerprint, do not re-scan.

- Loader and tree: `AGENTS.md` at root, `agents/*.md`, `agents/**/*.md` sub-pillars. Declare present or absent; absence is a finding, not a skip.
- Tool-native files: `CLAUDE.md`, `.cursorrules`, `.cursor/rules/**`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `GEMINI.md`. Each found file is classified redirect, fork, or sole memory.
- Frontmatter fields per pillar: `pillar`, `status`, `always_load`, `covers`, `triggers`, `must_read_with`, `see_also`.
- Conditional sub-surfaces, each declared with a reason when absent: `.godplans/PLAN.mdx` (activates plan-aware R-id tagging), CI workflows that could run a validator (`.github/workflows/*.yml`), sub-pillar directories (`agents/data/`, `agents/integrations/`), and a validator script (`scripts/validate_pillars.py` or equivalent).
- Git signals for freshness: `git log --follow -1 --format=%cs agents/<file>.md` per pillar, compared with recent commits touching that pillar's domain.

## Checks

Checks A-MEM-1 through A-MEM-18 mirror R-MEM-1 through R-MEM-18 one to one. When the repo uses a non-Pillars memory convention, run A-MEM-19 first and re-scope the structural checks to their equivalents as it directs. In plan-aware mode, tag each finding with the matching R-MEM id.

1. A-MEM-1: The declared archetype matches the code. The project type stated in `agents/context.md` (or PLAN.mdx when plan-aware) must agree with at least two file signals pillars-init would detect.
   Look: `agents/context.md`, `AGENTS.md` `excluded:` block, manifests and directory shape from the fingerprint.
   Fail: declared archetype contradicted by two or more code signals (a "CLI tool" with `next` in `package.json` and an `app/` router). Medium.
2. A-MEM-2: `AGENTS.md` exists at root with exactly the four canonical elements: Pillars standard reference, 6-step loading protocol, 4-state missing-pillar table, structured `excluded:` block; and it enumerates no pillar names outside that block.
   Look: `AGENTS.md`; `grep -n 'excluded:' AGENTS.md`; compare section list against the canonical four.
   Fail: no loader at all on a repo where agents work: High. Missing element or pillar enumeration in the loader: Medium.
3. A-MEM-3: Every Tier 1 Core pillar (stack, arch, data, api, ui, auth, quality, deploy, observe) is present in `agents/`, stubbed, or listed in `excluded:`; none is silently absent.
   Look: `ls agents/` against the nine names; `excluded:` block for the rest.
   Fail: a Core pillar neither present, stubbed, nor excluded while its area has code (auth routes exist, no `auth.md` anywhere). Medium.
4. A-MEM-4: Exclusions use structured `{name, reason}` form with project-specific reasons that survive the substitution test.
   Look: the `excluded:` block in `AGENTS.md`.
   Fail: bare-list exclusions or generic reasons ("not needed", archetype boilerplate) on a funded product. Low.
5. A-MEM-5: Floor pillars `agents/context.md` and `agents/repo.md` exist at `status: present` with `always_load: true` and real content: glossary and invariants in context, layout and naming in repo.
   Look: both files' frontmatter and bodies; `grep -l 'always_load: true' agents/context.md agents/repo.md`.
   Fail: either floor pillar missing or stubbed on a repo claiming Pillars compliance (spec 5.1 says agents must pause, so every session degrades). High.
6. A-MEM-6: The pillar inventory covers the product's defining concern: `cli.md` for CLI tools, `ml.md` for pipelines, `payments.md` for e-commerce, `realtime.md` for collab apps; sub-pillars where the pattern warrants (`data/multi-tenant.md`, `integrations/<service>.md` past 3-5 integrations).
   Look: `agents/` tree against the archetype and the fingerprint's surfaces.
   Fail: the concern that defines the product has no pillar and no exclusion entry. Medium.
7. A-MEM-7: Every pillar's frontmatter is complete and valid: `pillar` equals filename, `covers` present, `triggers` present unless `always_load: true`, `must_read_with` capped at 3 with every reference resolving to an existing pillar or an excluded name.
   Look: frontmatter of all `agents/**/*.md`; resolve each `must_read_with` entry against the tree and the `excluded:` block.
   Fail: name/filename mismatch, missing `covers` or `triggers`, or a dangling `must_read_with` reference. Medium.
8. A-MEM-8: Pillar bodies carry the exact 8 sections in order (Scope, Context, Decisions, Rules, Workflows, Watchouts, Touchpoints, Gaps), unearned sections marked `(none)`, no custom sections, Touchpoints mirroring frontmatter in prose.
   Look: H2 headings of each present pillar body.
   Fail: reordered, missing, or invented sections in a present pillar. Low.
9. A-MEM-9: Decisions entries state rationale consistent with reality; the audit checks each against manifests and git history (pillars-verify 3e).
   Look: Decisions sections; the dependency the decision names must exist; "chose Postgres over SQLite for write throughput" while the lockfile ships `better-sqlite3` is drift.
   Fail: a Decision contradicted by the current tree or dependency set. Medium.
10. A-MEM-10: Rules pass earn-your-keep (state only constraints not inferable from code) and the code obeys them (pillars-verify 3f).
    Look: each Rule; grep the codebase for violations ("no raw SQL outside `db/raw.ts`" -> `grep -rn 'unsafe(' src/ --include='*.ts'` outside that file).
    Fail: code violating a declared Rule: Medium. A Rule restating an inferable fact ("we use Drizzle"): Low.
11. A-MEM-11: Context claims match the code: stack and version claims against manifests, file-location claims against the tree, convention claims against 3-5 sampled files (flag at 2 or more failures in 5).
    Look: every declarative Context claim in every present pillar, per the pillars-verify 3a-3d priority order.
    Fail: any drifted claim (declared `src/db/schema.ts`, actual `app/lib/db/schema.ts`; declared Drizzle, lockfile has Prisma). Medium; High when the drifted claim misleads on auth, data handling, or deploy targets.
12. A-MEM-12: Content sits in its owning pillar per the boundary tiebreakers: secrets guidance in `config.md` not `auth.md`, product analytics apart from system observe, layout in `repo.md` vs module shape in `arch.md`, CLI UX in `cli.md` not `ui.md`; cross-boundary references go through Touchpoints, not duplicated prose.
    Look: grep pillar bodies for the tiebreaker concerns; diff near-identical paragraphs across pillars.
    Fail: misplaced content or the same guidance duplicated in two pillars. Low.
13. A-MEM-13: The coupling graph is clean: no pillar exceeds 3 `must_read_with` entries, no shared dependency hides across 3 or more pillars unpromoted, `always_load: true` limited to the floor, sub-pillars declare `must_read_with: [parent]`.
    Look: all frontmatter; count `must_read_with` lengths and cross-pillar repeats; `grep -c 'always_load: true' agents/**/*.md`.
    Fail: any of the four smells above. Low.
14. A-MEM-14: No stale exclusions: every `excluded:` name still has zero code in its area.
    Look: each exclusion against the tree (`ui` excluded but `src/components/` holds 30 files; `observe` excluded but a `sentry` dependency landed).
    Fail: code present in an excluded area with no pillar authored. Medium.
15. A-MEM-15: Tool-native instruction files are one-line redirects to `AGENTS.md` and `./agents/`, never parallel instruction documents.
    Look: every file found under the tool-native globs in the surface map; count non-empty lines; diff any rules content against the pillar tree.
    Fail: a fork carrying its own rules alongside `AGENTS.md` (two memories drifting independently). Medium; Low when the fork's content is identical boilerplate.
16. A-MEM-16: Structural validation runs in CI: a validator (vendored `validate_pillars.py` or equivalent) checks frontmatter schema, heading order, floor pillars, and reference resolution, and fails the build on ERROR.
    Look: `scripts/validate_pillars.py`, `grep -rn 'validate_pillars' .github/workflows/`.
    Fail: pillar tree present but no CI job validates it. Low.
17. A-MEM-17: Maintenance is real, not aspirational: pillars update alongside the code they describe; Gaps entries answered by code are removed; Watchouts accumulate where incident evidence exists.
    Look: `git log --follow -1 --format=%cs` per pillar vs latest commits touching its domain paths; Gaps entries against the tree.
    Fail: a pillar untouched across a refactor that changed its domain, or a Gaps question the code has long since answered. Medium.
18. A-MEM-18: The memory system is operable end to end: an agent following the 6-step protocol computes a deterministic load set with no contradictions (no excluded name that also exists as a file, no invalid `status` enum, no stub carrying full prescriptive content, loader and pillars never disagree). Plan-aware: PLAN.mdx's Agent memory section states the protocol as binding.
    Look: cross-check `excluded:` names against `agents/` files; `status` values against the `present|stub` enum; stub bodies for content beyond Scope.
    Fail: any loader/tree contradiction that makes the protocol ambiguous. Medium.
19. A-MEM-19: (audit-only) Non-Pillars memory is graded on equivalents, not zeroed: a lone `CLAUDE.md`, `.cursor/rules/`, or copilot-instructions file is audited for accuracy against code (as A-MEM-11), size discipline, and single-source-of-truth (as A-MEM-15); record the convention in the audit and re-scope A-MEM-2 through A-MEM-8 to it.
    Look: the classified tool-native files from the surface map; line counts; claim spot-checks.
    Fail: a monolithic instruction file past roughly 300 lines mixing all domains with drifted claims and no routing. Medium.
20. A-MEM-20: (audit-only) No unsafe instruction content: memory must not direct agents to bypass verification or safety ("skip tests", "force-push to main", "auto-approve all commands", piping remote scripts to shell) and must not embed credentials (the secret itself is cross-referenced to `F-SEC` per the ownership map; the instruction placement is the MEM finding).
    Look: `grep -rniE 'force-push|--no-verify|skip (the )?tests|curl .*\| *(ba)?sh' AGENTS.md CLAUDE.md agents/ .cursor/ 2>/dev/null`.
    Fail: an instruction a compliant agent would follow into destructive or unreviewable action. High.

## Scoring

Weights derive from the godplans agent-memory self-audit rubric. Dimensions marked conditional re-normalize when their sub-surface is absent; on a non-Pillars convention, Loader, Floor, and Format score against the A-MEM-19 equivalents. A repo with no agent memory at all fails A-MEM-2, A-MEM-3, and A-MEM-5 outright; Truthfulness and Drift then re-normalize away rather than award free points for claiming nothing.

- Archetype and applicability (15): A-MEM-1, A-MEM-3, A-MEM-4, A-MEM-6.
- Loader and topology (15): A-MEM-2, A-MEM-15, A-MEM-18.
- Floor pillars (10): A-MEM-5.
- Format conformance (15, conditional): A-MEM-7, A-MEM-8, A-MEM-13.
- Truthfulness (15): A-MEM-9, A-MEM-10, A-MEM-20.
- Drift (15, conditional): A-MEM-11, A-MEM-12.
- Lifecycle and CI (15): A-MEM-14, A-MEM-16, A-MEM-17.

Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Seeds use the task grammar from `audit-format.md`; at audit time the agent adds the `Fixes:` line with real finding ids.

- [ ] GA-xxx Write the canonical AGENTS.md loader at repo root
  - Files: AGENTS.md
  - Acceptance: contains the Pillars standard reference, 6-step protocol, 4-state table, and structured `excluded:` block; enumerates no pillar names outside that block; total size stays constant as pillars are added
  - Verify: `grep -q 'excluded:' AGENTS.md && grep -qi 'always_load' AGENTS.md && test -d agents`
  - Checks: A-MEM-2, A-MEM-4

- [ ] GA-xxx Author missing floor pillars from the existing tree
  - Files: agents/context.md, agents/repo.md
  - Acceptance: both at `status: present` with `always_load: true`; context carries the domain glossary and invariants observed in code; repo carries the actual layout and naming conventions; all 8 headings in order
  - Verify: `grep -c 'always_load: true' agents/context.md agents/repo.md | grep -vq ':0'`
  - Checks: A-MEM-5, A-MEM-8

- [ ] GA-xxx Refresh drifted Context claims in the data pillar
  - Files: agents/data.md
  - Acceptance: every stack, path, and convention claim matches the current tree (ORM name matches the lockfile, schema path exists); resolved Gaps entries removed
  - Verify: `test -f "$(grep -oE 'src/[a-z/]+schema\.[a-z]+' agents/data.md | head -1)"`
  - Checks: A-MEM-11, A-MEM-17

- [ ] GA-xxx Reduce the CLAUDE.md fork to a redirect
  - Files: CLAUDE.md, agents/quality.md
  - Acceptance: unique rules from CLAUDE.md migrated into their owning pillars; CLAUDE.md body is a single redirect line to AGENTS.md and ./agents/; no rules content remains outside the pillar tree
  - Verify: `test "$(grep -vc '^$' CLAUDE.md)" -le 2 && grep -q 'AGENTS.md' CLAUDE.md`
  - Checks: A-MEM-15

- [ ] GA-xxx Remove the stale ui exclusion and author ui.md
  - Files: AGENTS.md, agents/ui.md
  - Acceptance: `ui` removed from `excluded:`; agents/ui.md authored at `status: present` with frontmatter and 8-section body describing the component conventions actually in `src/components/`
  - Verify: `! grep -q 'name: ui' AGENTS.md && grep -q 'pillar: ui' agents/ui.md`
  - Checks: A-MEM-14, A-MEM-3

- [ ] GA-xxx Wire the Pillars structural validator into CI
  - Files: scripts/validate_pillars.py, .github/workflows/ci.yml
  - Acceptance: validator vendored from the pillars repo; CI job runs it against agents/ on every push and fails on ERROR; floor-pillar and heading-order checks active
  - Verify: `python3 scripts/validate_pillars.py && grep -q 'validate_pillars' .github/workflows/ci.yml`
  - Checks: A-MEM-16

- [ ] GA-xxx Strip unsafe directives from agent memory
  - Files: AGENTS.md, agents/quality.md
  - Acceptance: no instruction directs agents to skip tests, force-push, auto-approve commands, or pipe remote scripts to shell; any embedded credential removed and rotated under the linked security task
  - Verify: `! grep -rniE 'force-push|--no-verify|skip (the )?tests' AGENTS.md agents/`
  - Checks: A-MEM-20

## Anti-patterns hunted

- Silent pillar absence: a Core pillar with live code in its area but no file, no stub, no exclusion entry. Hunt via the nine-name sweep in A-MEM-3; the finding names the code that proves the area exists.
- Loader bloat: `AGENTS.md` enumerating pillars or accumulating rules, growing with the project. Hunt via line count over time (`git log --oneline --stat AGENTS.md`) and content beyond the canonical four elements.
- Drifted memory: Context claims describing a stack, path, or convention the tree no longer has. Hunt via the 3a-3d claim walk; every drift finding quotes both the claim and the contradicting evidence.
- Fabricated rationale: Decisions praising a dependency that never shipped, or Watchouts invented to fill sections. Hunt via manifest and git-history cross-checks; unverifiable rationale is flagged Tentative, never asserted.
- Rules as rails: Rules restating inferable facts, padding the section while preventing nothing. Hunt via the earn-your-keep test per Rule; inferable Rules are Low findings, not filler tolerated.
- Parallel instruction forks: CLAUDE.md or .cursorrules carrying divergent rules beside AGENTS.md. Hunt via the tool-native glob sweep and content diff; two memories always drift apart.
- Stale exclusion: an `excluded:` entry whose area now holds code. Hunt via per-exclusion tree probes; the exclusion was true once, the audit dates when it stopped.
- Coupling smell: `must_read_with` past 3, hidden shared dependencies, a fat `always_load` set. Hunt via frontmatter aggregation; boundary problems are structural findings, not editorial notes.
- Imprecise-claim overreach (auditor discipline): flagging "we use Postgres" as drift because Redis also exists, or flagging a stub for claiming nothing. Refused: claims read at their most natural interpretation; stubs and exclusions are not drift.
- Double-billing (auditor discipline): a secret inside AGENTS.md scored here and in security, or style-rule content scored here and in style-genome. Refused: the secret is `F-SEC`, style content is `F-DNA`, test wiring is repo's, per the ownership map; this domain owns placement and structure only.
- Severity inflation (auditor discipline): memory findings dressed up as Critical. Refused: the blast radius is the next agent session; High is reserved for a missing loader, missing floor pillars, misleading auth/data claims, or unsafe directives, and Critical for none of the above absent a security cross-over owned elsewhere.
