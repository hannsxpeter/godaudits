# Observe audit module

Audits whether the deployed system is monitorable by promise, not by chart count: are the SLOs real, do the pages derive from burn rate, do the runbooks execute, and does the observability surface survive the incident it describes. It runs the observe-ready disciplines forward against alert rules, dashboard JSON, logger modules, and collector configs instead of against a plan, and feeds findings `F-OBS-n` and a 0-100 domain score (weight 5 per `intake.md`) into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads this module for any archetype running a deployed service with users depending on it (saas-dashboard, api-service, ml-pipeline, mobile-app backend, cli with a hosted component); pure libraries and static marketing sites without uptime promises exclude it, with the reason recorded in the applicability matrix. In plan-aware mode every check also cites its `R-OBS-n` twin from `.godplans/PLAN.mdx`.

## Lineage

Descends from observe-ready (ready-suite, shipping tier) through the godplans observability module. The disciplines that carry into audit time: every charted, alerted, or SLO-ed number is bound to a promise or demoted (the three-lane rule); pages derive from SLI burn rate, never from resource thresholds; every PAGE links a runbook executed within the last 90 days; and the whole surface must be reachable during the outage it describes (the Slack Jan 2021, Roblox 73-hour, Datadog Mar 2023, Facebook 2021 circular-dependency pattern). observe-ready's 4-tier ladder (Instrumented, Promised, Traceable, Rehearsed) becomes this module's dimension skeleton, and its have-nots list converts item for item into hunting targets. The method DNA is paper-control hunting: paper SLOs, paper runbooks, and blind dashboards are artifacts present with the mechanism absent, and this module exists to catch exactly that gap in code.

## Surface map

Inventory before any check runs: SLO artifacts (`.observe-ready/SLOs.md`, `observability/SLOS.md`, OpenSLO or sloth yaml, terraform `datadog_service_level_objective`); alert rules (`infra/alerts/**`, Prometheus rule files, `alertmanager.yml`, terraform `datadog_monitor`, Grafana `provisioning/alerting/`); dashboards (`grafana/dashboards/*.json`, `infra/dashboards/`); the shared logger module (`pino`, `winston`, `structlog`, `loguru`, `zap`, `slog` configs) and collector pipelines (`otel-collector*.y*ml`, `vector.toml`, `fluent-bit.conf`); tracing bootstrap (`@opentelemetry/*` deps, `instrumentation.*`, sampler and `tail_sampling` config); error tracking init (`Sentry.init`, `sentry.*.config.*`, Rollbar, Bugsnag); runbooks and incident docs (`runbooks/`, `observability/INCIDENTS.md`, `.observe-ready/`); monitoring services inside `docker-compose*.yml` and cluster manifests (independence evidence). The intake fingerprint already lists entry points, workers, queue consumers, deploy configs, and the vendor stack: cite it, do not re-scan. Declare four conditional sub-surfaces present or absent, with the reason recorded: self-hosted monitoring stack vs managed vendor (moves where independence evidence lives); async and scheduled paths (absent narrows A-OBS-9 to routing only); cross-service boundaries (a single-process monolith reduces A-OBS-11 to `trace_id` continuity in logs); incident history (absent reduces A-OBS-19 to template existence).

## Checks

Severities are funded-product calibration; scale per `intake.md`. PII anywhere in telemetry belongs to security (it owns log redaction): cross-reference F-SEC, never bill it here.

Mirror boundary: A-OBS-1..20 mirror R-OBS-1..20 one to one; A-OBS-21 and up are audit-only. Cross-verified against godplans: R-OBS-1..21 defined.

1. **A-OBS-1 Service and journey inventory truth.** A durable inventory names every service with its topology type and every user journey, and it matches the code.
   Look: `.observe-ready/STATE.md`, `observability/SLOS.md`, `docs/topology.md` vs the fingerprint's entry points, workers, and consumers; plan-aware: the plan's service table.
   Fail: no inventory anywhere, or rows contradicting code (an SLO for a deleted service, a live worker absent from the register). Medium.
2. **A-OBS-2 Three-lane metric classification.** Every charted or alerted metric is an SLI with an SLO, a diagnostic marked non-alerting, or gone.
   Look: dashboard panel queries and alert expressions vs the SLO register; lane or `non_alerting` markers in `observability/`.
   Fail: a chart or alert on a metric bound to no SLO and carrying no diagnostic marker. Medium.
3. **A-OBS-3 SLO completeness.** Each named journey has one SLI with a measurement query, one target, one window, one computed error budget.
   Look: the SLO register; OpenSLO or sloth yaml; terraform SLO resources.
   Fail: a deployed user-facing journey with no SLO anywhere, High; a row missing query, window, or budget, Medium.
4. **A-OBS-4 Error-budget policy.** Every SLO carries a four-field policy: Trigger, Action, Stakeholder, Exit.
   Look: policy blocks adjacent to SLO rows in the register.
   Fail: an SLO with no policy is a paper SLO. Medium, and the journey is not counted as promised.
5. **A-OBS-5 Feasibility ceiling.** No SLO promises above the product of its upstream availabilities.
   Look: the dependency graph from the fingerprint; vendor SLA tiers in IaC and the register's feasibility math.
   Fail: a target above the computed ceiling with no named mitigation (redundancy, degradation path). Medium.
6. **A-OBS-6 Low-traffic strategy.** Journeys with fewer requests than 10x the error budget per window declare extended windows, synthetic traffic, or aggregation.
   Look: traffic notes in the register; synthetic check configs (`checkly`, `blackbox_exporter`, cron pingers).
   Fail: burn-rate alerting on a trickle journey with no declared strategy. Low.
7. **A-OBS-7 Burn-rate paging.** Every PAGE derives from an SLI burn rate with at least two windows; cause signals never page.
   Look: PAGE-severity rules in `infra/alerts/**`, Prometheus rules, terraform monitors, Grafana alerting.
   Fail: a PAGE on CPU, memory, disk, or raw error count, High; a single-window burn alert, Medium.
8. **A-OBS-8 Runbook link and owner per page.** Every PAGE rule carries a specific runbook URL (not a directory) and a named owner.
   Look: `runbook_url` and `owner` fields in each PAGE rule and in `.observe-ready/alerts.md`.
   Fail: a PAGE with no specific runbook URL or no owner. High.
9. **A-OBS-9 Deadman switches and out-of-band routing.** Every silent path alerts on absence, and paging does not depend on the paged system.
   Look: heartbeat emitters in scheduled jobs and consumers; `absent()` or deadman rules; routing config (direct pager vs a Slack workspace tied to the app's SSO).
   Fail: a prod worker, cron, or pipeline with no deadman alert, High; alert routing that dies with the observed system, High.
10. **A-OBS-10 Structured log contract.** One JSON format with `trace_id`, `service`, `level`, `timestamp`, `event`; correlation IDs cross every call type; retention stated per log class.
    Look: the shared logger module; queue producers and consumers for ID pass-through; collector or vendor retention config.
    Fail: services on ad-hoc `console.log` or `print` logging, `trace_id` dying at an async boundary, or retention unstated. Medium. PII in logs: F-SEC.
11. **A-OBS-11 Trace propagation and sampling.** OTel context crosses every boundary in the graph; SLO-backed services sample tail-based or error-biased; retention covers the SLO window; span names low-cardinality.
    Look: `instrumentation.*` bootstrap; sampler settings (`TraceIdRatioBased` values, `ParentBased`); collector `tail_sampling` processor; retention config.
    Fail: head-only 1 percent sampling on an SLO service, retention shorter than the SLO window, or context lost at a queue or cold start. Medium.
12. **A-OBS-12 Error tracking with release tags.** Every service reports exceptions with `release` bound to the deploy identifier, plus a grouping-tuning trace.
    Look: `Sentry.init` and equivalents; `release:` wired to a git SHA or deploy env var; grouping notes in `.observe-ready/`.
    Fail: no error tracker on a deployed service, High; a tracker with no release tag, Medium. Scrubber config: F-SEC.
13. **A-OBS-13 Cardinality budget.** High-cardinality dimensions stay off per-series priced backends, with the exclusion list written down.
    Look: label and tag sets in instrumentation code (`user_id`, `request_id`, `session_id`, `tenant_id`, `order_id`); the backend pricing model from the stack fingerprint; `observability/CARDINALITY.md`.
    Fail: a high-cardinality label on a per-series backend with no exclusion rule. High.
14. **A-OBS-14 Above-the-fold discipline.** The primary dashboard leads with the burn-rate gauge and holds at most 7 above-fold charts, each bound to an SLO, SLI, or named diagnostic.
    Look: panel count, order, and queries in `grafana/dashboards/*.json` or `infra/dashboards/` vs the register.
    Fail: over 7 above-fold charts, first chart not the burn-rate gauge, or unbound panels above the fold. Medium.
15. **A-OBS-15 Artifact ownership.** Every dashboard and alert carries owner and last_reviewed; at most 3 dashboards per service.
    Look: metadata fields or the catalogs `.observe-ready/dashboards.md` and `.observe-ready/alerts.md`.
    Fail: orphan artifacts, or a fourth dashboard with no stated reason. Low.
16. **A-OBS-16 Surface independence.** Dashboards, alert routing, runbooks, status page, trace store, and on-call schedule are each reachable when the observed service is down.
    Look: `observability/INDEPENDENCE.md`; `grafana`, `prometheus`, `loki`, `jaeger` services inside the app's own compose file or cluster manifests; status page and runbook hosting.
    Fail: any of the six rows hosted on the observed system with no remediation and no justified exception. High.
17. **A-OBS-17 Executable runbooks.** One runbook per PAGE with fenced commands using exact flags, hosted out-of-band, executed within 90 days.
    Look: `runbooks/*.md` for command fences and `last_executed:` dates; a tabletop cadence entry on the calendar file.
    Fail: prose-only runbooks ("check the logs"), or `last_executed` absent or older than 90 days. Medium.
18. **A-OBS-18 Incident loop.** A SEV-1/2/3 ladder with response expectations, an IC rotation (or named solo responder), a status-page cadence, and comms templates exist.
    Look: `observability/INCIDENTS.md`, `docs/incident*`, status page config, comms templates.
    Fail: none of the four exists for a deployed product. Medium at funded-product, Low below.
19. **A-OBS-19 Learning loop.** The post-mortem template forces at least one observability-gap action item with a due date; a quarterly alert-prune cadence is recorded.
    Look: `observability/templates/post-mortem.md`, incident files with tracked action items, the prune log.
    Fail: incidents on record with no post-mortems, or a template missing the gap-item or due-date field. Low.
20. **A-OBS-20 Bright line and watchlist.** Conversion analytics stay out of the ops surface; SLOs missing a policy or query stay visible on a paper-SLO watchlist.
    Look: business metrics (signup conversion, MRR, DAU) in ops dashboards or alert rules; the watchlist in the register or `.observe-ready/STATE.md`.
    Fail: a conversion metric paging or holding an above-fold ops slot, Low; paper SLOs silently counted as promised fold into the A-OBS-4 finding.
21. **A-OBS-21 Log level honesty (audit-only).** Levels mean what they claim: ERROR is actionable, DEBUG is off in prod.
    Look: logger call sites (stack traces at WARN, routine ops at ERROR, everything at INFO); prod config enabling DEBUG.
    Fail: ERROR used for non-actionable noise or DEBUG on in prod, Low; Medium when the misleveled stream feeds an alert.
22. **A-OBS-22 Alert wiring liveness (audit-only).** Every notification route actually delivers.
    Look: placeholder webhook URLs (`example.com`, `hooks.slack.com/services/XXX`), committed silences without expiry, `enabled: false` monitors, receivers unbound in `alertmanager.yml`.
    Fail: a PAGE route pointing at a placeholder or disabled receiver, High; dead TICKET routes, Medium.
23. **A-OBS-23 Dark entry points (audit-only).** Every entry point in the fingerprint emits some telemetry.
    Look: routes, consumers, and jobs from the fingerprint vs middleware coverage, span creation, and logger imports per module.
    Fail: a user-facing route or prod worker with zero metrics, spans, and structured logs. Medium.
24. **A-OBS-24 Phantom signals (audit-only).** Alerts and charts reference metrics the code actually emits.
    Look: metric names in alert expressions and dashboard queries vs emission sites (`prom-client` registries, `statsd` calls, OTel meters).
    Fail: a PAGE rule on a metric with no emission site (it can never fire), High; phantom dashboard panels, Medium.

## Scoring

Weighted dimensions summing to 100, derived from observe-ready's 4-tier model via the godplans self-audit rubric, with the have-nots applied as deductions inside each dimension.

| Dimension | Weight | Checks |
|---|---|---|
| Promise binding and SLO design | 25 | A-OBS-1, 2, 3, 4, 5, 6, 20 |
| Alert derivation and severity | 20 | A-OBS-7, 8, 9, 22, 24 |
| Logging, tracing, and error tracking | 20 | A-OBS-10, 11, 12, 21, 23 |
| Dashboard discipline and independence | 15 | A-OBS-14, 15, 16 |
| Runbook and incident loop | 15 | A-OBS-17, 18, 19 |
| Cost and cardinality (conditional) | 5 | A-OBS-13 |

Cost and cardinality applies only when a metrics backend exists and prices per time series; on wide-event backends drop it and re-normalize the rest to 100. When the cross-service sub-surface is absent, A-OBS-11 scores on `trace_id` continuity alone. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

- [ ] GA-xxx Rebuild the SLO register from code reality
  - Files: .observe-ready/SLOs.md, observability/SLOS.md
  - Acceptance: every user-facing journey served by routes in the fingerprint has a row with SLI query, target, window, and computed budget; every SLO carries Trigger, Action, Stakeholder, and Exit lines; no target exceeds its upstream availability product
  - Verify: `test $(grep -c '^Trigger:' .observe-ready/SLOs.md) -eq $(grep -c '| SLI' .observe-ready/SLOs.md)`
  - Checks: A-OBS-3, A-OBS-4, A-OBS-5
- [ ] GA-xxx Rewire pages from cause thresholds to burn rates
  - Files: infra/alerts/burn-rates.yaml, infra/alerts/diagnostics.yaml
  - Acceptance: every PAGE rule references an SLI burn rate with at least two windows; CPU, memory, disk, and raw error-count rules carry TICKET or LOG-ONLY severity; every PAGE rule carries `runbook_url` and `owner`
  - Verify: `test $(grep -c 'runbook_url' infra/alerts/burn-rates.yaml) -ge $(grep -c 'severity: page' infra/alerts/burn-rates.yaml)`
  - Checks: A-OBS-7, A-OBS-8
- [ ] GA-xxx Add deadman switches to every silent path
  - Files: infra/alerts/deadman.yaml, src/jobs/heartbeat.ts
  - Acceptance: every scheduled job, queue consumer, and pipeline in the fingerprint emits a heartbeat; an absence alert exists per heartbeat; the absence alert routes through a delivery path independent of the observed system
  - Verify: `test $(grep -c 'absent(' infra/alerts/deadman.yaml) -ge 1`
  - Checks: A-OBS-9
- [ ] GA-xxx Converge all services on the shared structured logger
  - Files: src/lib/logger.ts, infra/collector/pipeline.yaml
  - Acceptance: one logger emits JSON with `trace_id`, `service`, `level`, `timestamp`, `event`; no direct `console.log` calls remain under `src/`; retention per log class stated in the collector config
  - Verify: `test $(grep -rl 'console\.log(' src/ | wc -l) -eq 0`
  - Checks: A-OBS-10, A-OBS-21
- [ ] GA-xxx Move the observability surface out of band
  - Files: observability/INDEPENDENCE.md, docker-compose.yml
  - Acceptance: the 6-row table (dashboards, alert routing, runbooks, status page, trace store, on-call schedule) marks each row reachable-when-down or carries a justified exception; no monitoring service remains in the app's own compose file or cluster manifests without an exception row
  - Verify: `test $(grep -cE '^\| (dashboards|alert routing|runbooks|status page|trace store|on-call)' observability/INDEPENDENCE.md) -eq 6`
  - Checks: A-OBS-16
- [ ] GA-xxx Make runbooks executable and schedule the tabletop
  - Files: runbooks/, observability/RUNBOOKS.md
  - Acceptance: one runbook per PAGE alert containing fenced command blocks with exact flags; each carries `last_executed:` within 90 days or a scheduled tabletop entry; each is linked from its alert payload, not a wiki search
  - Verify: `test "$(grep -rL 'last_executed:' runbooks/ | wc -l)" -eq 0`
  - Checks: A-OBS-17, A-OBS-8
- [ ] GA-xxx Enforce the cardinality budget
  - Files: src/lib/metrics.ts, observability/CARDINALITY.md
  - Acceptance: no `user_id`, `request_id`, `session_id`, or `tenant_id` label on any metric bound for the per-series backend; the exclusion list names each banned dimension and where it lives instead
  - Verify: `test $(grep -rEc 'user_id|request_id|session_id|tenant_id' src/lib/metrics.ts) -eq 0`
  - Checks: A-OBS-13

## Anti-patterns hunted

- **Paper SLO.** A target number in a register or wiki with no four-field policy and no measurement query. Hunt: A-OBS-3 and A-OBS-4; count `Trigger:` blocks against SLO rows; never count the journey as promised.
- **Blind dashboard.** A 40-panel JSON where no panel names its SLO or diagnostic role. Hunt: A-OBS-2 and A-OBS-14; quote the panel count and the binding count.
- **Paper runbook.** Prose like "check the logs", or `last_executed` missing or stale. Hunt: A-OBS-17; quote the stale date, never just "outdated".
- **Cause-based paging.** CPU over 80 percent or error count over zero wired to the pager as primary. Hunt: A-OBS-7 over every PAGE rule; High.
- **Single-window burn alert.** One window, one threshold: wrong on noise and speed simultaneously. Hunt: A-OBS-7; Medium.
- **Circular surface.** Grafana, Prometheus, Loki, or the runbook host deployed inside the app's own compose file or cluster (the Slack, Roblox, Datadog, Facebook pattern). Hunt: A-OBS-16 over deploy manifests.
- **Sprawl and orphans.** 20-plus monitors or a fourth dashboard per service with no owner or last_reviewed anywhere. Hunt: A-OBS-15; the remediation prunes, never mutes.
- **Silent heartbeat.** A cron job or queue consumer that can fail invisibly for hours (the Checkly 5-hour pattern). Hunt: A-OBS-9 against the fingerprint's worker list.
- **Cardinality blowup.** `user_id` or `request_id` as a metric label on a per-series priced backend. Hunt: A-OBS-13 over instrumentation label sets; quote the label and the backend.
- **Untagged errors.** `Sentry.init` with no `release`, making "did vX.Y.Z cause this" unanswerable. Hunt: A-OBS-12 over every tracker init site.
- **Analytics scope creep.** Conversion and engagement metrics smuggled into ops dashboards or alert rules. Hunt: A-OBS-20; move them out of scope, do not score them.
- **Vague finding.** "Monitoring is weak" with no rule file, panel, or logger call site named. Refused: every observe finding quotes the artifact and its file:line.
- **Double-billing.** PII in logs, spans, or error payloads is F-SEC (security owns log redaction); pipeline gates and rollback mechanics are F-DEPLOY; test existence and CI wiring are F-REPO. Refused: cross-reference per the ownership map.
- **Severity inflation.** Missing owner metadata or an undated register is hygiene, not an outage. Refused: metadata checks default Low; only unpageable pages, silent prod paths, in-band surfaces, phantom PAGE rules, and cardinality blowups reach High.
