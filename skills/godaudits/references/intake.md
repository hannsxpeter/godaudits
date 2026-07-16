# Intake module: orient, fingerprint, applicability, ownership

Loaded in Phase 0 and Phase 2. Turns a repository into the facts the domain passes need: mode, project form, domain overlays, compatibility archetype, scale, risk profile, applicability, ownership, and deterministic evidence. Intake is where godaudits earns the single-command promise: the repository answers almost every question; the user answers at most three.

## Mode detection (Phase 0)

- `.godaudits/AUDIT.json` exists -> **re-audit**. Follow the re-audit protocol in `audit-format.md`.
- Source manifests exist (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `pom.xml`, `mix.exs`, `Package.swift`) or source trees exist -> **fresh audit**.
- Neither -> **refuse politely**: there is nothing to audit. Point the user at godplans; auditing an empty directory is planning, and planning is the sibling skill's job.

Independently of mode, check for `.godplans/PLAN.mdx`. If present, set **plan-aware: true**: the audit additionally checks conformance between the plan and the code (checked tasks whose Verify commands would fail, decisions the code contradicts, requirements with no trace in the source), and every finding's `Checks:` line carries the matching `R-<DOM>-n` plan requirement ids next to the `A-<DOM>-n` check ids. The A-numbering mirrors the R-numbering one to one by design, so the mapping is mechanical.

Record the commit: `git rev-parse --short HEAD`, or `no-git` (and a High repo finding) when there is no repository.

## The fingerprint (read-only, before any domain pass)

Run `godaudits evidence . --output .godaudits/EVIDENCE.json`, then review the output. Inventory once and share with every domain pass:

- Stack and versions from manifests and lockfiles; monorepo layout if any.
- Directory shape, module boundaries, entry points (main, server bootstrap, route registration, CLI entry, background workers, queue consumers).
- Data layer: schema files, migrations, ORM models, raw query sites.
- Surfaces: HTTP routes, webhooks, uploads, outbound fetches, auth flows, LLM call sites, CI/CD workflows, Dockerfiles, IaC, deploy configs.
- Test and CI reality: suites present, last-known commands, coverage config.
- Conventions already recorded: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `agents/` pillars, lint and format configs.
- Git signals for scale calibration: `git shortlog -sn` contributor count, commit recency, tags and releases.

The fingerprint is evidence collection, not judgment. Regex signals are leads and can never become findings without path tracing and refutation. The fingerprint records file hashes, absence searches, secret-safe masking, form and overlay evidence, compatibility archetype confidence, arc-ready artifact state, Pillars routing state, and static-mode limitations. Judgments happen inside domain passes, so every pass and failure lands in the check ledger with evidence ids.

## Form-first project context

Route the audit across four independent axes. Do not overload one archetype label with all four decisions.

1. Project form names the delivery surface. Select one primary form and zero or more secondary forms.
2. Product archetype names the product behavior, such as SaaS, marketplace, library, or developer tool.
3. Industry overlay names a domain vocabulary and threat surface supported by repository evidence.
4. Regulatory overlay names a candidate obligation. It never asserts legal applicability from source clues alone and must be verified by an owner.

The six project forms are fixed and portable:

| Form | Signals | Typical exclusions |
|---|---|---|
| web-application | owned browser routes, components, HTML, or web build config | none by default |
| api-service | HTTP, RPC, webhook, worker, or service entry point | seo and ui when no first-party frontend exists |
| cli-sdk | executable command, package API, SDK exports, or registry publishing | seo and ui often; observe may be consumer-side |
| mobile-desktop | native, cross-platform, app-store, desktop bundle, or extension manifest | seo often; deploy means store or package publishing |
| data-ml | data pipeline, notebook, feature, training, inference, or model artifact | seo and ui unless an owned console exists |
| infrastructure-iac | Terraform, Pulumi, CloudFormation, Kubernetes, Helm, or configuration management | product UI domains unless the repo also ships one |

Signals beat labels. A CLI with a companion dashboard has primary `cli-sdk` and secondary `web-application`. A web application with Terraform stays primary `web-application` and adds `infrastructure-iac` as secondary. Every form and overlay record cites the matching paths and signals. Weak regulatory signals produce only a candidate with Tentative confidence and `requires_verification: true`.

For compatibility, `archetype.primary` remains in EVIDENCE.json and `audit.archetype` remains in AUDIT.json. They are derived from the primary form and strongest product archetype mapping. New routing uses `project_form`, `secondary_forms`, and `domain_overlays`; old 2.0 audit documents without those fields remain valid.

The project-context catalog contains all six forms and the 37 arc-ready profile mappings. The runtime validates catalog identity, evidence rules, form targets, overlay axis, confidence floor, and duplicate aliases before using it. Catalog labels are routing inputs, never conclusions: applicability still requires evidence and the substitution test.

## Scale calibration

Calibrate from repo signals, then state it in the audit; every module's severity judgment scales with it.

- **weekend**: one contributor, no CI, no deploy config, days old. Security and compliance still bind (secrets, injection); observability findings collapse to "logs exist".
- **side-project**: real users plausible, one maintainer, some CI. Deploy, backups, and error tracking are audited; SOC 2 is not.
- **funded-product**: multiple contributors, releases, uptime matters. The full applicable matrix at full severity.
- **enterprise**: compliance regimes, many teams. Everything, plus the regulated-data mapping the security module demands.

Calibration moves severity, never evidence: a weekend project with fast-hashed passwords still gets the Critical; what changes is whether a missing staging environment is High or a shrug. Cheap corners that were cut deliberately and documented score better than the same corners cut silently: the audit rewards named decisions.

## The applicability matrix

Every domain gets a row. Applicable means the domain pass runs and its checks bind. Excluded requires a reason specific to this repo; "not needed" is banned by the substitution test. Merge routing from the primary form, every supported secondary form, and verified overlays. A primary form cannot silently suppress a domain activated by a real secondary surface. Candidate regulatory overlays may add questions and evidence requirements, but do not alter scoring until verified.

Hard rules: security, code-quality, style-genome, repo are never excluded (they scale down instead). seo requires a public crawlable surface. llm requires model calls in the code; a langchain import with no call site is a stack finding, not an llm pass. ui requires rendered pixels the project owns. roadmap applies whenever a plan, roadmap, or issue tracker artifact exists in or beside the repo; otherwise it reduces to one delivery-reality check inside repo.

## Documentation profile

The same signals that build the applicability matrix, product form, scale, risk
profile, and regulatory overlays, also set which documents this project is expected
to carry. Derive the expected documentation set the way a comparable project of this
shape would need it, not from a fixed checklist: a prototype carries a README and a
brief; a funded-product system adds a PRD, architecture and ADRs, a test strategy, a
deploy and rollback plan, an operations runbook, and release notes; an enterprise or
regulated system adds an initiation brief (charter, business case, stakeholders and
RACI), a requirements-traceability matrix, a closeout with lessons, and the
regulatory-overlay records named in the compliance standards. Documents the form
makes irrelevant are recorded not-applicable with a reason. A-REPO-24 audits
completeness against this profile and A-PRD-21 audits the traceability record; a
missing document is a finding only when the profile expects it.

## Risk profiles and domain weights

Overall score = sum(domain score x profile weight) / sum(active profile weights), over applicable domains only. Excluded domains drop out. Profiles live in `catalog/profiles.json`, are versioned with the check pack, and are validated mechanically. Choose one during intake:

- `balanced`: general product risk, the default.
- `security-critical`: regulated data, money, identity, privileged actions, or multi-tenant workloads.
- `growth`: public products dominated by activation, trust, visibility, conversion, and launch execution.
- `library`: libraries and developer tools dominated by API quality, compatibility, maintainability, and repository discipline.

The balanced profile is:

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

Profile selection must cite repository evidence and may not be changed to improve the score. Weights encode the product's blast radius. The audit records the profile, catalog version, and active weights so a reader can reproduce the overall score.

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

By the end of Phase 2 the following exist: mode and capabilities, plan-aware flag and commit, project form and supported secondary forms, product and industry overlays, regulatory candidates, compatibility archetype, scale calibration, risk profile, complete applicability matrix, EVIDENCE.json, initialized AUDIT.json with selected checks unknown, ownership map, and recorded assumptions. AUDIT.json also records the evidence fingerprint and evidence commit so `validate --require-fresh-evidence` can reject drift.

## Anti-patterns refused

- **The generic matrix**: applicability copied from the archetype table without reading the repo. Refused: reasons must survive the substitution test.
- **Fingerprint amnesia**: domain passes re-discovering the same routes and schemas four times, inconsistently. Refused: one fingerprint, shared, cited.
- **The interrogation**: asking the user what the repo already answers. Refused: at most one batch of 0 to 3, defaults offered.
- **Scale theater**: enterprise ceremony against a weekend repo, or weekend leniency on a funded product. Refused: calibration is stated with its signals and modules scale to it.
- **Double-billing**: the same root cause scored as a finding in two domains, dragging the overall down twice. Refused: the ownership map assigns one owner; others cross-reference.
- **Archetype soup**: delivery form, product behavior, industry, and regulation collapsed into one label. Refused: route on four axes and cite each signal independently.
- **Regulation by keyword**: a dependency or schema field treated as proof that a legal regime applies. Refused: record a candidate and require owner verification.
