# Repository audit module

Audits whether the repository itself is real: files that serve a purpose, CI that runs the actual pipeline, docs a stranger can act on, tooling that matches the stack, and an agent-safety layer for the agents that will execute against it. It runs the repo-ready disciplines forward against the tree on disk instead of against a plan, and feeds findings `F-REPO-n` and a 0-100 domain score (weight 5 per `intake.md`) into AUDIT.mdx. The orchestrator loads this module for every archetype: repo is never excluded per the intake hard rules; it scales down with the calibration instead, and the applicability matrix records the scale, not an exclusion. In plan-aware mode every check also cites its `R-REPO-n` twin from `.godplans/PLAN.mdx`.

## Lineage

Descends from repo-ready (ready-suite, building tier) through the godplans repo module. repo-ready exists to kill one failure mode: repositories that look set up but are not (README with only a title, `{{author}}` in LICENSE, `security@example.com`, CI running `echo`), and its disciplines carry into audit time intact: the no-placeholder rule becomes a grep pass over committed docs; the relevant-files-not-maximum-files rule (project type x stage x audience) becomes tier reconstruction from repo signals; the have-nots list converts directly into hunting targets; the AGENT-01/02/03 agent-safety checks become A-REPO-15; and the 42-point Mode C scorecard (Essentials 7, Community 7, Quality 7, Security 6, DX 6, Release 6, Agent-Safety 3) is the direct ancestor of this module's scoring table. The proportionality guard carries over too: a weekend repo is scored against tier 1, not against enterprise ceremony.

## Surface map

Inventory before any check runs: root docs (`README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, `SUPPORT.md`, `GOVERNANCE.md`); platform config (`.github/workflows/*.yml`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`, `.gitlab/`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`); quality tooling (`.editorconfig`, `.gitattributes`, linter and formatter configs, `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`); release machinery (`release-please-config.json`, `.releaserc*`, `.changeset/`, `git tag -l 'v*'`); agent-safety files (`.claude/settings.json`, `.githooks/`, `.gitleaks.toml`); git reality (`git ls-files`, `git log --oneline -30`). The intake fingerprint already records stack and versions, test and CI reality, convention files, and `git shortlog -sn` contributor count: cite it, do not re-scan. Declare three conditional sub-surfaces present or absent, with the reason recorded: a second language (activates A-REPO-5), a release surface (published package or tagged deployable; absent at tier 1 with a stated stop drops the release dimension), and a roadmap artifact (absent activates the delivery-reality check A-REPO-23 here, per `intake.md`).

## Checks

Mirrors `R-REPO-1` through `R-REPO-20` one to one; `A-REPO-21` onward are audit-only. Severities are funded-product calibration; scale per `intake.md`.

1. **A-REPO-1 Tier coherence.** Reconstruct the type x stage x audience triple from signals and check the file inventory sits in its band (MVP 5-8 files, Growth 12-18, Enterprise 20-30 plus).
   Look: root inventory count; contributor count, releases, and CI reality from the fingerprint; any pinned tier in docs or the plan.
   Fail: inventory out of band for the evident stage in either direction (community pack on a solo MVP, funded product missing Growth files). Medium.
2. **A-REPO-2 Brownfield layering respected.** Scaffold generations coexist coherently and an existing Pillars standard survived.
   Look: `AGENTS.md` plus `agents/*.md` with `pillar:` frontmatter still cross-referenced; duplicate or contradictory configs from different scaffold passes; plan-aware: the plan's mode line and stop-describe-propose protocol.
   Fail: Pillars orphaned or clobbered by a regenerated `AGENTS.md`, or paired configs that contradict each other. Medium. Content quality of `AGENTS.md` belongs to agent-memory: cross-reference F-MEM.
3. **A-REPO-3 No destructive git automation.** No script, hook, CI step, or task runner target runs destructive git against the working tree.
   Look: `grep -rEn 'git (reset --hard|checkout --|clean -f|push .*--force)' scripts/ Makefile Justfile .github/ .githooks/ package.json`.
   Fail: destructive command reachable from automation, High; bare `--force` instead of `--force-with-lease` in a release workflow, Medium.
4. **A-REPO-4 Stack-derived artifacts.** Every tooling file traces to the stack in the manifest.
   Look: `.gitignore` vs stack build dirs (`node_modules/`, `__pycache__/`, `target/`, `.next/`); each config file vs an installed dependency or built-in tool.
   Fail: `.gitignore` missing the stack's build dir, Medium; a config for an uninstalled tool (`eslint.config.js` with no eslint dep, `.npmrc` in a Python repo), Medium.
5. **A-REPO-5 Polyglot layering (conditional).** With more than one language: a primary is evident, tooling is layered per language, CI runs one job per language, and shared types generate from one source.
   Look: multiple manifests; the job list in the CI workflow; hand-written twin types on both sides of the API boundary.
   Fail: one blended CI job across languages, or duplicated hand-rolled boundary types. Medium.
6. **A-REPO-6 No placeholders.** Committed repo docs carry real values everywhere a template would stub.
   Look: `grep -rEn '\{\{|TODO|TBD|PLACEHOLDER|INSERT|example\.com' README.md LICENSE CONTRIBUTING.md SECURITY.md .github/`.
   Fail: unresolved template variable, `example.com` contact, or wrong year or author in LICENSE. High in LICENSE and SECURITY.md, Medium elsewhere. Stubbed app code (TODO handlers, fake data) belongs to build: cross-reference per the ownership map.
7. **A-REPO-7 README proof test.** README contains a description, install steps, a usage example, a license reference, and a Quick Start of 5 or fewer commands a fresh clone can run.
   Look: `README.md` headings and fenced command blocks.
   Fail: missing install or usage, Medium; a README that is only a title and badges, High.
8. **A-REPO-8 Documentation set to tier.** At reconstructed tier 2 plus: CONTRIBUTING names the real branch model, setup, and test command; SECURITY.md carries a real contact and response timeline; CHANGELOG uses Keep a Changelog headings with an Unreleased section.
   Look: the three files; the convention actually used in `git log`; CODE_OF_CONDUCT only where the audience warrants it.
   Fail: a tier-required file missing with no stated reason, Medium; present but hollow (CHANGELOG with only a heading, CONTRIBUTING describing a workflow git history contradicts), Medium.
9. **A-REPO-9 CI runs the real pipeline.** CI triggers on `pull_request` and push to the default branch and runs the project's actual lint, type-check, test, and build commands.
   Look: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`; steps matching `run: echo` or `run: true`.
   Fail: no CI on a funded product, High; stub steps faking green, High; missing `pull_request` trigger, Medium.
10. **A-REPO-10 Quality tooling set.** One linter, one formatter, a git-hook manager, `.editorconfig`, and `.gitattributes` containing `* text=auto`.
    Look: stack-native configs (`biome.json`, ruff in `pyproject.toml`, `.golangci.yml`, clippy); `.husky/`, `lefthook.yml`, or `.pre-commit-config.yaml` actually invoking them.
    Fail: no linter at tier 2 plus, Medium; missing `.editorconfig` or `.gitattributes`, Low; hook manager installed but running nothing, Low.
11. **A-REPO-11 One tool per job.** No two tools share a job anywhere in the repo.
    Look: ESLint plus Biome configs, Prettier plus Biome, Black plus Ruff format, `dependabot.yml` plus `renovate.json`, two release tools, two hook managers.
    Fail: duplicate tools for one job, Medium; both actively wired into CI or hooks, the finding quotes both config paths.
12. **A-REPO-12 Security automation wired.** At tier 2 plus: exactly one dependency bot with update grouping, a SAST workflow, secret scanning, and branch protection documented with its exact settings.
    Look: `.github/dependabot.yml` or `renovate.json` grouping blocks; `codeql.yml` or a semgrep step; a gitleaks step or platform scanning; protection settings in CONTRIBUTING or settings-as-code.
    Fail: no dependency bot, Medium; no SAST on a funded product, Medium; bot without grouping, Low. Actual leaked secrets are F-SEC: cross-reference, never re-score.
13. **A-REPO-13 Release machinery consistent.** One release tool, `vX.Y.Z` SemVer tags, and the same commit convention cited by the release tool, CONTRIBUTING, and the PR template.
    Look: release-please, semantic-release, or changesets config; `git tag -l 'v*'`; convention strings across the three artifacts; `git log --oneline -30` conformance.
    Fail: the tool parses Conventional Commits while history does not conform, or the three artifacts cite different conventions. Medium.
14. **A-REPO-14 Tier boundary honesty.** Tier 4 artifacts (signed commits, SBOM, provenance, ADRs, runbooks) are whole or absent, never half-started.
    Look: SBOM steps in workflows and where their output goes; `docs/adr/` contents; runbooks; enforcement behind each hardened claim.
    Fail: a hardened artifact started but inert (SBOM generated then discarded, ADR dir holding only a template), Low; a README claim with no enforcing config, Medium.
15. **A-REPO-15 Agent-safety layer.** `.claude/settings.json` denies destructive commands, `.githooks/pre-push` exits nonzero on force-push to protected branches, and `.gitleaks.toml` is wired into both pre-commit and CI.
    Look: the three files plus the `core.hooksPath` setup and CI step that activate them.
    Fail: all three absent on a repo agents execute against, Medium as one finding; a file present but unwired (hooks path never set, gitleaks config with no CI step), Low.
16. **A-REPO-16 Cross-references closed.** Every file a doc links to exists, and every badge maps to a configured service on the right repo and branch.
    Look: relative links in README and CONTRIBUTING vs `git ls-files`; badge URLs vs workflow names, platform, and repo slug.
    Fail: link to a missing file, Low; badge rendering 404 or unknown, or pointing at another repo or branch, Medium.
17. **A-REPO-17 Single naming across artifacts.** Each core concept keeps one spelling across directory, test file, endpoint, and README heading.
    Look: concept nouns across `src/` directories, test filenames, route paths, and doc headings.
    Fail: two spellings for one concept across repo surfaces, Low. In-code identifier idiom belongs to style-genome: cross-reference F-DNA.
18. **A-REPO-18 No empty ceremony.** No `.gitkeep`-only directories, no committed `.env`, no governance pack on a solo repo, no stock template text.
    Look: `find . -name .gitkeep`; `git ls-files | grep -E '(^|/)\.env$'`; `GOVERNANCE.md` vs the fingerprint contributor count; templates containing "A clear and concise description".
    Fail: committed `.env`, Medium (live values inside escalate through an F-SEC cross-reference); the rest Low.
19. **A-REPO-19 Stated finish line.** The repo names its own hygiene bar somewhere durable: a target tier, a Mode C band out of 42, or a prior audit report with a target.
    Look: tier statement in README or CONTRIBUTING, `AUDIT-REPORT.md`; plan-aware: the Repository section's numeric target band.
    Fail: no stated bar on a funded product, Low; the auditor then scores against the reconstructed tier and says so in the domain summary.
20. **A-REPO-20 Upstream consistency.** Repo artifacts agree with upstream decisions on disk instead of re-deciding.
    Look: CI commands and tooling vs `.stack-ready/DECISION.md` or the plan's stack section; workspace layout vs the architecture record.
    Fail: repo tooling contradicts a recorded upstream decision with no drift note, Low; the code wins, the missing note is the finding.
21. **A-REPO-21 Version control reality (audit-only).** The project is a git repository and the index is clean of artifacts.
    Look: `git rev-parse --short HEAD`; `git ls-files` for `node_modules/`, `dist/`, `__pycache__/`, `target/`; tracked files over 5 MB outside LFS.
    Fail: no repository at all, High per `intake.md`; tracked build artifacts or vendored dependency trees, Medium; large binaries outside LFS, Low.
22. **A-REPO-22 Tests exist and CI runs them (audit-only).** A real test suite exists and the CI test step executes it.
    Look: test globs (`*.test.*`, `*_test.go`, `tests/`, `spec/`); the test command CI runs; scripts that exit 0 printing "no tests".
    Fail: no tests on a funded product, High; tests present but never wired into CI, Medium. Test quality belongs to code-quality: cross-reference per the ownership map.
23. **A-REPO-23 Delivery reality (audit-only, conditional).** Runs only when the roadmap domain is excluded per `intake.md`: the repo's release story matches shipped reality.
    Look: latest `v*` tag vs the CHANGELOG top entry; commit recency vs activity claims in README; release automation that has never cut a release.
    Fail: CHANGELOG and tags disagree, Low; release machinery configured but unused across 6 months of active commits, Low.

## Scoring

Weighted dimensions summing to 100. Derived from repo-ready's 42-point Mode C table normalized, with the DX slice redistributed into CI tooling and tier discipline (onboarding DX is already exercised by the A-REPO-7 Quick Start and A-REPO-10 hooks).

| Dimension | Weight | Checks |
|---|---|---|
| Essentials and hygiene | 18 | A-REPO-4, A-REPO-6, A-REPO-7, A-REPO-21 |
| CI and quality tooling | 20 | A-REPO-5, A-REPO-9, A-REPO-10, A-REPO-11, A-REPO-22 |
| Community and documentation | 14 | A-REPO-8, A-REPO-16, A-REPO-17, A-REPO-18 |
| Security automation | 14 | A-REPO-3, A-REPO-12 |
| Tier discipline and traceability | 14 | A-REPO-1, A-REPO-2, A-REPO-19, A-REPO-20 |
| Release machinery (conditional) | 12 | A-REPO-13, A-REPO-14, A-REPO-23 |
| Agent safety | 8 | A-REPO-15 |

Release machinery applies only when the release sub-surface exists; a tier-1 repo that publishes nothing and declares the stop drops it, re-normalizing the rest to 100. A-REPO-5 is skipped in single-language repos without re-weighting its dimension. Any open Critical finding caps this domain at 69.

## Remediation seeds

- [ ] GA-xxx Replace stub CI with the real pipeline
  - Files: .github/workflows/ci.yml
  - Acceptance: workflow triggers on `pull_request` and push to the default branch; steps run the project's actual lint, type-check, test, and build commands; no step runs `echo` or `true`
  - Verify: `grep -q 'pull_request' .github/workflows/ci.yml && ! grep -qE 'run: *(echo|true)' .github/workflows/ci.yml`
  - Checks: A-REPO-9, A-REPO-22
- [ ] GA-xxx Purge placeholders from committed docs
  - Files: README.md, LICENSE, SECURITY.md, CONTRIBUTING.md
  - Acceptance: LICENSE carries the real SPDX text, current year, and real author; SECURITY.md names a real contact and response timeline; the banned-string grep returns nothing
  - Verify: `grep -rEn '\{\{|TODO|TBD|example\.com' README.md LICENSE SECURITY.md CONTRIBUTING.md; test $? -eq 1`
  - Checks: A-REPO-6, A-REPO-8
- [ ] GA-xxx Rebuild README to pass the fresh-clone proof test
  - Files: README.md
  - Acceptance: description, install steps, usage example, and a License section are present; the Quick Start runs in 5 or fewer commands from a fresh clone; every relative link resolves to a tracked file
  - Verify: `grep -qi 'quick start' README.md && grep -qiE '^## license' README.md`
  - Checks: A-REPO-7, A-REPO-16
- [ ] GA-xxx Remove the duplicate tool per job
  - Files: eslint.config.js, biome.json, package.json
  - Acceptance: exactly one linter and one formatter remain configured; the loser's config file is deleted, not ignored; hooks and CI invoke only the survivor
  - Verify: `! (test -f eslint.config.js && test -f biome.json)`
  - Checks: A-REPO-11, A-REPO-10
- [ ] GA-xxx Install the agent-safety layer
  - Files: .claude/settings.json, .githooks/pre-push, .gitleaks.toml, .github/workflows/ci.yml
  - Acceptance: settings.json denies destructive git commands; the pre-push hook exits nonzero on force-push to the default branch; a gitleaks step runs in pre-commit and CI
  - Verify: `grep -q 'force' .githooks/pre-push && grep -q 'gitleaks' .github/workflows/ci.yml`
  - Checks: A-REPO-15, A-REPO-3
- [ ] GA-xxx Untrack build artifacts and align .gitignore to the stack
  - Files: .gitignore
  - Acceptance: the stack's build dirs are ignored; tracked artifacts are removed from the index in the same change; no tracked file over 5 MB remains outside LFS
  - Verify: `test -z "$(git ls-files | grep -E '(^|/)(node_modules|dist|__pycache__|target)/')"`
  - Checks: A-REPO-21, A-REPO-4
- [ ] GA-xxx Wire security automation for the tier
  - Files: .github/dependabot.yml, .github/workflows/codeql.yml, CONTRIBUTING.md
  - Acceptance: exactly one dependency bot is configured with update grouping; the SAST workflow is stack-correct; branch protection settings for the default branch are documented verbatim
  - Verify: `test -f .github/dependabot.yml && ! test -f renovate.json && test -f .github/workflows/codeql.yml`
  - Checks: A-REPO-12, A-REPO-11

## Anti-patterns hunted

- **Cardboard cutout repo.** README with only a title, `{{author}}` in LICENSE, `security@example.com` in SECURITY.md. Hunt: the A-REPO-6 grep; the ten-second `gh repo view` sniff test made greppable, quoted string per file.
- **Echo CI.** Workflow steps running `echo` or `true` so the badge turns green. Hunt: A-REPO-9 over every workflow; the green badge itself goes in Evidence; always High.
- **Stack-mismatched files.** ESLint config in a Python repo, `.npmrc` without Node, `.gitignore` missing the build dir. Hunt: the A-REPO-4 config-vs-manifest diff; name the file and the dependency it lacks.
- **Two tools, one job.** ESLint plus Biome, Dependabot plus Renovate, dueling formatters producing conflicting diffs. Hunt: the A-REPO-11 walk; quote both config paths.
- **Dead badges.** Badges pointing at wrong repos, wrong branches, or services never configured. Hunt: A-REPO-16 resolves every badge URL against the workflows and repo slug on disk.
- **Uncustomized ceremony.** Stock issue-template text, CONTRIBUTING describing a workflow git history contradicts. Hunt: A-REPO-8 and A-REPO-18; quote the stock phrase and the contradicting `git log` line.
- **Bureaucracy without users.** GOVERNANCE.md and a full community pack on a solo repo. Hunt: A-REPO-1 and A-REPO-18 against `git shortlog -sn` from the fingerprint.
- **Ghost structure.** Directories holding only `.gitkeep`, a committed `.env`. Hunt: A-REPO-18; live values in the `.env` escalate via an F-SEC cross-reference, never a second repo finding.
- **Half-done tier.** Tier 3 files appearing while tier 2 checks still fail, or hardened claims with no enforcement. Hunt: A-REPO-14 boundary check; score the finished tier, flag the orphans.
- **Vague finding.** "Docs are thin" or "CI needs work". Refused: every repo finding names the file, the missing element, and the grep or command that proves it.
- **Double-billing.** Leaked secrets are F-SEC, test quality is code-quality, naming idiom is F-DNA, `AGENTS.md` content is F-MEM, stubbed handlers are build. Refused: this module audits presence and wiring; content owned elsewhere is cross-referenced per the ownership map.
- **Severity inflation.** A missing `.editorconfig` is paperwork, not breakage. Refused: hygiene gaps default Low; only echo CI, destructive automation, absent version control, placeholder LICENSE or SECURITY.md, and testless funded products reach High.
