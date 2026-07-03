# Deploy audit module

Audits the shipping mechanics actually wired into the repo: whether a build reaches production the same way twice, whether promotion is a promotion or a per-environment rebuild, whether rollback is real or theater, and whether schema changes ship on an expand/contract calendar or in one lock-taking cutover. It runs the deploy-ready disciplines forward against workflows, deploy configs, migration files, and health endpoints instead of against a plan, and feeds findings `F-DEPLOY-n` and a 0-100 domain score (weight 6 per `intake.md`) into AUDIT.mdx. The orchestrator loads this module for any archetype that runs a service users hit (saas-dashboard, api-service, marketing-site with a server, ml-pipeline serving, mobile-app backend). Library and local-only cli archetypes exclude it with the reason "distribution is packaging and release, not deployment"; extension archetypes reduce it to store publishing. Every exclusion is recorded in the applicability matrix. In plan-aware mode every check also cites its `R-DEPLOY-n` twin from `.godplans/PLAN.mdx`.

## Lineage

Descends from deploy-ready (ready-suite, shipping tier) through the godplans deploy module, built on the principle that what rolls back is code, not data. The disciplines that carry into audit time: same-artifact promotion (one hermetic build, one content hash, never rebuilt per environment) becomes a workflow grep; the reversible-vs-data-forward change classification becomes a hunt for "redeploy previous image" written next to schema migrations; expand/contract as a multi-deploy calendar becomes an inspection of migration files for single-cutover DDL; the paper-canary four-field rule (metric, threshold, window, automated trigger) becomes a test applied to every canary claim found on disk; the Mode-A cold-start gates and the eight-gate pipeline become presence checks against workflow job graphs; and deploy-ready's have-nots list converts one for one into the hunting targets below, its severity conventions intact.

## Surface map

Inventory before any check runs: CI/CD workflows (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`); platform deploy configs (`fly.toml`, `vercel.json`, `render.yaml`, `netlify.toml`, `Procfile`, `serverless.yml`, `app.yaml`); Dockerfiles and `docker-compose*.yml`; Kubernetes manifests and Helm charts (`k8s/`, `charts/`, files carrying `kind: Deployment`); IaC (`*.tf`, CDK, Pulumi); migration directories (`migrations/`, `prisma/migrations/`, `db/migrate/`, `alembic/versions/`); health endpoint handlers (routes matching `/health`, `/ready`, `/healthz`, plus `readinessProbe` and `livenessProbe` blocks); feature flag definition sites; deploy docs and state (`.deploy-ready/`, `docs/deploy/`, incident logs). The intake fingerprint already records CI/CD workflows, Dockerfiles, IaC, and deploy configs: cite it, do not re-scan. Declare three conditional sub-surfaces present or absent, with the reason recorded: the data-forward surface (no migrations and no schema drops the migration dimension from scoring), progressive-delivery infrastructure (its absence makes any canary claim paper by definition), and deploy history (tags, releases, environment references: first-deploy repos bind hard on the checklist checks, established repos bind hard on rehearsal and incident checks).

## Checks

Mirrors `R-DEPLOY-1` through `R-DEPLOY-18` one to one; `A-DEPLOY-19` onward are audit-only. Severities are funded-product calibration; scale per `intake.md`.

1. **A-DEPLOY-1 Same-artifact promotion.** One build step produces one content-addressed artifact promoted unchanged; per-region platform rebuilds record a source commit and build config pin as the artifact identity.
   Look: deploy workflows; count `docker build` and bundler build invocations; build steps inside promote jobs; image tags (digest or SHA vs branch names).
   Fail: the pipeline rebuilds per environment, or promotes with no pinned identity. High.
2. **A-DEPLOY-2 Artifact and config separation.** The artifact carries no environment-specific values and no build-time secrets.
   Look: Dockerfile `ARG`, `ENV`, and `COPY` of `.env` files; build args named like credentials; per-environment bundles baking `API_URL` at build time.
   Fail: env-specific values or secrets baked into the artifact. High. Secret literal values in git or CI belong to security: cross-reference F-SEC.
3. **A-DEPLOY-3 Change classification discipline.** Shipped changes are classified reversible, data-forward, mixed, or side-effectful somewhere durable.
   Look: PR template, deploy docs, `.deploy-ready/` state; plan-aware: the plan's per-task change classes against what actually shipped.
   Fail: the repo ships migrations and side-effectful code (email sends, payment captures) with no classification convention anywhere. Medium.
4. **A-DEPLOY-4 Class-matched rollback artifacts.** Reversible changes carry a revert command with time-to-revert; data-forward changes carry a compensating-forward plan plus restore point; side-effectful changes carry idempotency guards.
   Look: `docs/deploy/rollback.md`, `.deploy-ready/rollback.md`, runbooks; idempotency keys at webhook and payment call sites.
   Fail: "rollback: redeploy previous image" adjacent to a schema migration, High; a deployed product with no rollback doc at all, High.
5. **A-DEPLOY-5 Expand/contract calendar.** Data-forward changes decompose into expand, migrate, cutover, and contract as separate deploys.
   Look: migration files for single-migration rename or drop-and-replace; `docs/deploy/migration-calendar.md`, `.deploy-ready/migrations/`.
   Fail: expand and contract in one migration on a populated table, High; expand shipped, contract unscheduled, no expand-only-by-design reason, Medium.
6. **A-DEPLOY-6 Migration guardrail forms.** Migrations on populated tables use the lock-safe forms.
   Look: `migrations/**` for single-step `NOT NULL`, `ALTER COLUMN` type changes, `CREATE INDEX` without `CONCURRENTLY`, missing `lock_timeout` and `statement_timeout`, backfills inside the DDL transaction, renames of columns still read by running code.
   Fail: any form taking an ACCESS EXCLUSIVE lock on a populated table, High. Schema shape and transaction correctness belong to database: cross-reference F-DB; this check owns lock behavior at deploy time only.
7. **A-DEPLOY-7 Promotion ladder and parity.** The rungs from build to prod are named, each with five parity properties: traffic source, data source, scale, flag defaults, observability reach.
   Look: `environment:` keys in workflows, per-environment platform config, `docs/deploy/topology.md`.
   Fail: multiple environments in workflows with no parity documentation anywhere, Medium; a funded product deploying straight to prod with no non-prod rung, High.
8. **A-DEPLOY-8 Eight gates in order.** Build, test, artifact security scan, promote non-prod, promote staging, approval, promote prod, post-deploy verification.
   Look: deploy workflow job graph and `needs:` edges; scan steps (trivy, grype, secret scan) pointed at the artifact, not just the source.
   Fail: a single job that builds, tests, and deploys on push to main, High; no artifact scan gate, Medium. Test existence itself is repo territory: cross-reference F-REPO.
9. **A-DEPLOY-9 Approval by mechanism.** Shipping to prod is a choice enforced by tooling, never a side effect of committing.
   Look: `environment:` with a protection rule, tag-triggered or `workflow_dispatch` prod deploys, deploy-marker conventions for solo builders.
   Fail: prod deploy fires on every push to main with no protection rule and no distinct second action. High.
10. **A-DEPLOY-10 Secrets path and identity split.** Runtime-only injection; least-privileged runtime identity distinct from the deploy identity.
    Look: `pull_request_target` with fork checkout and secret access; secret-shaped literals in workflow YAML; deploy credentials on a personal access token; IaC where the runtime role equals the deploy role.
    Fail: `pull_request_target` untrusted checkout with secrets, Critical; PAT-on-personal-account credential or no identity split, High. Leaked secret values are F-SEC: cross-reference, never re-bill.
11. **A-DEPLOY-11 Rollout strategy and the four-field canary.** Strategy named per change; every canary carries a named metric, numeric threshold, bounded window, and automated rollback trigger.
    Look: rollout config (`strategy:` blocks, Argo Rollouts, Flagger, `bluegreen` in `fly.toml`); canary claims in docs and job names vs wired analysis steps.
    Fail: canary claimed with any of the four fields missing, High (paper canary); an untested change reaching 100 percent of user traffic in one uniform step, Medium. The metric pipeline itself belongs to observe: cross-reference F-OBS.
12. **A-DEPLOY-12 Cold-start evidence.** First deploys to an environment walk the ten-gate checklist: reachability, DNS, TLS validity over 30 days, migrations through expand, env vars set, IAM role, registry pull, truthful healthcheck, logs reaching the env, rollback dry-run.
    Look: `docs/deploy/cold-start-*.md`, `.deploy-ready/` checklists; environments newly added to workflows.
    Fail: a new environment appears in workflows with no cold-start record, Medium; no checklist artifact on a pre-first-deploy repo, Low.
13. **A-DEPLOY-13 Truthful readiness probe.** The probe fails while a critical dependency is down; never 200-on-bind.
    Look: handlers behind `/health`, `/ready`, `/healthz`; whether the body exercises the database or a critical dependency; `readinessProbe` targets in manifests.
    Fail: an unconditional 200 handler wired as the readiness probe in a service with a database. High.
14. **A-DEPLOY-14 Flag lineage.** No flag name is reused until the old code path behind it is confirmed removed.
    Look: flag definition sites and provider config; git history of flag names; dormant code behind long-lived flags.
    Fail: a reused flag name whose prior gated code path still exists in the tree (the Knight Capital shape). High.
15. **A-DEPLOY-15 Post-deploy verification.** Prod deploys are followed by healthcheck, a latency and error-rate window of at least 15 minutes, a critical-path smoke run, and contract scheduling when an expand shipped.
    Look: workflow steps after the prod deploy step: smoke jobs, `curl -sf` polls, verification scripts.
    Fail: a prod deploy job with zero verification steps after it. Medium.
16. **A-DEPLOY-16 Rehearsal and incident log.** Revert commands run against a non-prod copy within 90 days of first deploy; every rollback or close call writes an incident file.
    Look: rehearsal timestamps in rollback docs; `.deploy-ready/incidents/`, `docs/incidents/`.
    Fail: a product deployed over 90 days (per tags and releases) with no rehearsal evidence and no incident log location. Medium.
17. **A-DEPLOY-17 Handoff artifacts.** Topology doc, healthcheck inventory, per-service rollback doc, and migration calendar exist and agree with the workflows.
    Look: `docs/deploy/`, `.deploy-ready/`; environment names in docs vs environment names in workflows.
    Fail: a deployed product carrying none of the four, Medium (one finding listing every gap); docs contradicting the workflows, Medium with both sides quoted.
18. **A-DEPLOY-18 Destructive command gating.** `terraform destroy`, `kubectl delete`, `prisma migrate reset`, and `rm -rf` never reach production without explicit confirmation and a named, verified restore point.
    Look: workflows and `scripts/**` for destructive commands in prod contexts; `--force` and `--auto-approve` flags on deploy paths.
    Fail: a destructive command reachable against a production resource without a confirmation gate and named backup. Critical.
19. **A-DEPLOY-19 Rollback targetability (audit-only).** Production references immutable artifact identities so the previous version is always addressable.
    Look: `image:` tags in manifests and deploy steps; `:latest` or branch-name tags on prod paths; registry retention notes.
    Fail: prod deploy pinned to `:latest` or another mutable tag. High (rollback has no target).
20. **A-DEPLOY-20 Deploy concurrency control (audit-only).** Two merges cannot interleave deploys to the same environment.
    Look: `concurrency:` groups on deploy workflows; queue or lock mechanisms in deploy scripts.
    Fail: a prod deploy workflow with no concurrency group or equivalent lock. Medium.
21. **A-DEPLOY-21 Pipeline-as-code reality (audit-only).** The deploy path lives in the repo and changes to it are reviewed like code.
    Look: deploy workflows and configs present vs deployment evidence (prod URL in README, releases, badges) with no deploy path on disk.
    Fail: a demonstrably deployed product whose only deploy path is click-ops. High.

## Scoring

Weighted dimensions summing to 100. Derived from the godplans deploy module's self-audit rubric, extended only where audit-only checks join an existing dimension.

| Dimension | Weight | Checks |
|---|---|---|
| Artifact and promotion integrity | 20 | A-DEPLOY-1, A-DEPLOY-2, A-DEPLOY-19 |
| Rollback truth per change class | 20 | A-DEPLOY-3, A-DEPLOY-4, A-DEPLOY-16, A-DEPLOY-18 |
| Migration calendar and guardrails (conditional) | 20 | A-DEPLOY-5, A-DEPLOY-6 |
| Rollout rigor | 15 | A-DEPLOY-11, A-DEPLOY-13, A-DEPLOY-14 |
| Pipeline gates and secrets | 15 | A-DEPLOY-7, A-DEPLOY-8, A-DEPLOY-9, A-DEPLOY-10, A-DEPLOY-20, A-DEPLOY-21 |
| First-deploy and post-deploy discipline | 10 | A-DEPLOY-12, A-DEPLOY-15, A-DEPLOY-17 |

Migration calendar and guardrails applies only when the data-forward surface is present; when the repo carries no migrations and no schema, drop it and re-normalize the rest to 100. Any open Critical finding caps this domain at 69.

## Remediation seeds

- [ ] GA-xxx Collapse per-environment rebuilds into one build plus promotes
  - Files: .github/workflows/deploy.yml
  - Acceptance: exactly one build job produces a content-hashed artifact; promote jobs contain no build step; the hash is verified at the final promote
  - Verify: `test "$(grep -c 'docker build' .github/workflows/deploy.yml)" -eq 1`
  - Checks: A-DEPLOY-1, A-DEPLOY-8
- [ ] GA-xxx Pin production images to immutable identities
  - Files: k8s/deployment.yaml, .github/workflows/deploy.yml
  - Acceptance: every prod `image:` reference uses a digest or commit SHA tag; no `:latest` or branch tag remains on any prod path; the previous release is addressable by identity
  - Verify: `! grep -rn ':latest' k8s/ .github/workflows/deploy.yml`
  - Checks: A-DEPLOY-19, A-DEPLOY-1
- [ ] GA-xxx Put an enforced approval mechanism in front of prod
  - Files: .github/workflows/deploy.yml, docs/deploy/pipeline.md
  - Acceptance: the prod job targets a protected environment or a distinct second action (signed tag, deploy command); no path deploys to prod on bare push to main; the mechanism is documented
  - Verify: `grep -q 'environment: production' .github/workflows/deploy.yml`
  - Checks: A-DEPLOY-9, A-DEPLOY-8
- [ ] GA-xxx Decompose the lock-taking migration into expand/contract deploys
  - Files: migrations/NNN_expand_table.sql, docs/deploy/migration-calendar.md
  - Acceptance: the expand migration is additive-only with `lock_timeout` and `statement_timeout` set; cutover and contract are separate calendar entries in later waves; no single-step `NOT NULL` or non-`CONCURRENTLY` index remains
  - Verify: `grep -q 'lock_timeout' migrations/NNN_expand_table.sql && ! grep -qiE 'set not null|add column[^;]*not null' migrations/NNN_expand_table.sql`
  - Checks: A-DEPLOY-5, A-DEPLOY-6
- [ ] GA-xxx Make the readiness probe truthful
  - Files: src/health/readiness.ts
  - Acceptance: the probe checks database connectivity and one critical dependency before returning healthy; returns 503 during warmup; no unconditional 200 path remains
  - Verify: Manual: stop the database, then run `curl -sf localhost:PORT/ready`; expect nonzero exit
  - Checks: A-DEPLOY-13, A-DEPLOY-15
- [ ] GA-xxx Write and rehearse the per-service rollback doc
  - Files: docs/deploy/rollback.md
  - Acceptance: exact revert command per service with a measured time-to-revert; a compensating-forward plan for every data-forward change; the incident-log location and template named
  - Verify: `grep -c 'time-to-revert' docs/deploy/rollback.md`
  - Checks: A-DEPLOY-4, A-DEPLOY-16
- [ ] GA-xxx Gate destructive commands away from production
  - Files: .github/workflows/deploy.yml, scripts/deploy.sh
  - Acceptance: no workflow or script runs `terraform destroy`, `migrate reset`, or equivalent against prod without a confirmation step; each gated command names its verified restore point
  - Verify: `! grep -rn 'migrate reset\|terraform destroy' .github/workflows/`
  - Checks: A-DEPLOY-18

## Anti-patterns hunted

- **Paper canary.** Docs or job names claim canary; no metric, threshold, window, or automated trigger is wired anywhere. Hunt: the A-DEPLOY-11 four-field test; the missing fields are the Evidence, the claim itself is the finding.
- **Rollback theater.** "rollback: redeploy previous image" written next to a schema migration. Hunt: grep rollback docs and runbooks for redeploy language adjacent to migration references; file under A-DEPLOY-4, High.
- **Per-environment rebuild.** A build step inside each promote job; no promotion is ever a promotion. Hunt: count build invocations across deploy workflows per A-DEPLOY-1.
- **Slack-ping approval.** The prod gate is a convention, not a mechanism. Hunt: A-DEPLOY-9; a push-to-main trigger on the prod job is the Evidence line.
- **Table-locking migration.** Single-step `NOT NULL`, `ALTER COLUMN` type change, or non-`CONCURRENTLY` index on a populated table. Hunt: the A-DEPLOY-6 forms in `migrations/**`; quote the DDL statement, never the category.
- **Expand-only trap.** Expand shipped, contract never scheduled, no by-design reason recorded. Hunt: additive migrations older than one release cycle with no calendar entry, per A-DEPLOY-5.
- **Flag necromancy.** A reused flag name over dormant code (the Knight Capital shape). Hunt: the A-DEPLOY-14 lineage walk through flag config and git history.
- **200-on-bind probe.** The healthcheck passes the moment the socket opens. Hunt: A-DEPLOY-13; quote the handler body in Evidence.
- **Uniform 0-to-100.** An untested change reaches all traffic in one step (the CrowdStrike shape). Hunt: the A-DEPLOY-11 rollout walk against any blast-radius justification on disk.
- **Assumed cold start.** A new environment shipped on the belief it is just like the other one. Hunt: A-DEPLOY-12 against recently added `environment:` keys with no checklist record.
- **Vague finding.** "The pipeline could be improved" names nothing. Refused: every deploy finding quotes the workflow line, migration statement, or probe handler that condemns it.
- **Double-billing.** Schema shape is F-DB, leaked secret values are F-SEC, canary metric wiring is F-OBS, test existence and CI wiring are F-REPO. Refused: this module audits shipping mechanics only; cross-reference per the ownership map.
- **Severity inflation.** A missing topology doc is paperwork, not an outage. Refused: documentation and artifact checks default Medium or Low; only lock-taking migrations, unpinned or rebuilt prod artifacts, ungated prod paths, paper canaries, and dead probes reach High, and only ungated destructive commands and untrusted-fork secret exposure reach Critical.
