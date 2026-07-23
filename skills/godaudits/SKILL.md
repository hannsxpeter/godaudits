---
name: godaudits
description: "Audit an existing codebase end to end and emit validated machine state plus a standalone remediation report. godaudits fingerprints the repository, detects six project forms and conservative overlays, validates Pillars 1.1 and arc-ready artifacts, evaluates 431 checks across 18 domains in an explicit pass/fail/unknown/not-applicable ledger, records hashed secret-safe evidence, covers OWASP Web Top 10:2025, adversarially verifies findings, computes scores with coverage and risk caps, and renders MDX plus optional SARIF from AUDIT.json. Includes deterministic validation, evaluations, focused and re-audit modes, and godplans conformance. Static mode is read-only and never runs the app, tests, live systems, network, or models. Use for audits, health checks, due diligence, production readiness, re-audits, and remediation planning. Refuses stale evidence, unverifiable citations, unredacted secrets, unsupported regulatory claims, double-billing, and Critical or High findings without executable tasks."
license: MIT
metadata:
  version: "2.11.0"
  author: aihxp
  homepage: https://github.com/hannsxpeter/godaudits
---

> Invocation: `/godaudits` in Claude Code, Cursor, VS Code, Zed, and Factory; `$godaudits` in Codex; `@godaudits` in Windsurf; auto-triggered elsewhere. Treat text after the command as a path, focus, or constraint. The runtime lives beside this file at `runtime/godaudits.js`; use the installed `godaudits` command when available, otherwise run that file with Node 22 or newer.

# godaudits

Audit everything after anything. godaudits 2.11 is an evidence-first audit system, not only an audit prompt. The domain modules carry judgment. The bundled zero-dependency runtime carries inventory, form and overlay detection, Pillars 1.1 routing, arc-ready artifact validation, check-catalog compilation, state initialization, freshness validation, score computation, rendering, SARIF export, re-audit diffs, and evaluation metrics.

The machine source of truth is `.godaudits/AUDIT.json`. It records every applicable check, including clean and unknown checks. `.godaudits/AUDIT.mdx` is a generated standalone report and remediation handoff. `.godaudits/AUDIT.sarif` is optional integration output. Never hand-edit derived scores or counts.

godaudits remains the mirror of godplans. Audit check `A-SEC-3` verifies plan requirement `R-SEC-3`. In plan-aware mode, findings carry both ids and plan drift is audited in the owning domain.

## Ground rules (non-negotiable)

1. **Static is the safe default.** Static mode reads source and git metadata, writes only under `.godaudits/`, and never runs the application, tests, migrations, live systems, network requests, or model calls.
2. **Stronger evidence requires explicit authority.** Sandbox evidence is allowed only when the user explicitly authorizes execution in a disposable environment with outbound network disabled and no production credentials. Connected evidence is allowed only through explicitly authorized read-only CI, observability, database-metadata, or tracker access. Record the capability in `audit.capabilities`.
3. **Every check gets an outcome.** Applicable checks are `pass`, `fail`, or `unknown`; conditional checks may be `not-applicable` with evidence. Uninspected is `unknown`, never `pass`. Unknown checks reduce coverage and cap the verdict.
4. **Evidence over assertion.** Every pass, failure, and strength references evidence. Source evidence carries path, line, quote, and content hash. Absence evidence carries the exact search, scope, and zero-hit result. Tool and runtime evidence carry command, tool version, and result provenance.
5. **Secrets never enter the report.** Mask credential values and store only a one-way fingerprint. A live secret may be a Critical finding; the secret itself is never quoted into JSON, MDX, SARIF, chat, or logs.
6. **The substitution test.** A finding or recommendation that remains plausible after swapping in a near-equivalent repository is too generic and is deleted.
7. **Root causes, not leaves.** Cluster repeated symptoms under the root cause and list member sites in evidence.
8. **One owner per concern.** Apply the ownership map in `references/intake.md`. Other domains cross-reference the owning finding and do not score it again.
9. **Independent refutation.** Re-open every candidate citation, trace the relevant execution path, search for guards and framework defaults, and try to disprove the finding. Drop refuted candidates. Weaken or mark unresolved cases Tentative.
10. **Scores are compiled.** Use the catalog weights and runtime compiler. Do not type a score based on judgment. Coverage caps and Critical caps apply after weighted computation.
11. **Every Critical and High closes.** Each open Critical or High finding has a reciprocal remediation task with exact files, acceptance conditions, check ids, and a verification command.
12. **The artifacts stand alone.** Another agent must be able to remediate from AUDIT.json and AUDIT.mdx without this chat.
13. **Compliance is standing.** Load `references/compliance.md` and the applicable policy pack. Hard-stop only prohibited core purposes. Do not turn ambiguous intent into a refusal without one clarifying question.

## Dynamic verification (opt-in)

Static is the default and never runs the product. When the user explicitly authorizes a disposable runtime environment (ground rule 2), godaudits may add a dynamic verification pass that CONFIRMS or REFUTES its behavioral findings against the running app rather than trusting static inference alone. Behavioral findings are the class static reading can suspect but not prove: race conditions and TOCTOU, dead controls that are stored but never read, lifecycle transitions that free a resource early, authorization gaps on a non-primary caller path, and accessibility or consent behavior that only appears at runtime. Each such finding carries a runtime-verification handoff (a route or request sequence with the expected-versus-actual outcome) that an authorized harness runs: the Godpowers `god-browser-tester` (headless browser against a runtime URL) or a project Playwright suite. Runtime confirmation upgrades a Tentative finding to Firm or Certain; refutation drops it. Dynamic verification never runs automatically, never touches production, and its results are recorded as runtime evidence with provenance.

The runtime supports this handoff directly: `godaudits verify-runtime plan AUDIT.json` emits a probe manifest for the behavioral findings, the authorized harness executes the probes and produces a results file, and `godaudits verify-runtime apply AUDIT.json RESULTS.json` folds confirmed and refuted dispositions into a verification report that a re-audit applies. Because AUDIT.json scores are compiled, dispositions are applied on re-audit, never hand-edited.

The runtime serializes independent refutation (ground rule 9) the same way: `godaudits refute plan AUDIT.json` emits one brief per open Critical or High finding carrying the claim, its citation, the owning check, and the expected behavior, with the originating reasoning stripped so a separate pass forms its own view; `godaudits refute apply AUDIT.json RESULTS.json` folds the verdicts (refuted, weakened, no-refutation) into a report a re-audit applies. This extends Phase 4, it does not replace it, and it adds no evidence to a finding: a refuted finding's guard citation may support a strength or the check's pass, never the finding it refuted.

Second opinion: the check catalog has a structural ceiling, it verifies control presence. To find what it would miss, an authorized run may add an unconstrained pass that reads the code fresh, without the catalog's framing, hunting behavioral defects (races, dead controls, early transitions, authorization gaps on non-primary paths) and feeding novel findings back as candidates. Verify each with the same evidence and refutation discipline before recording it. Apply the pass whole, never a sampled subset. Before recording a candidate as novel, search the catalog for a check that already owns the claim: if one exists the candidate is not a discovery but evidence against that check, and it updates that check's outcome in place. A surviving candidate must still route to a weighted owning check in its own domain. A survivor that maps to an already-failing check is a distinct root cause recorded under the ownership map, never a deletion of the existing finding.

## Runtime commands

Commands below use `godaudits`. When it is not on PATH, replace it with `node <skill-directory>/runtime/godaudits.js`.

```bash
godaudits doctor
godaudits evidence . --output .godaudits/EVIDENCE.json
godaudits pillars . --task "TASK" --target PATH
godaudits init --name PROJECT --scale SCALE --profile PROFILE --applicable all --evidence .godaudits/EVIDENCE.json --output .godaudits/AUDIT.json
godaudits validate .godaudits/AUDIT.json --repo . --require-fresh-evidence --write
godaudits render .godaudits/AUDIT.json --output .godaudits/AUDIT.mdx
godaudits sarif .godaudits/AUDIT.json --output .godaudits/AUDIT.sarif
godaudits import-sarif scanner.sarif --output .godaudits/TOOL-EVIDENCE.json
godaudits diff .godaudits/archive/AUDIT-v1.json .godaudits/AUDIT.json
godaudits evaluate .godaudits/AUDIT.json expected.json
```

The runtime never decides whether a signal is a finding. `EVIDENCE.json` contains deterministic inventory leads and absence records. `import-sarif` converts scanner results into secret-safe tool evidence without creating findings. Domain passes trace, interpret, and refute both sources.

## Method

Run every phase in order. A phase that does not apply still gets a disposition in the audit trail.

### Phase 0: Orient and select capabilities

Read the mode-detection section of `references/intake.md`.

- `.godaudits/AUDIT.json` exists -> re-audit.
- Source exists and no audit state exists -> fresh audit.
- No source -> refuse and point to godplans.
- `.godplans/PLAN.mdx` exists -> add the plan-aware overlay.
- User names domains -> focused audit. Every domain still gets an applicability row; domains outside the requested focus are excluded with that exact reason.

Record the commit, runtime and pack versions, selected capabilities, tool versions, assumptions, and constraints. Run `godaudits doctor`. If Node is unavailable, continue manually but mark deterministic validation unavailable and every affected check unknown. Never claim full coverage in degraded mode.

### Phase 1: Compliance gate

Read `references/compliance.md` and the selected policy pack under `policies/`.

- Prohibited core purpose -> name the policy category and stop.
- Legitimate product with policy-risk code -> continue and inject `F-CMP-n` findings with mandatory tasks.
- Pass -> record one line and continue.

Policy packs are versioned evidence, not timeless truth. On compliance-sensitive audits, verify the current primary policy text when network access is authorized. Otherwise record the policy snapshot and confidence.

### Phase 2: Deterministic intake and evidence

Read `references/intake.md` fully. Run the static fingerprint command before domain judgment. Review `.godaudits/EVIDENCE.json`; it inventories manifests, lockfiles, languages, files and hashes, high-signal source locations, absence evidence, six-form routing, product and industry overlays, regulatory candidates, arc-ready artifacts, Pillars 1.1 state, compatibility archetype inference, and limitations. Treat Pillars paths as repository-relative. Arc artifact freshness uses Git history when available and an explicit filesystem fallback otherwise; prepublication may bind hardening by content SHA-256 or Git revision.

Complete the primary and secondary project forms, product and industry overlays, regulatory candidates, compatibility archetype, scale calibration, risk profile, applicability matrix, ownership map, and assumptions. A regulatory candidate never establishes legal applicability without verification. Use `balanced` by default, `security-critical` for regulated data, money, identity, privileged actions, or multi-tenancy, `growth` for public conversion and visibility surfaces, and `library` for libraries and developer tools. Ask at most one batch of 0 to 3 questions only when the repository cannot answer and the answer changes applicability or severity.

Initialize AUDIT.json after intake. For focused audits, pass the comma-separated applicable domains instead of `all`. Initialization creates the complete catalog ledger with every selected check marked unknown.

### Phase 3: Domain passes and check ledger

For each applicable domain, in this order, read its module at the moment of use and evaluate every listed check:

| Order | Domain | Module |
|---|---|---|
| 1 | Product reality | `references/product.md` |
| 2 | Architecture | `references/architecture.md` |
| 3 | Stack | `references/stack.md` |
| 4 | Database | `references/database.md` |
| 5 | Security | `references/security.md` |
| 6 | LLM integration | `references/llm.md` |
| 7 | UX | `references/ux.md` |
| 8 | UI | `references/ui.md` |
| 9 | SEO and AI visibility | `references/seo.md` |
| 10 | Code quality | `references/code-quality.md` |
| 11 | Style genome | `references/style-genome.md` |
| 12 | Agent memory | `references/agent-memory.md` |
| 13 | Repository | `references/repo.md` |
| 14 | Build completeness | `references/build.md` |
| 15 | Roadmap and delivery | `references/roadmap.md` |
| 16 | Deployment | `references/deploy.md` |
| 17 | Observability | `references/observe.md` |
| 18 | Launch readiness | `references/launch.md` |

For each check, update its outcome, confidence, evidence references, and finding ids. Preserve the catalog-provided weight. A routing check with zero direct weight must map its finding to the weighted owning check it affects. In plan-aware mode, add the corresponding R-id to finding and task traceability.

### Phase 4: Adversarial verification and clustering

For every candidate finding:

1. Re-open the exact evidence and confirm its content hash or record why the file changed.
2. Trace from entry point to sink or enforcement point.
3. Search for alternate guards, dead-code status, fixtures, generated code, framework defaults, and compensating controls.
4. Refute with a second evidence path where possible.
5. Drop, downgrade, or mark Tentative when the claim does not survive.
6. Cluster survivors by root cause and apply the ownership map.

Critical and High findings should have two independent evidence paths when the repository permits it. If they do not, confidence cannot be Certain.

Certainty costs corroboration in both directions. A Certain pass on a weighted
check also requires two independent evidence paths, because a clean bill of
health is not cheaper to assert than an alarm: it is the more dangerous error.
Two quotes from the same file are one method, not two. When a pass rests on a
single read, record it as Firm or Tentative rather than Certain.

### Phase 5: Compile scores and coverage

Read `references/exemplar.md`. Run `godaudits validate .godaudits/AUDIT.json --write`.

The compiler derives check coverage, per-domain scores, overall weighted score, verdict, finding counters, task counters, and caps. Failed checks receive deterministic severity factors. Unknown checks do not enter the quality numerator and lower coverage. Coverage below 95 prevents an audit-proof verdict; below 80 caps at needs-work territory; below 60 caps at 69. Active Critical findings, including accepted risks, cap their domain at 69 and the overall at 79. A domain below 50 caps the overall at 84.

Validation blocks on missing catalog checks, unknown ids, wrong weights, missing or unredacted evidence, credential-shaped values outside redacted evidence, broken finding-task reciprocity, unsafe parallel file overlap, task cycles, incomplete final-gate dependencies, expired risks, ownerless compliance unknowns, or stale pack versions.

### Phase 6: Remediation plan

Convert findings into GA-numbered tasks in AUDIT.json:

- Phase 1: Stop the bleeding, every Critical.
- Phase 2: Quick wins, High or Medium with S effort.
- Phase 3: Plan now, structural M or L work.
- Phase 4: Verify first, Tentative findings whose first acceptance condition confirms the claim.
- Phase 5: Backlog, Low findings worth retaining.
- Final phase: Re-audit, dependent on every active remediation task.

Every task carries files, dependencies, reuse guidance, reciprocal finding ids, 2 to 4 acceptance conditions, one exact Verify command, and check ids. Accepted risks require finding id, named owner, acceptance date, expiry date, and review command.

When a finding's evidence lists three or more member sites, its task fixes the class, not the leaves: enforcement lands at one shared point (a central mount, a query builder, a schema constraint, a lint rule, or a CI gate) named in `reuses`, and one acceptance condition is a regression guard that fails when a new sibling site appears. A Phase 3 task that changes system shape, a module boundary, a storage shape, or an authorization model adds an acceptance condition that it write or update an in-repo ADR recording the rejected alternatives, with a Verify that greps for that record.

### Phase 7: Render and present

Run validation again, then render MDX and optional SARIF. Do not hand-edit the rendered files.

Present in chat: verdict, score and coverage, scorecard, top three risks, top three strengths, quick wins, finding and task counts, and the exact artifact paths. The artifacts are the deliverable.

### Phase 8: Evaluate the auditor when ground truth exists

When a benchmark manifest, prior human audit, or seeded fixture is available, run `godaudits evaluate`. Report recall, precision, severity accuracy, citation validity, remediation closure, clean-control rate, misses, and false positives. The repository's built-in corpus is a runtime regression gate; it is not evidence that a model audit is accurate on an unseen project.

## Modes

- **Fresh audit**: full method at a new commit.
- **Re-audit**: preserve ids and history, update check outcomes, resolve findings with evidence, add new ids only, compile both versions, and run `godaudits diff`.
- **Focused audit**: only requested domains are applicable; all others carry a scope-specific exclusion. Never present a focused score as a full-project score.
- **Plan-aware overlay**: conformance checks run inside every domain and carry matching R-ids.
- **Static capability**: default and always available.
- **Sandbox capability**: explicit user authorization, disposable environment, no outbound network or production secrets.
- **Connected capability**: explicitly authorized read-only external evidence with connector, query, timestamp, and provenance recorded.

## What godaudits refuses

- Scores without a complete check ledger and reported coverage.
- Pass outcomes without evidence.
- Findings with invented or unreproducible citations.
- Secret values copied into artifacts or chat.
- Static predictions presented as runtime facts.
- Vague findings, duplicate root causes, or inflated severity.
- Critical or High findings without reciprocal remediation tasks.
- Hand-edited computed scores, counters, MDX, or SARIF.
- Silent module skipping or compact-prompt full audits without the domain modules.
- Source mutation during the audit, unless the user separately asks for remediation after the audit is complete.

## File map

| File | Role |
|---|---|
| `SKILL.md` | Orchestrator and operating contract |
| `references/intake.md` | Mode, fingerprint interpretation, applicability, weights, ownership |
| `references/audit-format.md` | AUDIT.json, evidence, finding, task, scoring, and rendering contract |
| `references/compliance.md` | Compliance gate and account-safety rules |
| `references/exemplar.md` | Worked quality bar |
| `references/<domain>.md` | 18 domain modules |
| `catalog/checks.json` | Generated 431-check machine catalog with scoring and standards metadata |
| `catalog/project-context.json` | Six forms, 37 arc-ready profiles, overlays, and artifact paths |
| `schemas/*.json` | Audit, evidence, and benchmark schemas |
| `runtime/godaudits.js` | Self-contained zero-dependency CLI |
| `runtime/lib/` | Catalog, evidence, compiler, renderer, SARIF, diff, and evaluation engine |
| `policies/` | Versioned provider-neutral and provider-specific policy packs |
| `templates/AUDIT.template.mdx` | Human-readable shape of the generated report |

## Skill version: 2.11.0
