# Architecture audit module

Runs the architecture discipline forward against built code: does the system have a defensible shape, real boundaries, arithmetic behind its NFR claims, and decision records that match what actually ships. Findings land as F-ARCH-n and a 0-100 domain score in AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads this module during the architecture domain pass for every archetype except pure marketing sites with a single static deployable, where the load-bearing check fails and the exclusion is recorded in the applicability matrix with that reason.

## Lineage

Descends from architecture-ready through arc-ready 1.1 and the godplans architecture module, whose R-ARCH numbering this module mirrors one to one. What carries over into audit time: every box, arrow, and ADR must have a flip point and blast radius or it is decoration; storage shape precedes database name; NFR claims are arithmetic, not adjectives; trust boundaries are placements the threat model can copy verbatim; the substitution test cuts horoscope prose; and the paper-control hunt (fitness functions named but never wired, diagrams that diagram nothing shipped) is the method DNA. Arc-ready 1.1 adds canonical artifact inventory and dependency-aware freshness: architecture claims are checked against `.arc-ready/PROGRESS.md`, upstream requirement artifacts, and downstream roadmap and stack timestamps. godplans forced these as plan-time requirements; this module checks whether the code, not the plan, honors them.

## Surface map

Inventory before any check runs. The intake fingerprint already lists entry points, deployables, the data layer, HTTP surfaces, and monorepo layout: cite it, never re-scan.

- Architecture records: `docs/adr/`, `docs/architecture/`, `.architecture-ready/`, `ARCH.md`, and in plan-aware mode the architecture section of `.godplans/PLAN.mdx`.
- Arc-ready state: `.arc-ready/PROGRESS.md` as the canonical tier ledger, with `.kickoff-ready/PROGRESS.md` accepted only as a legacy import alias. Record missing claimed artifacts, unclaimed artifacts, invalid status values, and downstream artifacts older than changed architecture inputs.
- Diagram sources: `*.mmd`, `*.puml`, `*.d2`, `structurizr*`, mermaid fences inside docs; also image-only exports (`docs/**/*.png` with no text source).
- Deployable count beyond the fingerprint: `Dockerfile*`, `docker-compose*.yml`, `Procfile`, `serverless.yml`, `k8s/`, `helm/`, `fly.toml`, workspace packages with their own start scripts.
- Heavy pattern signals: `kafkajs`, `kafka-python`, `confluent` in manifests; `istio`/`linkerd` configs; API gateway configs; event-store or CQRS libraries.
- Conformance tooling: `.dependency-cruiser.cjs`, ArchUnit or NetArchTest test files, `eslint-plugin-boundaries`, `import/no-restricted-paths` rules, and the CI steps that run them.
- Boundary and tenancy signals: middleware mounts, scoped DB client wrappers, `tenant_id`/`org_id` columns and RLS statements in migrations.
- Integration sites: HTTP client wrappers, queue producers and consumers, webhook handlers, retry and timeout config.
- Caching layers: CDN and edge config (`vercel.json`, CloudFront distributions, `Cache-Control` and `s-maxage` headers), Redis or Memcached clients, HTTP response caches, ORM or query caches, `revalidate`, `unstable_cache`, and `@Cacheable` call sites, paired with the write paths for the same entity.
- Backpressure signals: consumer concurrency, prefetch, and visibility settings (`prefetch`, `maxInFlight`, `concurrency`, `visibilityTimeout`); unbounded in-process buffers such as module-level arrays or `Promise.all` over caller-supplied input; producer-side admission control.
- Recovery records: `docs/runbooks/`, `docs/deploy/`, disaster-recovery or continuity docs, backup and PITR config in `*.tf` and compose files, and restore-drill evidence (a dated log, a scheduled restore workflow, a runbook entry with a completion date).
- Scale-out state signals: module-scope mutable state on a request path, local filesystem writes outside temp, in-process cron or interval schedulers, session-affinity config, and replica or process counts in deploy config.
- Redundancy and routing signals: replica or instance counts and autoscaling ranges in deploy config, `livenessProbe` and `readinessProbe` definitions, load-balancer or ingress health-check config, standby and failover declarations, and multi-zone or multi-region placement.
- Read-routing signals: read-replica connection strings and reader endpoints with their call sites, ORM read/write splitting config, and partition or shard key declarations in migrations.

Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: multi-service topology, multi-tenancy, async infrastructure, external integrations, a caching layer, a durable store the project owns, a horizontally scaled runtime, a deployed runtime the project operates, and read replicas.

## Checks

Severities are funded-product calibration; intake's scale calibration moves them, never the evidence.

Mirror boundary: A-ARCH-1..19 mirror R-ARCH-1..19 one to one; A-ARCH-20 and up are audit-only. Cross-verified against godplans: R-ARCH-1..24 defined.

1. A-ARCH-1 Architecture claims trace to a product constraint or a labeled assumption; plan-aware, the plan's architecture section traces to its product section.
   Look: `README.md`, `docs/architecture/`, ADR Context sections in `docs/adr/*.md`, `ARCH.md`, `.godplans/PLAN.mdx`.
   Fail: architecture prose citing no entity, NFR, or product constraint: Medium; shape decisions justified only as best practice: Medium.
2. A-ARCH-2 Ceremony matches load. Re-run the load-bearing triggers against repo reality: persistence layers, deployables, load-bearing third parties, team size from `git shortlog -sn`.
   Look: fingerprint deployable and data-layer inventory; manifests listed in the surface map.
   Fail: two or more persistence layers or deployables with zero recorded shape decision: High; single-service single-store repo carrying gateway or mesh ceremony: record under A-ARCH-10, not twice.
3. A-ARCH-3 A numeric 12-month scale ceiling and binding NFRs are recorded where the team can find them, and each external integration has a named failure mode.
   Look: `docs/architecture/`, `docs/adr/`, `README.md`; plan-aware, the plan's pre-flight answers.
   Fail: no numeric scale, latency, or availability target anywhere: Medium; an integration with no recorded failure mode: Medium.
4. A-ARCH-4 Exactly one system shape is recorded with ADR-001 semantics: alternatives rejected, flip point, blast radius; a microservices shape names its forcing function.
   Look: `docs/adr/001*`, `.architecture-ready/adr/`, `ARCH.md`.
   Fail: load-bearing repo with no shape record: Medium; four or more deployables with no forcing function recorded anywhere: High.
5. A-ARCH-5 Code boundaries are bounded contexts, not layers: no `UserService`/`CoreAPI`/`common` as a context, no anemic service wrapping one table, no god module owning half the domain.
   Look: top-level `src/` directories, `packages/*`, `services/*`, docker-compose service names, import fan-in per module.
   Fail: generic layer names as service boundaries: Medium; a deployable that only proxies one table's CRUD: Medium; one module holding domain logic imported by most of the codebase: High.
6. A-ARCH-6 The cross-context dependency graph is cycle-free.
   Look: run `npx madge --circular src` or `npx dependency-cruiser src`; imports crossing context directories.
   Fail: cycles across bounded-context directories: High; cycles inside one context: Low.
7. A-ARCH-7 Storage shape matches each entity group's access pattern; tenancy and lifecycle are evident in the schema.
   Look: migrations, ORM models, blob handling code, `tenant_id` columns, soft-delete fields, retention jobs.
   Fail: cross-entity invariants enforced over a schemaless store: High; blobs base64-encoded into DB rows instead of an object store: Medium. Schema internals (indexes, normalization) cross-reference F-DB per the ownership map.
8. A-ARCH-8 Each cross-entity invariant has one enforcement point; cross-component state changes use an outbox or equivalent, never dual writes.
   Look: transaction blocks followed by `publish(`, `enqueue(`, or outbound `fetch(`; outbox tables and reconciliation jobs.
   Fail: domain write and event publish in separate steps with no outbox or reconciliation: High; any two-phase-commit dependency: High.
9. A-ARCH-9 Every network mutation carries a timeout, a retry policy with backoff and jitter, and an idempotency key; at-least-once consumers deduplicate; blast radius is handled (circuit breaker, DLQ, or degradation path).
   Look: HTTP client wrappers, queue consumers, webhook handlers; grep `Idempotency-Key`, `retry`, `timeout`, `dlq`.
   Fail: payment or webhook mutation without idempotency: High; consumers with no dedup: High; outbound calls with no timeout: Medium.
10. A-ARCH-10 Every heavy pattern present is justified by a recorded product constraint: event sourcing, CQRS, service mesh, API gateway, Kubernetes, Kafka.
    Look: the heavy pattern signals from the surface map, paired with scale witnesses (`git shortlog -sn`, traffic or tenant counts in docs).
    Fail: heavy pattern with no recorded constraint at the repo's scale signals: Medium; a microservices split maintained by one contributor: High.
11. A-ARCH-11 Recorded NFR targets survive arithmetic against the code path.
    Look: stated p95 and availability targets versus serial external calls per request path and the availability chain across critical-path components.
    Fail: a request path whose serial external calls alone exceed the stated latency budget: High; an availability target with a single point of failure on the critical path and no chain math: Medium.
12. A-ARCH-12 No bare quality adjectives stand in for numbers in architecture records.
    Look: `grep -rniE "scalable|resilient|performant|future-proof|cloud-native" docs/ README.md`.
    Fail: an adjective instance with no number or owned open question beside it: Low.
13. A-ARCH-13 The four trust boundaries are locatable in code (network edge, authn, authz, tenant isolation); load-bearing boundaries have two independent layers; the highest-blast-radius mutations are enumerable.
    Look: middleware mounts, edge config (TLS, rate limits), the authz layer, scoped DB client plus RLS migrations.
    Fail: multi-tenant repo with single-layer tenant isolation: High; authz scattered per route with no boundary layer: High. Exploitable bypasses cross-reference F-SEC per the ownership map; do not score them here.
14. A-ARCH-14 An ADR corpus lives in-repo with flip point and blast radius fields; superseded ADRs are retained, not deleted.
    Look: `docs/adr/`, `.architecture-ready/adr/`; `grep -L "Flip point:" docs/adr/*.md`.
    Fail: multi-contributor repo with zero ADRs: Medium; ADRs missing flip point or blast radius: Low; decisions deleted rather than superseded in git history: Low.
15. A-ARCH-15 Version-controlled text diagrams exist and match the code: every arrow labeled with protocol and purpose, 15 boxes or fewer, no image-only exports.
    Look: diagram sources from the surface map; compare boxes against the deployable inventory.
    Fail: multi-deployable repo with no diagram source: Medium; unlabeled arrows: Low; binary-only diagram exports: Low.
16. A-ARCH-16 Architecture fitness functions are wired into CI: dependency conformance, data-ownership conformance, an NFR probe.
    Look: `.dependency-cruiser.cjs`, ArchUnit tests, `eslint-plugin-boundaries`, and the CI workflow steps that invoke them.
    Fail: no conformance tooling on a multi-context repo: Medium; tooling configured but absent from CI, the paper control: Medium.
17. A-ARCH-17 The declared architecture is consistent with the manifests downstream work reads: declared storage, compute, and integration shapes match lockfiles, Dockerfiles, and deploy configs.
    Look: `ARCH.md` or plan shapes versus the fingerprint's manifest inventory.
    Fail: declared shapes naming stores or services absent from the code, or code shapes the record never mentions: Medium; escalate under A-ARCH-18 when material.
18. A-ARCH-18 Built system matches declared shape, the ghost-architecture catch: component count, writer-per-table map, and boundary placement agree with the record; mismatches carry superseding ADRs.
    Look: deployable inventory versus declared components; actual write sites versus declared data owners.
    Fail: material mismatch (declared modular monolith, shipped six services; declared single writer, two found) with no superseding ADR: High.
19. A-ARCH-19 Architecture records are specific: they fail the substitution test and stay under three pages of prose.
    Look: swap the domain nouns in any architecture paragraph; if it still reads true, it decided nothing.
    Fail: horoscope prose ("modern scalable backend with a well-designed data layer"): Low; prose past three pages: Low.
20. A-ARCH-20 (audit-only) No distributed monolith: no table written by more than one deployable, no request path chaining three or more sync service hops.
    Look: connection strings and migration consumers per service; grep `INSERT INTO`/`UPDATE` targets across `services/*`; trace one hot request path end to end.
    Fail: multi-writer table with divergent invariant enforcement: Critical (silent data corruption); request path fanning through three or more sync hops: High.
21. A-ARCH-21 (audit-only) Context boundaries hold at import level: no deep imports into another context's internals, no shared mutable singletons across contexts.
    Look: `grep -rn "\.\./\.\." src/` where the path crosses context directories; imports of a sibling context's `internal/` or `db/` paths.
    Fail: cross-context deep imports bypassing the public index: Medium; shared mutable singletons crossing contexts: Medium.
22. A-ARCH-22 (audit-only) A domain layer exists where the record claims boundaries: invariants, pricing, and state transitions are not coded inline in transport handlers.
    Look: bodies of `routes/`, `pages/api/`, controllers, and UI event handlers for business rules.
    Fail: load-bearing invariants enforced only inside transport handlers: Medium; the same invariant duplicated across handlers with drift between copies: High.
23. A-ARCH-23 (audit-only) API contract design, when an API or service surface exists: the API style is declared and applied consistently (REST, GraphQL, or RPC, not a different shape per endpoint); a versioning strategy exists that does not break existing consumers; a machine-readable contract (an OpenAPI document or a GraphQL schema) is present and matches the routes on disk; resources and URIs are modeled consistently for REST; and errors use one consistent envelope (RFC 7807 Problem Details or a documented equivalent), not an ad-hoc shape per endpoint.
    Look: route registration and handler signatures; an `openapi.*`, `swagger.*`, or GraphQL schema file diffed against the routes; version prefixes or content negotiation; the error-response shape across handlers.
    Fail: mixed API styles with no stated reason, no versioning strategy on a consumer-facing API, a contract file drifted from the routes, or inconsistent ad-hoc error shapes: Medium (High when consumers are external and a breaking change ships with no version). Cross-reference F-SEC for API auth and residue.
24. A-ARCH-24 (audit-only) Caching is a recorded decision with an invalidation story, when a caching layer exists: each layer names what it holds and for how long, every cached entity has a write path that invalidates or versions it, and no per-user or per-tenant value is served from a key with no user or tenant component.
    Look: the caching layers from the surface map paired with the write sites for the same entity; TTL and `s-maxage` values against the freshness the product states; cache key construction; `Cache-Control: public` or a shared CDN cache on an authenticated response.
    Fail: a cached entity whose write path performs no invalidation and whose TTL is unbounded or longer than the stated freshness: High; per-user or per-tenant data cached under a key carrying neither identifier, or an authenticated response marked publicly cacheable: High, with the exploitable disclosure cross-referenced to F-SEC per the ownership map; a caching layer with no recorded decision anywhere: Low. Unbounded in-process caches are A-CODE-16's; cite, do not re-score.
25. A-ARCH-25 (audit-only) Backpressure exists where work is queued, when async infrastructure is present: every consumer bounds its in-flight work, unbounded producer paths carry admission control, and overload has a recorded shed-or-degrade behavior rather than an out-of-memory kill.
    Look: the backpressure signals from the surface map; `Promise.all`, `asyncio.gather`, or channel sends over caller-supplied input on a request path; the retry policy's effect on an already-saturated downstream.
    Fail: a consumer with unbounded concurrency, or an unbounded in-process buffer on a growth path: High; retries with no circuit breaker amplifying load into a saturated dependency: High; no recorded behavior for a queue that grows without bound: Medium. Queue-depth alerting is F-OBS's; cite, do not re-score.
26. A-ARCH-26 (audit-only) Recovery objectives are numbers with evidence, when the project owns a durable store: an RTO and an RPO are recorded per store, the backup mechanism satisfies the RPO arithmetically, and at least one restore has been performed and dated.
    Look: the recovery records from the surface map; backup interval and retention against the stated RPO; the PITR window; a dated restore drill, a scheduled restore workflow, or a runbook entry with a completion date.
    Fail: a stated RPO shorter than the backup interval, or an RTO that assumes a failover target the infrastructure does not have: High; durable user data with no RTO or RPO recorded anywhere: Medium; backups configured with no evidence any restore was ever performed: Medium. Backup configuration and destructive-command gating are F-DEPLOY's and migration reversibility is F-DB's; cite, do not re-score.
27. A-ARCH-27 (audit-only) The runtime scales out if the deployment says it does: no request-serving state lives in one process, no scheduled job runs once per replica by accident, and no correctness depends on session affinity.
    Look: the scale-out state signals from the surface map against the replica or instance count in deploy config; `setInterval`, `node-cron`, or `@Scheduled` in a replicated service with no lock or leader election; in-memory session, rate-limit, or lock stores; uploads written to local disk.
    Fail: a replica count above one with request state in module scope, an in-memory session or rate-limit store, or uploads on local disk: High; a scheduler firing in every replica with no distributed lock or leader election: High; an architecture record promising horizontal scale over a runtime that cannot leave one process: Medium.
28. A-ARCH-28 (audit-only) Read consistency is decided rather than accidental, when read replicas or a partitioned store exist: replica-served paths tolerate the staleness they get, post-write reads on money, auth, and inventory resolve to the primary, and a table projected past single-node scale carries a partition key instead of an open growth curve.
    Look: the read-routing signals from the surface map against the write sites for the same entity; post-write redirect and confirmation handlers; the largest tables in migrations against the scale ceiling recorded under A-ARCH-3.
    Fail: a balance, permission, or post-write confirmation read served from a replica with no staleness tolerance recorded: High; replica-backed reads with no stated staleness budget anywhere: Medium; a table projected past single-node capacity at the recorded ceiling with no partition key and no retention plan: Medium. Partition mechanics, index shape, and replication lag tuning are F-DB's; cite, do not re-score.
29. A-ARCH-29 (audit-only) Availability claims have redundancy behind them, when the project operates a deployed runtime: a component carrying an availability target runs more than one instance behind a health-checked router, or its single instance is recorded with an accepted downtime number, and the router removes an unhealthy instance rather than continuing to route to it.
    Look: the redundancy and routing signals from the surface map against the availability targets recorded under A-ARCH-3; probe definitions per replicated service; standby and failover declarations against the RTO recorded under A-ARCH-26.
    Fail: a stated availability target above the single-instance baseline running one replica with no recorded acceptance: High; a replicated service with no liveness or readiness probe, so a broken instance keeps receiving traffic: High; a single point of failure on the critical path named nowhere: Medium. Request-state statelessness is A-ARCH-27's and pipeline topology is F-DEPLOY's; cite, do not re-score.

## Scoring

Weighted dimensions summing to 100. Conditional dimensions drop out and the rest re-normalize when their sub-surface is declared absent in the surface map.

- Shape and grounding (A-ARCH-1 to A-ARCH-4): 15
- Component boundaries and dependency structure (A-ARCH-5, A-ARCH-6, A-ARCH-21, A-ARCH-22): 20
- Data architecture and invariants (A-ARCH-7, A-ARCH-8, A-ARCH-20): 15
- Integration discipline (A-ARCH-9, A-ARCH-10): 15, conditional on external integrations or async infrastructure present
- NFR reality (A-ARCH-11, A-ARCH-12): 10
- Trust boundary placement (A-ARCH-13): 15, conditional on a network surface the project owns
- Decision records and drift (A-ARCH-14 to A-ARCH-19): 10

A-ARCH-23 carries no weight of its own: its findings score inside the integration-discipline or trust-boundary dimension of the API surface they implicate.

A-ARCH-24 through A-ARCH-29 carry no weight of their own either. Their findings score inside the dimension of the surface they implicate: caching and backpressure into integration discipline, recovery objectives and read consistency into data architecture and invariants, scale-out readiness into component boundaries and dependency structure, redundancy behind an availability claim into NFR reality. Each is skipped with its reason recorded when its sub-surface is declared absent, so a static site is never graded on a cache it has no reason to hold and a library is never graded on replicas it never runs.

Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Seed patterns in the audit-format task grammar. At audit time the agent adds the Fixes: line with real finding ids; seeds omit it.

- [ ] GA-xxx Record ADR-001 system shape retroactively
  - Files: docs/adr/001-system-shape.md
  - Acceptance: file labeled retroactive with the real decision date; contains "Flip point:" and "Blast radius:" and an "Alternatives rejected" section with two or more entries; names the forcing function if the shape is microservices
  - Verify: `grep -q "Flip point:" docs/adr/001-system-shape.md && grep -q "Blast radius:" docs/adr/001-system-shape.md`
  - Checks: A-ARCH-4, A-ARCH-14

- [ ] GA-xxx Break cross-context import cycles and wire conformance into CI
  - Files: src/, .dependency-cruiser.cjs, .github/workflows/ci.yml
  - Acceptance: zero circular dependencies across context directories; dependency-cruiser forbids imports that cross bounded contexts except through each context's public index; CI runs the check on every push
  - Verify: `npx madge --circular src && npx dependency-cruiser --config .dependency-cruiser.cjs src`
  - Checks: A-ARCH-6, A-ARCH-16, A-ARCH-21

- [ ] GA-xxx Replace dual-write sites with an outbox
  - Files: src/shared/outbox/dispatcher.ts, migrations/NNN_create_outbox.sql
  - Acceptance: every site that wrote domain state and published an event in separate steps now writes both in one transaction; dispatcher retries with backoff and jitter; consumers deduplicate on an idempotency key column
  - Verify: `grep -q "idempotency_key" migrations/*outbox*.sql`
  - Checks: A-ARCH-8, A-ARCH-9

- [ ] GA-xxx Add idempotency and retry policy to network mutations
  - Files: src/lib/http.ts, src/integrations/
  - Acceptance: every outbound mutating call carries a timeout and an idempotency key; retries use exponential backoff with jitter; webhook handlers deduplicate on the provider event id
  - Verify: `grep -rq "Idempotency-Key" src/integrations/`
  - Checks: A-ARCH-9

- [ ] GA-xxx Add a second tenant isolation layer at the schema
  - Files: migrations/NNN_row_level_security.sql, src/shared/db/scoped-client.ts
  - Acceptance: row-level policies exist on every tenant-owned table; the query layer exports only a tenant-scoped client, no raw-client export; either layer alone blocks a cross-tenant read
  - Verify: `grep -qi "row level security" migrations/*row_level*.sql`
  - Checks: A-ARCH-13

- [ ] GA-xxx Consolidate multi-writer tables to a single owner
  - Files: services/*/src/db/, docs/adr/
  - Acceptance: each table receives writes from exactly one deployable; former writers call the owner's interface or publish events instead; an ADR records the ownership map with flip point and blast radius
  - Verify: `grep -rln "INSERT INTO orders" services/ | wc -l | grep -qx "1"`
  - Checks: A-ARCH-20, A-ARCH-8

- [ ] GA-xxx Pin post-write reads to the primary and record the staleness budget
  - Files: src/shared/db/read-routing.ts, docs/architecture/read-consistency.md
  - Acceptance: money, auth, inventory, and post-write confirmation reads resolve to the primary; every remaining replica-served path is listed with the staleness it tolerates; a test writes and immediately reads on a pinned path and asserts the new value
  - Verify: `grep -qE "primary|writer" src/shared/db/read-routing.ts && grep -qi "staleness" docs/architecture/read-consistency.md`
  - Checks: A-ARCH-28, A-ARCH-7

- [ ] GA-xxx Put redundancy behind the availability target
  - Files: k8s/deployment.yaml, docs/architecture/capacity-model.md
  - Acceptance: every component carrying an availability target runs more than one replica with a readiness probe the router honors, or is recorded in the capacity model with an accepted annual downtime number; each remaining single point of failure on the critical path is named
  - Verify: `grep -q "readinessProbe" k8s/deployment.yaml && grep -qi "single point of failure" docs/architecture/capacity-model.md`
  - Checks: A-ARCH-29, A-ARCH-11

- [ ] GA-xxx Author a labeled container diagram from the built system
  - Files: docs/architecture/containers.mmd
  - Acceptance: mermaid source matching the deployables the repo actually ships; every edge label carries a protocol token (HTTP, gRPC, queue, or event); 15 boxes or fewer
  - Verify: `grep -q -- "-->" docs/architecture/containers.mmd`
  - Checks: A-ARCH-15, A-ARCH-18

- [ ] GA-xxx Record the caching contract and wire invalidation to the write paths
  - Files: docs/architecture/caching.md, src/lib/cache.ts
  - Acceptance: every cache layer is listed with what it holds, its TTL, and the write path that invalidates it; each entry carries an "Invalidated by:" line naming that path; every key holding per-user or per-tenant data includes that identifier; no authenticated response is marked publicly cacheable
  - Verify: `grep -q "Invalidated by:" docs/architecture/caching.md`
  - Checks: A-ARCH-24

- [ ] GA-xxx Bound consumer concurrency and record the overload behavior
  - Files: src/workers/, docs/architecture/backpressure.md
  - Acceptance: every consumer sets an explicit prefetch or max-in-flight value; no request path awaits an unbounded fan-out over caller-supplied input; the record names what the system sheds or degrades first when the queue grows and what the retry policy does against a saturated downstream
  - Verify: `grep -rqE "maxInFlight|prefetch|concurrency" src/workers/`
  - Checks: A-ARCH-25, A-ARCH-9

- [ ] GA-xxx Record RTO and RPO per store and complete a dated restore drill
  - Files: docs/runbooks/recovery.md
  - Acceptance: every durable store the project owns has a numeric RTO and RPO; the backup interval is shorter than the stated RPO; the file records a completed restore with its date, the artifact restored, and the elapsed time against the stated RTO
  - Verify: `grep -q "RPO:" docs/runbooks/recovery.md && grep -q "Restore drill completed:" docs/runbooks/recovery.md`
  - Checks: A-ARCH-26

- [ ] GA-xxx Move request-serving state out of the process
  - Files: src/server/session.ts, src/server/rate-limit.ts, src/jobs/scheduler.ts
  - Acceptance: sessions, rate-limit counters, and locks live in a shared store instead of module scope; uploads go to object storage instead of local disk; scheduled jobs acquire a distributed lock or run in one dedicated worker; no route depends on session affinity
  - Verify: `grep -rq "acquireLock" src/jobs/scheduler.ts`
  - Checks: A-ARCH-27

## Anti-patterns hunted

- Architecture theater: ADRs and diagram boxes no code path corresponds to. Pair every box with a deployable or module; unpaired elements become A-ARCH-15 or A-ARCH-18 findings, not decoration to admire.
- Paper-tiger architecture: stated NFR targets with no arithmetic behind them. Hunt with A-ARCH-11 chain math; the code path is the witness, not the doc.
- Cargo-cult cloud-native: Kafka, Kubernetes, or a mesh in the manifests of a one-contributor CRUD app. Hunt via A-ARCH-10 with `git shortlog -sn` as the scale witness.
- Stackitecture: an architecture doc that lists tools instead of shapes, naming database products with no storage-shape sentence above them. Score under A-ARCH-7 and A-ARCH-19.
- Distributed monolith: multi-writer tables, shared write schemas, request-path sync chains. A-ARCH-20; the finding names every writer site.
- Ghost architecture: the record describes one system, the repo ships another. A-ARCH-18; the finding quotes both sides.
- Anemic and god services: a deployable wrapping one table, or one module owning half the domain. A-ARCH-5; recommend merge or split at bounded-context lines.
- Horoscope docs: architecture prose that survives a noun swap. A-ARCH-19; quote the surviving paragraph as evidence.
- Paper fitness functions: conformance config committed but never run in CI. A-ARCH-16; a control that does not execute is a finding, not a control.
- Accidental cache: a cache added to answer a latency complaint, with no record of what it holds and no writer that invalidates it. A-ARCH-24; the finding names the write path that leaves it stale, not the cache library.
- Unbounded intake: a consumer that pulls as fast as the queue delivers and dies on the first burst. A-ARCH-25; the evidence is the consumer's missing concurrency bound, not the queue's current depth.
- Backup theater: backup configuration with a retention policy and no evidence a restore was ever attempted. A-ARCH-26; an untested restore is a hope, and an RPO shorter than the backup interval is arithmetic that already failed.
- Scale-out fiction: an architecture record promising horizontal scale over a process holding sessions, counters, uploads, or a scheduler in memory. A-ARCH-27; the finding pairs the declared replica count with the state site that blocks it.
- Replica-served truth: a balance, permission, or post-write confirmation pointed at a replica because it was faster, with no record of the staleness that buys. A-ARCH-28; the finding names the read site and the write it can lag behind, not the replication setting.
- Availability theater: an uptime target with one instance behind it, or a replica set whose router has no probe to remove a broken member. A-ARCH-29; the finding pairs the stated target with the replica count and the missing probe, and A-ARCH-11 stays the home for targets with no arithmetic at all.
- Vague findings: every F-ARCH block carries file:line and quotable evidence, or it is labeled Tentative or deleted.
- Double-billing: schema internals go to F-DB, exploitable isolation bypasses and injection to F-SEC, pipeline topology to F-DEPLOY, per the ownership map; this module cites, it does not re-score.
- Severity inflation: a missing ADR corpus on a weekend repo is Low, not Medium; calibration moves severity, never evidence.
