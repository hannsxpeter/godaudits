# Stack audit module

Audits whether the technology bundle actually in the repo is coherent, alive, constraint-honest, and traceable to a recorded decision. It runs the stack-ready disciplines forward against manifests, lockfiles, and import sites instead of against a proposal, and feeds findings `F-STACK-n` and a 0-100 domain score (weight 4 per `intake.md`) into AUDIT.mdx. The orchestrator loads this module for every archetype whose repo carries a dependency manifest; the only legitimate exclusion is a repo with no manifests and no dependency surface at all (pure content or data repos), with that reason recorded in the applicability matrix. In plan-aware mode every check also cites its `R-STACK-n` twin from `.godplans/PLAN.mdx`.

## Lineage

Descends from stack-ready (ready-suite, planning tier) through the godplans stack module. The disciplines that carry into audit time: hard constraints beat scores (a stated constraint contradicted by config is a finding regardless of how good the tool is); the honesty triple (flip point, scale ceiling as a metric, switching cost in engineer-weeks) is demanded of any decision record found on disk; the anti-pairing walk (one ORM, one auth provider, one design system, one client cache, one job queue) becomes a manifest grep; and stack-ready's have-nots list (dead libraries, phantom versions, free-tier mirage, ops-cost amnesia, undated recommendations) converts directly into hunting targets. The skip-the-rigor guard carries over too: this module never punishes a compact, experience-backed record for lacking ceremony.

## Surface map

Inventory before any check runs: manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `mix.exs`, `pom.xml`, `Package.swift`, monorepo workspaces); lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `uv.lock`, `Cargo.lock`, `Gemfile.lock`); runtime pins (`engines`, `.nvmrc`, `.tool-versions`, Dockerfile base images, CI setup steps); hosting and region config (`fly.toml`, `vercel.json`, `render.yaml`, `serverless.yml`, Terraform provider blocks); self-hosted services in `docker-compose*.yml` and IaC; decision artifacts (`.stack-ready/DECISION.md`, `docs/adr/`, `docs/stack/`); import sites for every framework-class dependency. The intake fingerprint already records stack, versions, monorepo layout, and contributor count: cite it, do not re-scan. Declare two conditional sub-surfaces present or absent, with the reason recorded: the decision record (absent collapses roughly half the checks into one finding) and a migration in flight (dual-run code or allowlisted duplicate categories; absent drops the migration dimension from scoring).

## Checks

Mirrors `R-STACK-1` through `R-STACK-20` one to one; `A-STACK-21` onward are audit-only. Severities are funded-product calibration; scale per `intake.md`.

1. **A-STACK-1 Inventory truth.** Rebuild the stack inventory from manifests and import sites; compare against any recorded verdicts.
   Look: intake fingerprint; `.stack-ready/DECISION.md`, `docs/stack/inventory.md`; plan-aware: the plan's keep/adjust/replace labels.
   Fail: recorded inventory or plan verdicts contradict the code (a "replaced" tool still imported, a "kept" tool gone). Medium.
2. **A-STACK-2 Pre-flight basis on record.** The six pre-flight answers (domain, team, budget posture, time-to-ship, scale ceiling, regulatory statement) exist somewhere durable in the repo.
   Look: `.stack-ready/DECISION.md`, `docs/adr/*stack*`, architecture notes; plan-aware: the plan's stack section.
   Fail: no recorded basis for the stack anywhere. Medium at funded-product, Low below.
3. **A-STACK-3 Constraints honored in code.** Every stated hard constraint traces into config.
   Look: residency and compliance statements in the record vs regions pinned in `fly.toml`, `vercel.json`, `serverless.yml`, Terraform; self-host mandates vs managed-only SDK imports.
   Fail: config contradicts a stated hard constraint (EU residency claimed, `us-east-1` pinned). High.
4. **A-STACK-4 Twelve dimensions accounted for.** Framework, language/runtime, database, ORM, auth, UI library, client data layer, hosting, observability, payments, email, background jobs: each served by exactly one identifiable tool or a recorded "not needed because X".
   Look: manifest dependencies plus import sites; exclusion notes in the record.
   Fail: a live dimension (auth, jobs, observability) served by nothing and excluded nowhere, or hand-rolled where the record names a tool. Medium.
5. **A-STACK-5 Losers recorded.** Decided dimensions name at least one rejected alternative with a reason.
   Look: rejected-alternatives section of the record or ADRs.
   Fail: decisions with zero named losers. Low. When no record exists at all, fold into the A-STACK-2 finding; never bill twice.
6. **A-STACK-6 Weights published.** Any scored comparison in the record prints its weight vector.
   Look: weighting section next to the scored bundle table.
   Fail: scores present, weights absent (fake objectivity). Low.
7. **A-STACK-7 Score rationale.** Scores carry a one-line rationale; no unexplained 10, no sub-3 without a named failure mode.
   Look: the record's per-dimension score table.
   Fail: bare numbers or capped scores without justification. Low.
8. **A-STACK-8 Pairing coherence.** Exactly one occupant per single-slot category; no known-bad pairs.
   Look: manifest deps for `prisma` plus `drizzle-orm`, `convex` plus `prisma`, `@clerk/*` plus `next-auth` or `better-auth`, `@mui/material` plus a shadcn tree, `@tanstack/react-query` plus `swr`, two job queues, two design systems.
   Fail: duplicate slot or known-bad pair with both sides imported. High. Intentional migration dual-runs route to A-STACK-19 instead.
9. **A-STACK-9 Flip point.** The record names the concrete signal that would reverse the bundle choice.
   Look: flip-point paragraph in the record; plan-aware: the plan's stack section.
   Fail: absent, "none", or a restated benefit. Medium (horoscope stack).
10. **A-STACK-10 Ceiling as metric.** The scale ceiling is a number or named boundary, not an adjective.
    Look: the record's ceiling statement vs signals in code (tenant count assumptions, pagination limits).
    Fail: "scales well" or silence. Low.
11. **A-STACK-11 Switching cost.** The rebuild bill for leaving the bundle is stated in engineer-weeks with the dominant driver named.
    Look: switching-cost section of the record.
    Fail: absent or unitless. Low.
12. **A-STACK-12 Prior art.** Novel or minority picks carry named comparable deployments with dates.
    Look: prior-art section; flag components outside consensus for the archetype.
    Fail: a novel component with no prior-art note and no hypothesis flag. Low.
13. **A-STACK-13 Compliance and ops fit.** Regulated-path managed vendors show documentation status; self-hosted stateful services name an operator.
    Look: `docs/compliance/vendors.md`, the record; managed SDKs in deps on paths the security pass classified as regulated; stateful services in `docker-compose*.yml` or IaC.
    Fail: regulated-path vendor with no BAA/SOC 2/PCI status recorded, High; self-hosted stateful service with no named operator or runbook, Medium. The regulated-data classification itself belongs to security: cross-reference the F-SEC finding per the ownership map.
14. **A-STACK-14 Liveness and version reality.** Pinned versions exist; direct dependencies are maintained.
    Look: manifest pins vs the registry; source repos of direct deps for archive status and last commit.
    Fail: a pinned version that does not exist (install breaks), High; a direct dep archived or silent over 18 months, Medium, last-commit date quoted in Evidence.
15. **A-STACK-15 Cost realism.** The cost posture in config matches the product's scale.
    Look: hosting tier in `fly.toml`, `vercel.json`, `render.yaml`; cost model in the record including egress, seats, and the free-tier cliff.
    Fail: funded-product running on hobby or free tiers with no recorded cliff plan, Medium; no cost model at all, Low.
16. **A-STACK-16 Date and staleness trigger.** The decision is dated and carries a re-check condition.
    Look: date stamp and re-check line in the record.
    Fail: undated or trigger-free. Low. A record over 12 months old holding auth, AI tooling, or hosting picks (the fastest churners) earns the finding a staleness note.
17. **A-STACK-17 Decision artifact complete.** `.stack-ready/DECISION.md` or an equivalent ADR set carries pre-flight, constraints, weights, scored bundle, runner-up, flip point, ceiling, switching cost, and rejected bundles.
    Look: `.stack-ready/DECISION.md`, `docs/adr/`.
    Fail: absent or gutted. Medium. When wholly absent, emit one finding citing A-STACK-2, 5, 6, 7, 9-12, and 17 together.
18. **A-STACK-18 Open questions owned.** Recorded stack unknowns carry an owner, a due date, and a default.
    Look: open-questions section of the record or plan.
    Fail: orphan questions, or committed decisions restated as questions (an ORM already imported in twenty files still listed as "Prisma or Drizzle?"). Low.
19. **A-STACK-19 Migration discipline.** Any dual-run in flight has an end condition, per-phase rollback checkpoints, and reconciliation.
    Look: dual-write code paths, flags gating two stores, allowlisted duplicate categories, `docs/migration/*`.
    Fail: dual-run present in code with no end condition, no rollback checkpoint per phase, or no reconciliation job. High.
20. **A-STACK-20 Rigor proportionality.** A compact record naming a previously shipped identical bundle satisfies A-STACK-5 through A-STACK-7 in full.
    Look: prior-deployment line in a compact record.
    Fail: only when the compact record names no prior deployment. Low. Never demand full scoring tables from an experience-backed repeat pick; that demand is itself the paralysis failure mode.
21. **A-STACK-21 Phantom stack members (audit-only).** Framework-class dependencies with zero call sites.
    Look: heavyweight deps (`langchain`, `@aws-sdk/*`, ORMs, queue clients, analytics SDKs) vs `grep -r` import results across `src/`.
    Fail: installed but never imported. Medium. Per `intake.md`, an LLM library with no call site is this finding, not an llm-domain pass.
22. **A-STACK-22 Runtime version coherence (audit-only).** Declared runtime versions agree everywhere.
    Look: `engines` in `package.json`, `.nvmrc`, `.tool-versions`, Dockerfile base tags, CI setup steps such as `actions/setup-node`.
    Fail: any two sources disagree on major.minor. Medium.
23. **A-STACK-23 Lockfile discipline (audit-only).** One package manager, one lockfile, committed.
    Look: count of `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` (and ecosystem equivalents); `.gitignore` entries hiding lockfiles.
    Fail: application repo with no lockfile, High; two managers' lockfiles coexisting, Medium.
24. **A-STACK-24 Runtime EOL (audit-only).** The pinned language runtime is inside its support window.
    Look: runtime pins vs published EOL dates (Node LTS, Python, Ruby, Go release policy).
    Fail: runtime past EOL, High; within 3 months of EOL with no upgrade note, Low. Exploitable CVEs in dependencies belong to security: cross-reference F-SEC.

## Scoring

Weighted dimensions summing to 100. Derived from the godplans stack module's self-audit rubric, reweighted toward what code can prove: hygiene and coherence are directly greppable, so they carry what the plan-side rubric gave to scoring ceremony.

| Dimension | Weight | Checks |
|---|---|---|
| Bundle coherence | 25 | A-STACK-4, A-STACK-8, A-STACK-21, A-STACK-23 |
| Dependency and runtime hygiene | 25 | A-STACK-14, A-STACK-22, A-STACK-24 |
| Decision record and honesty triple | 20 | A-STACK-2, 5, 6, 7, 9, 10, 11, 12, 16, 17, 18, 20 |
| Constraint and compliance fit | 15 | A-STACK-1, A-STACK-3, A-STACK-13 |
| Cost realism | 8 | A-STACK-15 |
| Migration discipline (conditional) | 7 | A-STACK-19 |

Migration discipline applies only when a migration is in flight; when the sub-surface is absent, drop it and re-normalize the rest to 100. Any open Critical finding caps this domain at 69.

## Remediation seeds

- [ ] GA-xxx Remove the duplicate single-slot dependency
  - Files: package.json, src/db/client.ts
  - Acceptance: exactly one dependency matches each single-slot category (ORM, auth, design system, client cache, job queue); the loser's imports are migrated to the survivor; lockfile regenerated
  - Verify: `bash scripts/check-pairing.sh`
  - Checks: A-STACK-8, A-STACK-4
- [ ] GA-xxx Reconstruct the stack decision record from the code
  - Files: .stack-ready/DECISION.md
  - Acceptance: record carries the six pre-flight answers, hard constraints, weights, flip point, ceiling as a metric, switching cost in engineer-weeks, decision date, and re-check trigger; contents derived from actual manifests and configs, not aspiration
  - Verify: `grep -q 'Flip point' .stack-ready/DECISION.md && grep -q 'Switching cost' .stack-ready/DECISION.md`
  - Checks: A-STACK-2, A-STACK-9, A-STACK-10, A-STACK-11, A-STACK-16, A-STACK-17
- [ ] GA-xxx Replace the archived dependency
  - Files: package.json, src/lib/http.ts
  - Acceptance: the archived dependency is removed; the replacement shows a commit within 18 months; every call site migrated; tests green
  - Verify: `npm test`
  - Checks: A-STACK-14
- [ ] GA-xxx Align runtime versions across manifest, CI, and Docker
  - Files: .nvmrc, Dockerfile, .github/workflows/ci.yml, package.json
  - Acceptance: `engines`, `.nvmrc`, the Dockerfile base tag, and the CI setup step all resolve to the same major.minor; one file is named the source of truth in a comment
  - Verify: `node scripts/check-runtime-versions.mjs`
  - Checks: A-STACK-22
- [ ] GA-xxx Converge on one package manager
  - Files: pnpm-lock.yaml, package-lock.json, .github/workflows/ci.yml
  - Acceptance: exactly one lockfile remains and is committed; CI installs with the surviving manager using a frozen-lockfile flag; the losing lockfile is deleted, not ignored
  - Verify: `test $(ls package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null | wc -l) -eq 1`
  - Checks: A-STACK-23
- [ ] GA-xxx Close out the dual-run migration
  - Files: docs/migration/rollback-checkpoints.md, src/data/dual-write.ts
  - Acceptance: every migration phase names its rollback checkpoint and cutover condition; the dual-run allowlist entry carries an expiry date; a reconciliation job compares row counts and checksums between stores
  - Verify: `grep -c 'Rollback checkpoint' docs/migration/rollback-checkpoints.md`
  - Checks: A-STACK-19

## Anti-patterns hunted

- **Horoscope stack.** A decision record full of benefits with no flip point, no metric ceiling, no switching cost. Hunt: grep the record for those three sections; absence of all three is one Medium finding under A-STACK-9 with 10 and 11 cited.
- **Two-of-everything.** Starter-template residue: two auth providers, two cache layers, two ORMs quietly coexisting. Hunt: the A-STACK-8 category walk over manifests; both sides imported makes it High.
- **Dead-library ballast.** Direct deps whose repos are archived or 18 months silent. Hunt: liveness check per A-STACK-14; quote the last-commit date, never just "outdated".
- **Phantom version.** A manifest pin that resolves to nothing; installs work only from a stale lockfile. Hunt: resolve every direct pin against the registry.
- **Free-tier mirage.** Funded product, hobby tier in `fly.toml` or `vercel.json`, no cliff plan on record. Hunt: A-STACK-15 against the intake scale calibration.
- **Ops-cost amnesia.** Self-hosted Postgres or Redis in production compose files with no named operator, no runbook. Hunt: stateful images in deploy-path IaC per A-STACK-13.
- **Resume-driven stack.** An exotic component with no prior art, no forcing function, no hypothesis flag. Hunt: A-STACK-12 against archetype consensus; name the component, not the vibe.
- **Microservices for two.** Multiple deployable services against a contributor count under three from the fingerprint, no recorded forcing function. Hunt: service count vs `git shortlog -sn`; file as Medium under A-STACK-4 evidence.
- **Vague finding.** "Dependencies are outdated" with no names. Refused: every stack finding quotes the dependency, the version, and the date that condemns it.
- **Double-billing.** Injection is F-SEC, N plus 1 queries are F-DB, secrets in CI are F-SEC, schema shape is F-DB. Refused: this module audits the choice and health of tools, not their misuse; cross-reference per the ownership map.
- **Severity inflation.** A missing weight vector or an undated record is paperwork, not breakage. Refused: record-hygiene checks default Low; only contradicted constraints, broken installs, incoherent bundles, and unmanaged dual-runs reach High.
