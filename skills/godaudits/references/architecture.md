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

Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: multi-service topology, multi-tenancy, async infrastructure, external integrations.

## Checks

Severities are funded-product calibration; intake's scale calibration moves them, never the evidence. A-ARCH-1 through A-ARCH-19 mirror R-ARCH-1 through R-ARCH-19; A-ARCH-20 onward are audit-only.

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
20. A-ARCH-20 No distributed monolith: no table written by more than one deployable, no request path chaining three or more sync service hops.
    Look: connection strings and migration consumers per service; grep `INSERT INTO`/`UPDATE` targets across `services/*`; trace one hot request path end to end.
    Fail: multi-writer table with divergent invariant enforcement: Critical (silent data corruption); request path fanning through three or more sync hops: High.
21. A-ARCH-21 Context boundaries hold at import level: no deep imports into another context's internals, no shared mutable singletons across contexts.
    Look: `grep -rn "\.\./\.\." src/` where the path crosses context directories; imports of a sibling context's `internal/` or `db/` paths.
    Fail: cross-context deep imports bypassing the public index: Medium; shared mutable singletons crossing contexts: Medium.
22. A-ARCH-22 A domain layer exists where the record claims boundaries: invariants, pricing, and state transitions are not coded inline in transport handlers.
    Look: bodies of `routes/`, `pages/api/`, controllers, and UI event handlers for business rules.
    Fail: load-bearing invariants enforced only inside transport handlers: Medium; the same invariant duplicated across handlers with drift between copies: High.
23. A-ARCH-23 (audit-only) API contract design, when an API or service surface exists: the API style is declared and applied consistently (REST, GraphQL, or RPC, not a different shape per endpoint); a versioning strategy exists that does not break existing consumers; a machine-readable contract (an OpenAPI document or a GraphQL schema) is present and matches the routes on disk; resources and URIs are modeled consistently for REST; and errors use one consistent envelope (RFC 7807 Problem Details or a documented equivalent), not an ad-hoc shape per endpoint.
    Look: route registration and handler signatures; an `openapi.*`, `swagger.*`, or GraphQL schema file diffed against the routes; version prefixes or content negotiation; the error-response shape across handlers.
    Fail: mixed API styles with no stated reason, no versioning strategy on a consumer-facing API, a contract file drifted from the routes, or inconsistent ad-hoc error shapes: Medium (High when consumers are external and a breaking change ships with no version). Cross-reference F-SEC for API auth and residue.

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

- [ ] GA-xxx Author a labeled container diagram from the built system
  - Files: docs/architecture/containers.mmd
  - Acceptance: mermaid source matching the deployables the repo actually ships; every edge label carries a protocol token (HTTP, gRPC, queue, or event); 15 boxes or fewer
  - Verify: `grep -q -- "-->" docs/architecture/containers.mmd`
  - Checks: A-ARCH-15, A-ARCH-18

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
- Vague findings: every F-ARCH block carries file:line and quotable evidence, or it is labeled Tentative or deleted.
- Double-billing: schema internals go to F-DB, exploitable isolation bypasses and injection to F-SEC, pipeline topology to F-DEPLOY, per the ownership map; this module cites, it does not re-score.
- Severity inflation: a missing ADR corpus on a weekend repo is Low, not Medium; calibration moves severity, never evidence.
