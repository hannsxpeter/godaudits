---
name: godaudits
description: "Audit an existing codebase end to end in one command and emit a master audit report (.godaudits/AUDIT.mdx): per-domain scores, evidence-backed findings, and an agent-executable remediation plan. One command fingerprints the repo, then audits product reality, architecture, stack, database, security, LLM integration, UX, UI, SEO, code quality, style genome, agent memory, repo hygiene, build completeness, delivery, deployment, observability, and launch readiness, verifies every finding at file:line, scores each domain, and converts findings into checkbox remediation tasks with verify commands any coding agent can execute. Plan-aware: when .godplans/PLAN.mdx exists it audits conformance against it. Read-only: never edits source, runs the app, or calls models. Use when the user says: audit this project, godaudits, full audit, health check, re-audit, due diligence, is this production ready. Refuses audit theater (scores without evidence), vague findings, and criticism without a remediation path."
license: MIT
metadata:
  version: "1.0.0"
  author: aihxp
  homepage: https://github.com/aihxp/godaudits
---

> Invocation: `/godaudits` in Claude Code, Cursor, VS Code, Zed, and Factory; `$godaudits` in Codex; `@godaudits` in Windsurf; auto-triggered elsewhere. Treat any text after the command as the argument: a path, a focus ("just security and database"), or a constraint. There are no sub-commands.

# godaudits

Audit everything after anything. godaudits is an audit superskill: it runs the entire inspection arc of a software project in one command and emits one master audit, `.godaudits/AUDIT.mdx`, that scores every applicable domain, backs every finding with file:line evidence, and ends in a remediation plan a coding agent can execute task by task, checkbox by checkbox.

godaudits is the mirror of godplans. godplans takes every dimension the auditors check and inverts each check into a plan-time requirement, so a planned project passes its audits by design. godaudits runs those same checks forward, against code that already exists. The two skills share one numbering system: audit check `A-SEC-3` verifies what plan requirement `R-SEC-3` demanded. Plan with one, audit with the other, and the loop closes: the audit tells you exactly which planned requirement drifted, and the remediation plan it emits is in the same grammar as the plan you started from.

godaudits descends from: aihxp/codeauditor, secauditor, dbauditor, llmauditor, seoauditor, uiauditor, and uxauditor (the audit method and dimensions), aihxp/arc-ready and aihxp/ready-suite (the tier disciplines audited as reality checks), aihxp/pillars (agent memory), aihxp/codedna (style genome), and aihxp/godplans (the shared requirement numbering, task grammar, and MDX plan discipline).

## Ground rules (non-negotiable)

1. **Auditing is read-only.** Make no source edits. Never run the application, never execute its test suite, never connect to a live database, never call a model, never hit the network on the product's behalf. The only files godaudits writes are under `.godaudits/`.
2. **Evidence over assertion.** Every finding cites file:line at the audited commit with quotable evidence. A claim without evidence is labeled Tentative or deleted; a citation that does not reproduce is a defect in the audit, not the codebase.
3. **The substitution test.** For any finding or recommendation, substitute a near-equivalent codebase. If the sentence still reads plausibly, it says nothing specific and fails. "Improve error handling" is banned; "the catch block at src/jobs/sync.ts:112 swallows the error and returns success" ships.
4. **Root causes, not leaves.** Cluster symptom findings under the root cause that produces them: one missing authorization layer is one Critical finding with twelve sites in Evidence, not twelve findings.
5. **Audit each concern once.** The ownership map in `references/intake.md` assigns every concern one owning domain; other domains cross-reference the finding id instead of re-scoring it.
6. **Standalone-report rule.** No chat-context dependencies. A reader who never saw this conversation, and an agent in a different tool entirely, must be able to act on AUDIT.mdx alone.
7. **Read the module before auditing.** Each domain has a reference module under `references/`. Read it at the moment you audit that domain. Do not audit from memory; the modules carry the checks and the scoring weights, and memory drifts.
8. **Calibrate honestly.** Name strengths with the same evidence standard as faults. Scale severity to the project's calibration. Never inflate severity to look thorough, never pad a clean domain with filler findings: zero findings is a reportable result.
9. **Every Critical ends in a task.** An audit that names a Critical and walks away is drive-by criticism. Every Critical and High finding maps to a remediation task with an exact Verify command.
10. **Compliance is standing.** Follow `references/compliance.md` for the whole session: never coach a model past a refusal, never route subscription OAuth outside official clients, and screen the audited product against the Anthropic Usage Policy before auditing it.

## Method

Run the phases in order. Do not skip a phase; a phase that does not apply still gets a one-line disposition so the trail is complete.

### Phase 0: Orient

Read `references/intake.md` (mode detection section). Detect:

- `.godaudits/AUDIT.mdx` -> **re-audit mode** (see Modes below).
- Source exists, no prior audit -> **fresh audit**.
- No source at all -> refuse politely and point at godplans; there is nothing to audit.
- `.godplans/PLAN.mdx` present -> set **plan-aware** and load the plan's requirement ids and task states for the conformance checks.

Record the mode and the commit (`git rev-parse --short HEAD`, or `no-git`).

### Phase 1: Compliance gate

Read `references/compliance.md` and screen the audited product before investing in domain passes.

- **Hard stop**: the core purpose is prohibited. Say plainly why, cite the policy category, and stop. Do not produce an audit; improving a prohibited product is facilitating it.
- **Findings injected**: the product is legitimate but the code contains policy-risk components (undisclosed AI chat, OAuth tokens in cron, scraper without manners). Continue, and emit each as an `F-CMP-n` finding with a mandatory remediation task.
- **Pass**: note "Compliance gate: pass" and continue.

### Phase 2: Intake and fingerprint

Read `references/intake.md` in full. Establish: archetype (with hybrid note), scale calibration (from repo signals: contributors, CI, deploy configs, releases), the applicability matrix (every domain applicable or excluded with a project-specific reason), the read-only fingerprint (stack, entry points, surfaces, data layer, tests, conventions), and the ownership map. Ask the user at most one batch of 0 to 3 questions, each with a recommended default, and only when the repo cannot answer.

### Phase 3: Domain passes

For each applicable domain, in this order, read its module and run its checks against the fingerprinted code, collecting evidence-backed candidate findings and per-dimension scores:

| Order | Domain | Module | Descends from |
|---|---|---|---|
| 1 | Product reality | `references/product.md` | prd-ready |
| 2 | Architecture | `references/architecture.md` | architecture-ready |
| 3 | Stack | `references/stack.md` | stack-ready |
| 4 | Database | `references/database.md` | dbauditor |
| 5 | Security | `references/security.md` | secauditor, harden-ready |
| 6 | LLM integration | `references/llm.md` | llmauditor |
| 7 | UX | `references/ux.md` | uxauditor |
| 8 | UI | `references/ui.md` | uiauditor |
| 9 | SEO and AI visibility | `references/seo.md` | seoauditor |
| 10 | Code quality | `references/code-quality.md` | codeauditor |
| 11 | Style genome | `references/style-genome.md` | codedna |
| 12 | Agent memory | `references/agent-memory.md` | pillars |
| 13 | Repository | `references/repo.md` | repo-ready |
| 14 | Build completeness | `references/build.md` | production-ready |
| 15 | Roadmap and delivery | `references/roadmap.md` | roadmap-ready, kickoff-ready |
| 16 | Deployment | `references/deploy.md` | deploy-ready |
| 17 | Observability | `references/observe.md` | observe-ready |
| 18 | Launch readiness | `references/launch.md` | launch-ready |

Each module gives you: the surface map (what to inventory and which conditional sub-surfaces to declare), the numbered checks (`A-<DOM>-n`, mirroring the godplans `R-<DOM>-n` requirements one to one), the scoring dimensions with weights, remediation seeds, and the anti-patterns it hunts (paper controls, theater, stubs). Excluded domains get one line in the applicability matrix and nothing else.

In plan-aware mode, each pass additionally checks its domain's plan section: decisions the code contradicts, checked tasks whose acceptance conditions do not hold, and requirements with no trace in the source. These land as findings tagged with both A-ids and R-ids.

### Phase 4: Adversarial verification and clustering

For every candidate finding: re-open the cited file at the cited lines and confirm the evidence quote is real and current; then try to refute it (is there a guard elsewhere on the path? is the code dead? is it test-only fixtures? does a framework default cover it?). Refuted findings are dropped; weakened ones are downgraded or labeled Tentative. Then cluster survivors by root cause and apply the ownership map so each root cause appears exactly once. Paper controls get special hunting per module: a control that exists but is not wired onto the execution path is a finding, not a strength.

### Phase 5: Score

Read `references/exemplar.md` first; it calibrates what each band means. Score each applicable domain 0 to 100 against its module's Scoring section, apply the caps (any open Critical caps its domain at 69 and the overall at 79; a domain below 50 caps the overall at 84), then compute the overall as the weighted mean per `references/intake.md`. Every score gets a one-line reason in the Scorecard. Do not bend scores toward likability; the bands are defined in `references/audit-format.md` and they mean what they say.

### Phase 6: Remediation plan

Convert findings into GA-numbered checkbox tasks per the grammar in `references/audit-format.md`: Phase 1 "Stop the bleeding" (every Critical), then "Quick wins", "Plan now", "Verify first" (Tentative findings get confirm-then-fix tasks), "Backlog", and always a final "Re-audit" phase with the expected score movement. Every task carries Files, Fixes, Acceptance, Verify, and Checks lines. Every Critical and High finding must appear in some task's Fixes line; run that closure check before Phase 7.

### Phase 7: Emit and report

1. Read `references/audit-format.md` and `templates/AUDIT.template.mdx`. Assemble `.godaudits/AUDIT.mdx` per that contract: frontmatter machine state, verdict paragraph, scope and method with commit, compliance gate, applicability matrix, scorecard, strengths, findings, remediation plan, accepted risks and open questions, executor rules, session log.
2. Validate mechanically before presenting (the machine-check commands are in audit-format.md): every finding has Where, Evidence, and Status; every task has Verify and Fixes; ids unique; counters match; every Critical mapped to a task; no banned characters.
3. Present in chat: the verdict paragraph, the scorecard table, the top three risks and top three strengths, the quick wins, finding and task counts, and the remediation protocol in three lines. The audit file, not the chat, is the deliverable.

## Modes

- **Fresh audit**: the full method above.
- **Re-audit**: `.godaudits/AUDIT.mdx` exists. Follow the re-audit protocol in `references/audit-format.md`: re-derive state from the body, re-inspect every open finding at the new commit, flip resolved statuses with evidence, add new findings with new ids, never renumber or delete history, emit the score Delta, bump `audit_version`.
- **Plan-aware overlay** (combines with either mode): `.godplans/PLAN.mdx` exists. Conformance checks run inside every domain pass; findings carry R-ids next to A-ids; the roadmap domain audits plan drift as a first-class concern.

## After the audit: remediation

godaudits audits; it does not fix. The emitted AUDIT.mdx is self-sufficient: it carries its own executor rules, so any coding agent (this one, or another tool entirely) can execute the remediation by reading the file. When the user asks you to fix the findings, follow the "Rules for remediating agents" section inside AUDIT.mdx itself, not this skill. When remediation drifts from the plan, the audit is patched (re-audit mode), because the document, not the chat, is the source of truth. The final task of every remediation is a re-audit, so the loop ends with a number, not a feeling.

## What godaudits refuses

- **Audit theater**: scores without evidence, checklists marked green from memory. Every scored dimension traces to checks that were actually run against actual files.
- **Vague findings**: any finding without file:line evidence and a specific fix does not ship. "Consider improving security" is not a finding.
- **Drive-by criticism**: findings without remediation tasks. Every Critical and High ends in a checkbox with a Verify command.
- **Double-billing**: one root cause scored in four domains. The ownership map exists; use it.
- **Severity inflation**: a missing favicon is not High. Calibration is stated and severities survive the exemplar comparison.
- **Scope leak at audit time**: godaudits does not edit source, run apps, execute test suites, call models, or push fixes. It audits and plans the fix.
- **Policy-violating products**: the Phase 1 gate is not advisory. Prohibited purposes get a refusal with the policy category named.
- **Silent domain skipping**: a domain is either audited or excluded with a reason in the matrix. Never silently absent.

## File map

| File | Role |
|---|---|
| `SKILL.md` | This orchestrator |
| `references/audit-format.md` | The AUDIT.mdx contract: structure, finding and task grammar, scoring bands, executor rules |
| `references/intake.md` | Mode detection, fingerprint, archetype, applicability matrix, domain weights, ownership map |
| `references/compliance.md` | Anthropic Usage Policy gate and account-safety rules |
| `references/exemplar.md` | Worked GOOD and BAD audit fragments; the quality bar |
| `references/<domain>.md` | 18 domain modules (see Phase 3 table) |
| `templates/AUDIT.template.mdx` | The skeleton AUDIT.mdx |

## Skill version: 1.0.0
