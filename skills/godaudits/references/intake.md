# Intake module: orient, fingerprint, applicability, ownership

Loaded in Phase 0 and Phase 2. Turns a repository into the facts the domain passes need: mode, archetype, scale, the applicability matrix, the ownership map, and the domain weights. Intake is where godaudits earns the single-command promise: the repo answers almost every question; the user answers at most three.

## Mode detection (Phase 0)

- `.godaudits/AUDIT.mdx` exists -> **re-audit**. Follow the re-audit protocol in `audit-format.md`.
- Source manifests exist (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `pom.xml`, `mix.exs`, `Package.swift`) or source trees exist -> **fresh audit**.
- Neither -> **refuse politely**: there is nothing to audit. Point the user at godplans; auditing an empty directory is planning, and planning is the sibling skill's job.

Independently of mode, check for `.godplans/PLAN.mdx`. If present, set **plan-aware: true**: the audit additionally checks conformance between the plan and the code (checked tasks whose Verify commands would fail, decisions the code contradicts, requirements with no trace in the source), and every finding's `Checks:` line carries the matching `R-<DOM>-n` plan requirement ids next to the `A-<DOM>-n` check ids. The A-numbering mirrors the R-numbering one to one by design, so the mapping is mechanical.

Record the commit: `git rev-parse --short HEAD`, or `no-git` (and a High repo finding) when there is no repository.

## The fingerprint (read-only, before any domain pass)

Inventory once, share with every domain pass:

- Stack and versions from manifests and lockfiles; monorepo layout if any.
- Directory shape, module boundaries, entry points (main, server bootstrap, route registration, CLI entry, background workers, queue consumers).
- Data layer: schema files, migrations, ORM models, raw query sites.
- Surfaces: HTTP routes, webhooks, uploads, outbound fetches, auth flows, LLM call sites, CI/CD workflows, Dockerfiles, IaC, deploy configs.
- Test and CI reality: suites present, last-known commands, coverage config.
- Conventions already recorded: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `agents/` pillars, lint and format configs.
- Git signals for scale calibration: `git shortlog -sn` contributor count, commit recency, tags and releases.

The fingerprint is evidence collection, not judgment. Judgments happen inside domain passes, against module checks, so every claim lands with a check id attached.

## Archetype detection

Pick the closest archetype; hybrids name a primary and a secondary, and merged matrices resolve conflicts in the primary's favor. Signals beat labels: a "CLI tool" with a companion web dashboard is a hybrid.

| Archetype | Signals | Typical exclusions |
|---|---|---|
| cli-tool | terminal entry point, no server, distributed as binary or package | seo, ui (terminal output is ux, not ui), launch (often), llm |
| library | consumed by other code; the API is the product | seo, ui, observe (consumer-side), launch (registry release instead) |
| api-service | HTTP or RPC surface, no first-party frontend | seo, ui |
| saas-dashboard | authenticated web app over domain data | none by default |
| marketing-site | public content, conversion goals, little state | database (often), llm (often) |
| mobile-app | app-store distribution, native or cross-platform | seo (store listing replaces it) |
| ml-pipeline | batch or streaming data and model flows | seo, ui (unless it has an ops console) |
| extension | lives inside a host (browser, editor, platform) | seo; deploy is store publishing |
| game | real-time loop, assets, scenes | seo (store listing), database varies |

## Scale calibration

Calibrate from repo signals, then state it in the audit; every module's severity judgment scales with it.

- **weekend**: one contributor, no CI, no deploy config, days old. Security and compliance still bind (secrets, injection); observability findings collapse to "logs exist".
- **side-project**: real users plausible, one maintainer, some CI. Deploy, backups, and error tracking are audited; SOC 2 is not.
- **funded-product**: multiple contributors, releases, uptime matters. The full applicable matrix at full severity.
- **enterprise**: compliance regimes, many teams. Everything, plus the regulated-data mapping the security module demands.

Calibration moves severity, never evidence: a weekend project with fast-hashed passwords still gets the Critical; what changes is whether a missing staging environment is High or a shrug. Cheap corners that were cut deliberately and documented score better than the same corners cut silently: the audit rewards named decisions.

## The applicability matrix

Every domain gets a row. Applicable means the domain pass runs and its checks bind. Excluded requires a reason specific to this repo; "not needed" is banned by the substitution test.

Hard rules: security, code-quality, style-genome, repo are never excluded (they scale down instead). seo requires a public crawlable surface. llm requires model calls in the code; a langchain import with no call site is a stack finding, not an llm pass. ui requires rendered pixels the project owns. roadmap applies whenever a plan, roadmap, or issue tracker artifact exists in or beside the repo; otherwise it reduces to one delivery-reality check inside repo.

## Domain weights

Overall score = sum(domain score x weight) / sum(weights), over applicable domains only (re-normalization is automatic: excluded domains simply drop out). Then apply the caps from `audit-format.md`.

| Domain | Weight |
|---|---|
| security | 15 |
| code-quality | 10 |
| build | 10 |
| database | 8 |
| architecture | 8 |
| product | 7 |
| ux | 7 |
| llm | 6 |
| deploy | 6 |
| observe | 5 |
| repo | 5 |
| stack | 4 |
| ui | 4 |
| roadmap | 4 |
| seo | 3 |
| launch | 3 |
| style-genome | 3 |
| agent-memory | 2 |

The weights encode blast radius, not importance to feelings: a security hole hurts users; a missing AGENTS.md hurts the next agent session.

## The ownership map

Each concern is audited exactly once, by the domain that owns it. Findings elsewhere cross-reference instead of duplicating; one root cause never becomes four findings in four domains.

| Concern | Owner | Others may |
|---|---|---|
| secrets in repo or CI | security | repo notes the hygiene gap, points at F-SEC id |
| missing indexes, N+1 queries | database | code-quality points at F-DB id |
| SQL injection, unsafe query building | security | database points at F-SEC id |
| prompt injection, LLM output to dangerous sinks | security | llm points at F-SEC id |
| prompt construction, model choice, token cost | llm | |
| schema shape, migrations, transactions | database | deploy audits lock behavior at deploy time only; architecture may cite as evidence |
| visual a11y (contrast, focus states, labels) | ui | |
| flow a11y (keyboard journeys, error recovery) | ux | |
| Core Web Vitals code signals | seo | seo owns sitewide budgets and pipeline; ui audits per-route render-path code and points at F-SEO |
| dead code, complexity, error handling | code-quality | |
| naming and idiom consistency | style-genome | style-genome owns in-code idiom; repo owns artifact-surface naming (dirs, files, endpoints); code-quality points at F-DNA id |
| test existence and CI wiring | repo | code-quality owns test quality |
| placeholder and stub detection (TODO handlers, fake data) | build | product cites for unmet promises |
| plan drift (plan-aware mode) | roadmap | every domain tags R-ids on its own findings |
| AI instruction files (AGENTS.md, pillars) | agent-memory | |
| deploy pipeline, rollback | deploy | |
| SLOs, alerting, logging shape | observe | security owns log redaction |
| landing, OG cards, launch SEO | launch | seo owns crawlability of the product itself |

## The interview (rarely needed)

Audits ask questions only when the repo cannot answer and the answer changes severity. At most one batch of 0 to 3 questions, each with a recommended default so "defaults" is a complete answer. Everything not asked becomes a stated assumption in Scope and method.

Good questions: "Is this deployed to real users today? Default: yes, the deploy workflow ran 2 days ago" (changes severity of everything), "Is the data in prod regulated (health, payments, minors)? Default: no, nothing in the schema suggests it" (activates the security module's regulated-data checks). Bad questions: anything greppable, anything cosmetic. Non-interactive fallback: take every default, flag each as an assumption, say so in Scope and method.

## Output of intake

By the end of Phase 2 the following exist, ready for the domain passes: mode (plus plan-aware flag and commit), archetype with hybrid note, scale calibration with its signals, the applicability matrix complete with reasons, the fingerprint inventory, the ownership map understood (it is this file; domain passes cite it), and assumptions recorded.

## Anti-patterns refused

- **The generic matrix**: applicability copied from the archetype table without reading the repo. Refused: reasons must survive the substitution test.
- **Fingerprint amnesia**: domain passes re-discovering the same routes and schemas four times, inconsistently. Refused: one fingerprint, shared, cited.
- **The interrogation**: asking the user what the repo already answers. Refused: at most one batch of 0 to 3, defaults offered.
- **Scale theater**: enterprise ceremony against a weekend repo, or weekend leniency on a funded product. Refused: calibration is stated with its signals and modules scale to it.
- **Double-billing**: the same root cause scored as a finding in two domains, dragging the overall down twice. Refused: the ownership map assigns one owner; others cross-reference.
