# Style genome (code DNA) audit module

Audits whether the codebase speaks with one recognizable coding voice (naming, comments, structure, control flow, error posture, idioms) and whether that voice is written down, enforced, and loaded by agents. Feeds findings `F-DNA-n` and a 0-100 domain score into AUDIT.mdx. The orchestrator loads it for every repository, in the domain-pass order after seo and before agent-memory, because the agent-memory pass verifies quality-pillar wiring that depends on the genome checked here. No archetype excludes this domain (intake hard rule: style-genome is never excluded); it scales down instead. At weekend calibration the pass collapses to the enforced layer plus the worst drift, and the applicability matrix records the calibration, not an exclusion.

## Lineage

Descends from codedna (aihxp/codedna) through the godplans style-genome module. codedna's three modes map onto audit time directly: Map becomes the fingerprint this pass builds before judging, Check becomes the finding method (quote the snippet, name the deviation, rate it, give a concrete rewrite in house style), and Match becomes the remediation standard. The disciplines carried intact: layered evidence ordered cheapest and most authoritative first (tooling configs as enforced ground truth, then measured frequencies, then close-read voice); the enforced-vs-observed split; the 15-item AI-tells catalog run as a sweep instead of a self-check; the specificity gate; the local-dialect-wins rule; and the false-tell refusal, because flagging code that matches the house style is as much a defect as missing a tell. Severity stays humble by inheritance: codedna rates tells high or low, so this domain tops out at High for a missing enforced layer or a live style fork, and Critical findings are effectively absent here.

## Surface map

Inventory before any check runs; cite the intake fingerprint for stack, manifests, recorded conventions (`AGENTS.md`, `CLAUDE.md`, lint and format configs), contributor count, and commit recency instead of re-scanning.

- Enforced layer: `.editorconfig`, `.prettierrc*`, `biome.json`, `eslint.config.*`, `tsconfig.json`, `pyproject.toml` (`[tool.ruff]`, `[tool.black]`), `rustfmt.toml`, `.golangci.yml`, `.rubocop.yml`, `.clang-format`, `.swiftlint.yml`; command sites in `package.json` scripts, `Makefile`, `.pre-commit-config.yaml`, CI workflows.
- Profile artifacts: `CODEDNA.md`, `STYLE.md`, `docs/style*`, style sections of `CONTRIBUTING.md`.
- Agent wiring: `agents/quality.md`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`.
- Source sample: entry points, two or three core modules per language, a few tests, plus the five newest and five oldest source files by `git log --diff-filter=A` for fork detection. Skip vendored and generated paths (`node_modules`, `dist`, `build`, `vendor`, lockfiles, migrations, generated clients).
- Measured frequencies over the sample: casing histograms per identifier kind, comment density per file, function length distribution, suppression counts.
- Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: statically typed stack (gates A-DNA-8), a recurring unit for the archetype (gates A-DNA-13), a profile artifact (its absence is itself a finding under A-DNA-14, not an exclusion), and in plan-aware mode the plan's style genome section.

## Checks

Default severities are funded-product calibration; scale per intake. Where a concern belongs to another domain, file nothing here and cross-reference per the ownership map.

1. A-DNA-1 Enforced layer real. Formatter and linter configs exist, their exact commands are wired into scripts or CI, and no prose doc restates what they settle.
   Look: the enforced-layer globs above; `package.json` scripts, `Makefile`, `.pre-commit-config.yaml`, `.github/workflows/*` for the commands.
   Fail: no formatter config in a multi-contributor repo: High. Configs present but nothing runs them in scripts or CI: Medium. A style doc restating indentation, quotes, or semicolons a named formatter rewrites: Low.
2. A-DNA-2 Casing per identifier kind. One casing per kind (functions, methods, types, constants, variables, files, CSS classes) at majority frequency per language.
   Look: casing histograms over the source sample; `git ls-files` for file naming.
   Fail: two casings above roughly 20 percent each for the same kind in one language with no known-inconsistencies entry: Medium.
3. A-DNA-3 Word-choice genome. One verb per semantic, boolean prefixes (`is`/`has`/`should`), plural collections, one private-member marker, one handler convention, a bounded abbreviation set.
   Look: grep function names prefixed `get|fetch|load` against their bodies (sync access vs network); `onClick` vs `handleClick` sites; boolean declarations.
   Fail: two verbs serving one semantic (`fetchUser` and `loadUser` both hitting the network): Medium. Mixed handler conventions in one component tree: Low.
4. A-DNA-4 Comment contract. Density and register uniform across the sample; comments say why, not what.
   Look: comment-density per file; grep narration patterns (`// increment`, `# loop over`), first-person-plural prose, capitalized sentences in a terse lowercase repo.
   Fail: files at 3x the sample median density or clusters of narration comments: Medium. Register mismatch against neighbors: Low.
5. A-DNA-5 Structural genome. Function size and extraction threshold consistent with the repo's own norm.
   Look: function length distribution; one-line helpers in an inline-heavy repo; giant functions in an extraction-happy one; where helpers live.
   Fail: outlier files at 4x the median function length with no local reason: Medium. Parallel helper layers all alive (`utils/`, `helpers/`, `lib/`): Low.
6. A-DNA-6 Control-flow posture. One habit per fork: early returns vs nesting, ternary tolerance, loops vs higher-order functions, `switch` vs lookup maps, async style.
   Look: grep `.then(` in an `async/await` repo; nesting depth beyond three in guard-clause code; `switch` sites next to lookup maps.
   Fail: mixed async styles inside one layer: Medium. Deep nesting where the repo elsewhere returns early: Low.
7. A-DNA-7 Error posture consistency. One error strategy project-wide (throw typed, Result, error-return), validation at trust boundaries only.
   Look: grep `throw new`, `Result`, `try {` per layer; boundary validators vs internal re-validation of already-validated data.
   Fail: two strategies in one layer (routes throwing typed errors next to routes returning `{ error }` objects): High. Pervasive internal re-validation: Medium. Correctness defects (swallowed errors, missing handling) belong to code-quality per the ownership map: cross-reference, do not re-file.
8. A-DNA-8 Types conventions (conditional: typed stacks only). Return-type posture, `interface` vs `type`, `any` tolerance, non-null assertions, enums vs union literals, nullability, each at one dominant choice.
   Look: `tsconfig.json` strictness; grep `: any`, `as unknown as`, `enum `, non-null `!` sites.
   Fail: `any` or non-null assertions clustering beyond isolated sites in a strict-mode repo: Medium. Untyped stack: record the dimension excluded with the stack as reason.
9. A-DNA-9 Import conventions. Default vs named exports, alias vs relative paths, barrel policy: each either enforced by a named linter rule or consistent as observed, never contradicted.
   Look: eslint or ruff import rules; grep `export default`, `../../../` chains, `index.ts` barrels.
   Fail: a linter-enforced rule the code contradicts under suppressions: Medium. Alias and deep-relative paths mixed in one tree: Low.
10. A-DNA-10 Test conventions. One location and naming scheme, one structure, one case-naming style.
    Look: `**/*.test.*`, `**/*_test.go`, `tests/` trees; `describe(` vs flat functions; case-name phrasing.
    Fail: co-located files and a `tests/` tree in the same package: Medium. Mixed case-naming styles: Low. Test existence and CI wiring belong to repo, test quality to code-quality: cross-reference.
11. A-DNA-11 Idiom registry lived. Each canonical helper exists exactly once; no parallel utility overlaps its purpose.
    Look: grep duplicate helper names and purposes: two date formatters, `cn(` next to `classNames(`, two assert helpers.
    Fail: two utilities with overlapping purpose both imported by live code: Medium.
12. A-DNA-12 Domain glossary. One canonical noun per entity across code, columns, routes, and UI copy; one verb per action.
    Look: grep entity synonym sets (`user|account|member`) across models, API paths, and components; compare with schema entity names.
    Fail: one entity under two names across layers: Medium.
13. A-DNA-13 Reference shapes (conditional: archetypes with a recurring unit). Instances of the recurring unit (component, handler, endpoint, CLI subcommand) are structurally interchangeable.
    Look: diff the shape of two or three instances: export style, in-file ordering, wiring, naming of the standard parts.
    Fail: instances structurally divergent with no local reason, so two agents writing two more would produce different files: Medium.
14. A-DNA-14 Profile artifact. `CODEDNA.md` (or an equivalent style profile) exists: TL;DR near 10 rules, every rule tagged enforced or observed, version and date stamp, real 2-4 line snippets.
    Look: `CODEDNA.md`, `STYLE.md`, `docs/style*`.
    Fail: absent at funded-product scale: Medium. Present without the enforced/observed split or the stamp: Low.
15. A-DNA-15 Specificity gate. No profile rule survives verbatim substitution into another repo.
    Look: read the profile line by line; in plan-aware mode also gate the plan's genome section.
    Fail: generic lines ("uses descriptive names" and relatives): Low, one finding clustering all sites.
16. A-DNA-16 Agent wiring. The genome pointer lives in an idempotent `codedna:start` / `codedna:end` block inside `agents/quality.md` (or the repo's quality pillar), instructing an AI-tells self-check; `AGENTS.md` and `CLAUDE.md` carry no genome prose.
    Look: `grep -ri codedna agents/ AGENTS.md CLAUDE.md .cursor/rules/`.
    Fail: profile present but no agent file points at it: Medium. Genome prose pasted into `AGENTS.md` or `CLAUDE.md`: Low; structural defects in those files belong to agent-memory (F-MEM).
17. A-DNA-17 Anti-tells appendix. The profile names where this project deviates from AI defaults, and each listed deviation is real in the code.
    Look: the profile's AI-tells section against the sampled source.
    Fail: appendix missing when a profile exists: Low. A listed deviation the code does not exhibit (a false tell that would flag conforming code): Low.
18. A-DNA-18 Enforcement loop. A diff check against the profile runs somewhere real: pre-commit hook, CI step, or a documented review instruction with severity ratings.
    Look: `.husky/pre-commit`, `.pre-commit-config.yaml`, CI workflows, `CONTRIBUTING.md`.
    Fail: a profile with no enforcement site anywhere: Medium (paper genome).
19. A-DNA-19 Freshness. The profile stamp postdates the last style-shifting change; refresh triggers named; a known-inconsistencies ledger records real exceptions with the local-dialect-wins rule.
    Look: profile stamp vs `git log` dates on lint configs and framework manifests.
    Fail: stamp predates a new linter or a framework migration: Medium. No ledger while the code carries characteristic exceptions: Low.
20. A-DNA-20 Evidence-derived profile. The profile describes the code, not taste: spot-verify three observed rules against measured frequencies.
    Look: pick three observed rules; measure their frequency in the sample. When frequencies and profile disagree, the code is the truth.
    Fail: a profile rule the code contradicts at majority frequency: Medium (invented genome).
21. A-DNA-21 AI-tells sweep (audit-only). Hunt catalog tells in the code itself: over-commenting, narrating the obvious, section banners, explainer voice, restated prompts, decorative unicode.
    Look: grep banner runs (`====`, `----` inside comments), `Now we`, emoji bytes via `LC_ALL=C grep -nP '[^\x00-\x7F]'`; close-read the newest files.
    Fail: a file or module clustering three or more catalog tells: Medium, one finding per cluster with sites in Evidence. Stub handlers go to build, dead code to code-quality: cross-reference.
22. A-DNA-22 Style-fork detection (audit-only). The newest code speaks the same dialect as the oldest.
    Look: compare conventions between the five newest and five oldest source files by `git log --diff-filter=A`; check whether the profile was refreshed across the boundary.
    Fail: a dated fork where the new era systematically deviates and the profile never moved: Medium.
23. A-DNA-23 Suppression density (audit-only). The enforced layer is not neutered from inside.
    Look: `grep -rc 'eslint-disable\|# noqa\|# type: ignore\|@ts-ignore\|@ts-expect-error\|//nolint'` plus `#[allow(` in Rust; note blanket file-top disables.
    Fail: blanket disables clustering at file tops, or density above one suppression per 200 source lines: Medium. Suppressions without the reason comment the lint config demands: Low.

## Scoring

Weights derive from the godplans self-audit rubric, redistributed to audit-time dimensions. Sum is 100 over present dimensions; conditional dimensions re-normalize when their sub-surface is absent.

- Enforced layer real (12): A-DNA-1, A-DNA-23.
- Naming genome (15): A-DNA-2, A-DNA-3.
- Comment voice (8): A-DNA-4.
- Structural genome (10): A-DNA-5, A-DNA-13 (when the archetype has no recurring unit, score on A-DNA-5 alone).
- Control flow and error posture (12): A-DNA-6, A-DNA-7.
- Types, imports, tests (10): A-DNA-8, A-DNA-9, A-DNA-10 (conditional: untyped stack drops A-DNA-8 and the dimension scores on the remaining two).
- Idioms and glossary (10): A-DNA-11, A-DNA-12.
- Profile artifact (10): A-DNA-14, A-DNA-15, A-DNA-20.
- Anti-tells and voice drift (8): A-DNA-17, A-DNA-21, A-DNA-22.
- Enforcement, wiring, freshness (5): A-DNA-16, A-DNA-18, A-DNA-19.

Calibration moves severity, never evidence: a weekend repo with no CODEDNA.md loses little here if its enforced layer runs and its voice is consistent; a funded product with a paper genome does not. Any open Critical finding caps this domain at 69.

## Remediation seeds

Seeds use the task grammar from `audit-format.md`; at audit time the agent adds the `Fixes:` line with real finding ids and replaces representative paths with the cited ones.

- [ ] GA-xxx Commit and wire the enforced style layer
  - Files: .editorconfig, .prettierrc or biome.json or pyproject.toml, eslint.config.js, package.json, .github/workflows/ci.yml
  - Acceptance: formatter and linter configs exist at repo root; format and lint commands defined in scripts or Makefile; CI runs the lint command on every push
  - Verify: `npx prettier --check . && npx eslint .`
  - Checks: A-DNA-1
- [ ] GA-xxx Fingerprint the codebase into CODEDNA.md
  - Files: CODEDNA.md
  - Acceptance: TL;DR of about 10 rules; every rule tagged enforced or observed with a version and date stamp; each observed rule paired with a real 2-4 line snippet; known-inconsistencies section records real exceptions
  - Verify: `grep -q 'Known inconsistencies' CODEDNA.md && grep -qE '(enforced|observed)' CODEDNA.md`
  - Checks: A-DNA-14, A-DNA-15, A-DNA-20
- [ ] GA-xxx Unify the error posture in the divergent layer
  - Files: src/api/
  - Acceptance: every handler in the layer uses the one strategy the profile names; no handler returns an ad hoc error object where siblings throw typed errors; CODEDNA.md error-posture line updated to match
  - Verify: `! grep -rn 'return { error' src/api/`
  - Checks: A-DNA-7
- [ ] GA-xxx Merge parallel utilities and fix glossary drift
  - Files: src/lib/format.ts, src/lib/cn.ts, CODEDNA.md
  - Acceptance: one utility per purpose with all imports migrated; glossary lists each canonical term with its banned synonyms; banned synonyms absent from identifiers in the touched paths
  - Verify: `! grep -rl 'formatDate2\|classNames(' src/`
  - Checks: A-DNA-11, A-DNA-12
- [ ] GA-xxx Point agents at the genome via the quality pillar
  - Files: agents/quality.md, AGENTS.md, CLAUDE.md
  - Acceptance: idempotent `codedna:start` / `codedna:end` block in agents/quality.md points at CODEDNA.md and instructs the AI-tells self-check; AGENTS.md and CLAUDE.md carry no genome prose
  - Verify: `grep -q 'codedna:start' agents/quality.md && ! grep -qi 'codedna' AGENTS.md`
  - Checks: A-DNA-16
- [ ] GA-xxx Strip AI tells from flagged modules
  - Files: src/ modules cited by the tells-cluster findings
  - Acceptance: narration comments deleted or replaced by better names; banners and decorative dividers removed; comment density within 2x the sample median; register matches neighboring files
  - Verify: `! grep -rnE '^ *(//|#) (increment|loop over|now we)' src/`
  - Checks: A-DNA-21, A-DNA-4
- [ ] GA-xxx Wire the diff-check enforcement loop
  - Files: .husky/pre-commit or .pre-commit-config.yaml, CONTRIBUTING.md, CODEDNA.md
  - Acceptance: pre-commit runs the format check and the CODEDNA diff-check instruction; CONTRIBUTING.md documents review-time tell ratings; CODEDNA.md names its refresh triggers
  - Verify: `grep -q 'CODEDNA' .husky/pre-commit CONTRIBUTING.md`
  - Checks: A-DNA-18, A-DNA-19

## Anti-patterns hunted

- Paper genome: a style profile nothing loads and nothing checks. In code: `CODEDNA.md` present, no hook or CI step names it, no agent file points at it, sampled code contradicts it. Hunt: every profile claim needs an enforcement site or a majority frequency; neither means a Medium finding, never a strength.
- Formatter parroting: prose docs restating what Prettier, Black, or gofmt already rewrite. Hunt: diff the doc against the configs; the finding targets the doc, never the code that passes the formatter.
- Generic genome: profile lines that read identically for any repo. Hunt: quote the line, apply the substitution test, demand a project-specific value in the rewrite.
- Style fork: the new era of files speaks a second dialect. In code: post-date files with different casing, error posture, or comment voice than the founders. Hunt: era comparison via `git log --diff-filter=A`; a dated fork with no profile refresh is the finding.
- Suppression theater: an enforced layer neutered by blanket `eslint-disable`, `# noqa`, or `#[allow(...)]` at file tops. Hunt: suppression density and file-top clusters; the config is not the evidence, the escape hatches are.
- AI voice drift: tell clusters (over-commenting, narration, banners, explainer voice, restated prompts) concentrated in some files. Hunt with the 15-item catalog, rate high or low per the ancestor's Check mode, one clustered finding per module.
- Parallel-utility sprawl and vocabulary drift: a second `formatDate`, `user` and `account` interchangeable. Hunt: grep helper names and glossary nouns across layers; both imported means both live.
- Uniform-consistency flattening (auditor discipline): filing findings against a repo's own documented local dialect or known-inconsistencies ledger. Refusal: characteristic exceptions are part of the fingerprint, not defects; local file dialect wins over the global profile.
- Vague finding (auditor discipline): "naming could be better" and relatives. Refusal: every F-DNA quotes an identifier or snippet at file:line and gives a concrete rewrite in house style, or it does not ship.
- Double-billing (auditor discipline): the same root cause billed here and elsewhere. Refusal: error-handling correctness goes to code-quality, stub handlers to build, `AGENTS.md` structure to agent-memory (F-MEM), secrets to security (F-SEC); this domain files only the consistency finding and cross-references per the ownership map.
- Severity inflation (auditor discipline): a style drift dressed as an emergency. Refusal: this domain tops out at High; a mixed verb dialect is Medium at worst, and a Critical here demands evidence no style finding normally has.
