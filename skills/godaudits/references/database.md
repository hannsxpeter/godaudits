# Database audit module

Audits the data layer of a shipped codebase: schema and data model, relationships, indexing, query and access patterns, transactions, migrations, data protection at the database tier, search, and scale. It reads schema files, migrations, ORM models, and query sites as written; it never connects to a live database, runs a migration, or executes `EXPLAIN` against a server. Findings are emitted as `F-DB-n` and a 0-100 domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads this module for any archetype that persists state (saas-dashboard, api-service, mobile-app backend, ml-pipeline metadata); stateless CLIs, static marketing sites, and pure libraries may exclude it with the reason recorded in the applicability matrix.

## Lineage

Descends from aihxp dbauditor, whose method DNA this module preserves intact: verify against the shipped DDL, never the ORM's promise (a `validates_uniqueness_of`, Django `unique=True`, or Prisma `@unique` enforces nothing in the database; the gap between the model claim and the migration DDL is itself the finding, often the worst one); hunt paper controls that exist for appearance but do not bind (a FK `NOT VALID` never `VALIDATE`d, RLS `ENABLE`d but not `FORCE`d, an inert `@Transactional`, a `statement_timeout` a transaction pooler discards); cluster leaves into one root finding; calibrate to the workload paradigm, not a relational ideal (denormalization is correct in a warehouse or document store); and cap the score on any hard Critical. dbauditor's eleven scored dimensions carry over as this module's Scoring table, and its rule that static code cannot prove row counts or query plans carries over as the Tentative confidence label with the confirming measurement named.

## Surface map

Inventory before any check runs. The intake fingerprint already lists schema files, migrations, ORM models, and raw query sites; cite that inventory, do not re-scan.

- Schema sources: migration directories (`db/migrate/`, `db/migrations/`, `migrations/`, `alembic/versions/`, `prisma/migrations/`), schema dumps (`schema.rb`, `structure.sql`, `schema.prisma`, `*.sql` DDL), ORM model classes.
- Query sites: repositories and DAOs, query-builder chains, raw SQL strings, stored procedures and triggers in DDL.
- Runtime config: pool settings, pooler config (pgbouncer mode), DSN options, ORM session setup. Connection-string values themselves belong to security.
- Infra declaring the datastore: `*.tf`, compose files, backup and PITR config.
- Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: write path (activates A-DB-14, A-DB-15), migration tooling or DDL history (A-DB-16, A-DB-17), search or retrieval feature (A-DB-20), multi-tenancy (A-DB-19), non-relational or analytics stores (A-DB-23).
- Before the checklist, trace the two or three highest-risk flows end to end: a hot list query and the indexes it can actually use, a money movement and its transaction and types, a parent delete and its cascade or orphan behavior. Spend effort proportional to blast radius.

## Checks

`A-DB-n` mirrors `R-DB-n` from the godplans database module one to one; A-DB-23 is audit-only. Default severities are funded-product calibration; intake scale calibration moves severity, never evidence. Anything that depends on row counts or plans static code cannot show is labeled Tentative.

1. A-DB-1 The data-layer profile is reconstructable from the repo: paradigm (OLTP, analytics, document, mixed), engine and version, sensitivity classes, tenancy model, growth expectations; every denormalized or derived column has a maintaining job, trigger, or generated column.
    Look: manifests, `docker-compose.yml`, ORM config, migration headers, `docs/`; derived columns (`*_count`, `*_total`, copied parent fields) diffed against jobs and triggers.
    Fail: derived column with no maintainer (drifts silently) -> High; engine or version contradicted across configs -> Medium.
2. A-DB-2 Every base table has a PRIMARY KEY; M:N goes through a junction table with composite PK and both FKs; no delimited or JSON id-list columns, no repeating groups (`phone1..phone3`), no unjustified EAV.
    Look: schema dumps and migrations; `LIKE '%` or `FIND_IN_SET` over id-ish columns; catch-all `meta`/`properties` tables of stringly values.
    Fail: base table with no PK (duplicates, broken CDC) -> High; id list in a text column -> High; unjustified EAV -> Medium.
3. A-DB-3 Lifecycle fields are one constrained state column (CHECK, lookup FK, or enum), never boolean-flag explosions; polymorphic links use per-parent FK columns with an exclusive-arc CHECK; naming is consistent; triggers and stored procedures are inventoried with an owner.
    Look: `status`/`state`/`type` columns in DDL; `*_type` plus `*_id` pairs; `CREATE TRIGGER`, `CREATE PROCEDURE`.
    Fail: free-text status with no constraint -> Medium; type-plus-id polymorphism with no enforceable FK -> High; business logic in unowned triggers -> Medium.
4. A-DB-4 Money is integer minor units or `NUMERIC(p,s)` beside a currency column, everywhere including intermediates and backfills.
    Look: `FLOAT|DOUBLE|REAL|:float` against `price|amount|balance|total|fee` columns; verify the migration DDL, not the model type.
    Fail: floating-point money -> Critical (hard cap); `DECIMAL` with defaulted precision and scale on MySQL -> High.
5. A-DB-5 Types are decided per column: `TIMESTAMPTZ` in UTC for instants, native `uuid` or `BINARY(16)` never `VARCHAR(36)`, `jsonb` never `json`/`TEXT`, utf8mb4 at server, table, and DSN, BIGINT on growth-bearing PKs and every mirroring FK, blobs in object storage by reference, NULL over sentinels (`''`, `-1`, `'9999-12-31'`).
    Look: column type declarations across all migrations; MySQL charset in DDL and driver DSN; sentinel literals in defaults and predicates.
    Fail: `TIMESTAMP` without tz for instants -> Medium; `INT`/`SERIAL` PK on a table that grows -> High (Critical needs a row count; mark Tentative).
6. A-DB-6 Every column naming another table's key carries a DDL FOREIGN KEY with an intentional `ON DELETE`: CASCADE only for disposable children (sessions, tokens, join rows), RESTRICT or managed delete for orders, invoices, ledger, audit; types and collations match both sides; mandatory links are NOT NULL; the rule lives in DDL, not only in ORM options (`dependent: :destroy`, Prisma `onDelete`).
    Look: `REFERENCES` in migrations diffed against `*_id` columns in models; ORM association options versus emitted DDL.
    Fail: `*_id` column with no DB FK (cluster when systemic) -> High; CASCADE reaching financial or audit tables -> Critical; FK type or collation mismatch -> High.
7. A-DB-7 Soft-delete and cross-boundary policy is decidable: children, hard FKs, and partial uniques behave per a stated rule when the parent is soft-deleted; cross-service references have an outbox or reconciliation job plus an orphan check; erasure reaches denormalized copies, caches, and logs.
    Look: `deleted_at` columns and their FK children; bare foreign ids from other services or databases; erasure code paths against the copy inventory.
    Fail: soft-deleted parents with live hard-FK children and no stated rule -> Medium; PII erasure missing denormalized copies -> High.
8. A-DB-8 Invariants are DB-enforced: NOT NULL on required columns, DB DEFAULTs mirroring app defaults, CHECKs for ranges (`qty >= 0`, `start_at <= end_at`), `CHECK ((a IS NULL) = (b IS NULL))` for paired nullables, natural keys (`email`, `sku`, `(tenant_id, slug)`) under DB UNIQUE, tenant-scoped UNIQUEs including `tenant_id`, nullable-UNIQUE semantics decided (partial index or `NULLS NOT DISTINCT`).
    Look: constraint clauses in DDL diffed against validation code in models, serializers, and DTOs.
    Fail: identity or natural key deduped only by app select-then-insert -> High; multi-tenant UNIQUE omitting `tenant_id` -> High; UNIQUE on a nullable column with no semantics decision -> Medium.
9. A-DB-9 Every payment, webhook, or dedup path persists a UNIQUE-constrained idempotency key in the same transaction as its effect; overlap invariants (bookings, reservations) use `EXCLUDE USING gist`, not check-then-act.
    Look: webhook handlers, payment captures, queue consumers; the INSERT and its backing constraint; reservation write paths.
    Fail: retried or externally triggered write with no UNIQUE-backed key -> Critical; overlap enforced by SELECT-then-INSERT -> High.
10. A-DB-10 Hot queries map to real indexes: every FK child column indexed on Postgres/Oracle; composites equality-first, one range column last, aligned with ORDER BY direction; case-insensitive lookups served by an expression index or `citext`; list endpoints and auth lookups each have a serving index.
    Look: index DDL against WHERE/JOIN/ORDER BY shapes in repositories and raw SQL; `LOWER(col)` predicates against expression indexes.
    Fail: unindexed FK child column -> High; hot list or auth path with no usable index -> High (Tentative when table scale is unknowable statically).
11. A-DB-11 Index types match access patterns: GIN for `jsonb`, arrays, tsvector, trigram; GiST for ranges and nearest-neighbor; BRIN for append-only time order; no prefix-redundant duplicates (`(a)` beside `(a,b)`), no lone low-cardinality singles; no paper indexes (leftmost column never filtered, partial predicate mismatched to the query, INVALID leftover from a failed CONCURRENTLY build).
    Look: `USING GIN|GIST|BRIN` in DDL against predicate shapes; duplicate index pairs in the schema dump.
    Fail: B-tree cited as serving a leading-wildcard or `jsonb` predicate -> Medium; unusable or INVALID index counted as coverage -> High.
12. A-DB-12 The query layer prevents N+1 with an eager-load primitive per rendered relation, projects columns on hot paths, paginates every list with keyset and a hard cap (deep OFFSET banned), keeps predicates sargable with typed binds, batches reads via `WHERE id = ANY(:ids)`, and has a COUNT strategy for large tables.
    Look: loops touching relations without `includes`, `select_related`, `JOIN FETCH`, or DataLoader; `OFFSET` and `SELECT *` on hot paths; function-wrapped indexed columns.
    Fail: N+1 on a rendered collection -> High; unbounded list query -> High; deep OFFSET pagination on a growing table -> Medium.
13. A-DB-13 Runtime posture: statement, lock, and idle-in-transaction timeouts set at the role default and surviving the pooler; pool sizing arithmetic against `max_connections` including serverless fan-out; sessions and connections released on all error paths.
    Look: role DDL, ORM and pool config, pooler mode; `finally`, `defer`, or context managers around connection checkout.
    Fail: no statement timeout anywhere -> Medium; transaction-mode pooler combined with session state (prepared statements, `SET`, advisory locks) -> High.
14. A-DB-14 Multi-statement writes run in one transaction with guaranteed commit or rollback; mutable shared values use atomic `SET col = col + delta`, a version-checked UPDATE with rowcount asserted, or `SELECT ... FOR UPDATE`; one canonical lock ordering; bulk writes chunked; SERIALIZABLE paths retry on 40001.
    Look: money, inventory, and counter writes; version columns present in the UPDATE's WHERE; transaction helpers and their error paths.
    Fail: read-modify-write on money or inventory with no lock, version, or constraint -> Critical; dependent writes as separate autocommit statements -> High.
15. A-DB-15 No external I/O inside an open transaction: commit-then-call, or a transactional outbox written in the same transaction; cross-service workflows get sagas or compensation; cache-fronted reads have an invalidation and stampede policy.
    Look: HTTP, payment, email, or S3 clients invoked between transaction begin and commit; outbox tables and their consumers.
    Fail: network call holding row locks inside a transaction -> High; cross-service write treated as atomic with no outbox -> High.
16. A-DB-16 Schema changes are expand-contract: `CREATE INDEX CONCURRENTLY` outside a transaction, ADD COLUMN without volatile defaults then batched backfill in separate commits, `SET NOT NULL` via `CHECK ... NOT VALID` then VALIDATE, renames and drops staged across deploys with tombstones, `lock_timeout` set for migration sessions, every NOT VALID paired with its VALIDATE.
    Look: migration files for single-step renames, type rewrites, unbatched UPDATE backfills, CONCURRENTLY inside transactional migrations.
    Fail: single-step rewrite or rename on a populated table -> High (Critical on a hot table; Tentative without scale evidence); NOT VALID never VALIDATEd -> High.
17. A-DB-17 Migrations are reversible or gated: tested down paths, or an explicit backup gate for destructive steps; idempotent DDL; a single migration head; a CI gate that lints (squawk or strong_migrations) and round-trips up-then-down.
    Look: down or `downgrade` bodies (a `pass` body is not a down path); CI workflows for migration jobs; duplicate heads in the migration graph.
    Fail: destructive migration with no down path and no backup gate -> High; no CI migration gate at funded-product scale -> Medium.
18. A-DB-18 Access posture: the app role holds DML only on its tables and a separate migration identity owns DDL; TLS is verify-full; encryption at rest is declared in IaC; the database binds to a private network. Injection sinks, dynamic-identifier allowlists, and committed connection strings are owned by security: cross-reference F-SEC per the ownership map, never re-score them here.
    Look: role and GRANT DDL; DSN options (`sslmode`, `rejectUnauthorized`, `useSSL`); IaC for `publicly_accessible`, `0.0.0.0/0` ingress.
    Fail: app connects as superuser or table owner -> High; TLS unverified -> High; database publicly reachable on its native port -> Critical.
19. A-DB-19 Data protection binds in the database: multi-tenant isolation via RLS FORCEd with pooler-safe policies, never app WHERE alone; column-level encryption or tokenization for PII/PHI; passwords under argon2id or bcrypt; CVV never stored; an audit trail on sensitive tables; views over PII scoped and `security_invoker`.
    Look: `FORCE ROW LEVEL SECURITY` per tenant-owned table; policy expressions against the pooling mode; sensitive column names (`ssn`, `pan`, `dob`, `diagnosis`) and their storage.
    Fail: tenancy by app WHERE alone -> Critical; RLS ENABLEd but not FORCEd while the app role owns the table -> High; CVV stored at all -> Critical.
20. A-DB-20 Search uses the right primitive per feature: `pg_trgm` GIN for substring and fuzzy, `tsvector` plus GIN with a matching config for FTS, relevance ranking present; external engines sync via outbox plus CDC with delete propagation (handler dual-write banned) and a documented reindex path; vector columns carry an ANN index whose operator class matches the query's distance operator; tenant and ACL filtering enforced in the source of truth.
    Look: `LIKE '%` and `ILIKE` on search features; `@@` queries against GIN expressions and configs; handlers writing the DB then the search engine; `hnsw`/`ivfflat` opclass against the query operator.
    Fail: leading-wildcard search with no trigram or FTS index -> High; dual-write search sync -> High; ANN opclass mismatch -> Medium.
21. A-DB-21 Growth and operations: every growth-bearing table (events, logs, audit, sessions, outbox) has retention via a reaper or partition drop; large append-only tables are range-partitioned with automated management; hot single-row counters are sharded or ledgered; read-your-writes routing covers money, auth, and inventory; slow-query observability, backup/PITR posture, and materialized-view refresh are stated.
    Look: partition DDL and its automation; scheduled jobs deleting by time; replica routing code; `pg_stat_statements` or slow-log config.
    Fail: unbounded growth table with no retention mechanism -> Medium (High on the hot path); post-write replica read on money or auth -> High.
22. A-DB-22 Controls bind in shipped DDL, not annotations: hunt every named paper control (NOT VALID without a scheduled VALIDATE, UNIQUE on nullable with no semantics decision, RLS ENABLEd not FORCEd, inert `@Transactional`, timeouts that die at the pooler); when three or more checks fail through the same ORM-promise root, cluster them into one systemic finding; record the strengths inventory (real FKs, integer or NUMERIC money, keyset pagination, DB-enforced uniqueness) into the audit's Strengths section so remediation does not regress it.
    Look: every model-level guarantee diffed against the migration DDL that should back it; the paper-control list above, verbatim.
    Fail: a control present for appearance that does not bind -> the severity of the defect it pretends to prevent; no strengths recorded for this domain -> the pass is unfinished.
23. A-DB-23 (audit-only) Non-relational and analytics surfaces are graded by their own physics, where denormalization is correct: MongoDB unbounded embedded arrays and advisory-only validators; DynamoDB hot or monotonic partition keys, `Scan` plus filter on routine reads, GSIs not covering their query; Cassandra unbounded partitions and `ALLOW FILTERING`; Redis as sole system of record without AOF, or no TTL under `noeviction`; warehouse and dbt incremental models without `unique_key` or tests.
    Look: collection schemas, key designs, table definitions, `dbt_project.yml` and model configs.
    Fail: Redis as the only durable store for domain data -> High; unbounded partition or embedded array on a growth path -> High; no `dbt test` coverage on marts -> Medium.

## Scoring

Weights carry over from dbauditor's dimension table. Conditional dimensions whose sub-surface is absent drop out, and the remaining weights re-normalize to 100 by proportional scaling (never zero-and-keep). A-DB-22 findings score into the dimension of the control they fake.

- Referential integrity (14): A-DB-6, A-DB-7.
- Indexing (13): A-DB-10, A-DB-11.
- Query layer (12): A-DB-12, A-DB-13.
- DB security (12): A-DB-18, A-DB-19.
- Schema design (11): A-DB-1, A-DB-2, A-DB-3.
- Constraints (10): A-DB-8, A-DB-9.
- Transactions (9, conditional: a write path exists): A-DB-14, A-DB-15.
- Types (7): A-DB-4, A-DB-5.
- Migrations (6, conditional: migration tooling or DDL history exists): A-DB-16, A-DB-17.
- Search (4, conditional: a search surface exists): A-DB-20.
- Scale and operations (2, re-weight up on strong growth signals): A-DB-21, A-DB-23.

Hard Criticals regardless of the weighted mean: float money, app-only tenancy, plaintext PII or stored CVV, a payment path with no idempotency UNIQUE, a public database binding, CASCADE destroying financial or audit data, an unprotected read-modify-write on money. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Seeds use the task grammar from audit-format.md. At audit time the agent adds the `Fixes:` line with real finding ids; seeds omit it.

- [ ] GA-xxx Add DDL foreign keys with intentional ON DELETE to unenforced relations
  - Files: db/migrations/0107_add_fks.sql, src/models/
  - Acceptance: every `*_id` column carries `REFERENCES` with an explicit `ON DELETE`; no CASCADE reaches orders, invoices, ledger, or audit tables; constraints added `NOT VALID` with their VALIDATE steps in the same migration series
  - Verify: `grep -c "NOT VALID" db/migrations/0107_add_fks.sql` matches the VALIDATE count in the series
  - Checks: A-DB-6, A-DB-16
- [ ] GA-xxx Replace floating-point money with integer minor units via expand-contract
  - Files: db/migrations/0108_money_cents.sql, src/services/billing.ts
  - Acceptance: new `amount_cents BIGINT` and `currency` columns; dual-write plus batched backfill in separate commits; old float column tombstoned and dropped in a later deploy
  - Verify: `grep -riEn "float|double precision|real" db/migrations src/models | grep -iE "amount|price|balance|total"` returns nothing
  - Checks: A-DB-4, A-DB-16
- [ ] GA-xxx Index FK child columns and hot list paths lock-safely
  - Files: db/migrations/0109_indexes.sql, docs/index-map.md
  - Acceptance: every FK child column indexed; composites equality-first and aligned with ORDER BY direction; every build uses `CREATE INDEX CONCURRENTLY` outside a transaction
  - Verify: `grep -c "CREATE INDEX CONCURRENTLY" db/migrations/0109_indexes.sql` equals the row count of docs/index-map.md minus header
  - Checks: A-DB-10, A-DB-11, A-DB-16
- [ ] GA-xxx Make payment writes idempotent and atomic
  - Files: db/migrations/0110_idempotency.sql, src/services/payments.ts
  - Acceptance: a UNIQUE idempotency key is inserted in the same transaction as its effect; balance updates are atomic `SET` or version-checked with rowcount asserted; no HTTP client call between transaction begin and commit
  - Verify: `npm test -- tests/db/idempotency.test.ts`
  - Checks: A-DB-9, A-DB-14, A-DB-15
- [ ] GA-xxx Force RLS on tenant-owned tables with pooler-safe policies
  - Files: db/migrations/0111_rls.sql, src/db/context.ts
  - Acceptance: every tenant-owned table has `FORCE ROW LEVEL SECURITY`; policies read the tenant from a per-transaction setting written at connection checkout; the app role holds DML only and the migration role owns DDL
  - Verify: `grep -c "FORCE ROW LEVEL SECURITY" db/migrations/0111_rls.sql` equals the tenant-owned table count
  - Checks: A-DB-18, A-DB-19
- [ ] GA-xxx Wire the migration CI gate and retention reapers
  - Files: .github/workflows/migrations.yml, jobs/reaper.ts
  - Acceptance: CI lints migrations with squawk or strong_migrations, asserts a single head, and round-trips up-then-down on a disposable database; every growth-bearing table has a reaper or partition-drop schedule
  - Verify: `grep -cE "squawk|strong_migrations" .github/workflows/migrations.yml`
  - Checks: A-DB-17, A-DB-21

## Anti-patterns hunted

- ORM-promise integrity: `validates_uniqueness_of`, `unique=True`, `@unique`, or `dependent: :destroy` beside a migration that emits a bare column. Hunt: diff every model guarantee against the DDL that should back it; the gap files under A-DB-6 or A-DB-8, clustered under A-DB-22 when systemic.
- Paper controls: FK `NOT VALID` never VALIDATEd, `UNIQUE` on a nullable column, RLS ENABLEd not FORCEd, `@Transactional` with autocommit never disabled or the proxy bypassed, timeouts a transaction pooler discards, an INVALID index from a failed CONCURRENTLY. Rule: a control that does not bind in the database scores as absent, at the severity of what it pretends to prevent.
- Float money: `FLOAT`, `DOUBLE`, or `REAL` on ledger, balance, or price columns. Hunt: type greps confirmed against migration DDL, never the model annotation; automatic Critical, domain capped.
- App-only uniqueness: SELECT-then-INSERT dedup on identity, payment, or idempotency keys. Hunt: handler code around INSERTs on natural keys; the race is a finding even without a reproduced duplicate.
- Lock-heavy migration theater: single-step renames, volatile-default ADD COLUMN, direct SET NOT NULL, CREATE INDEX without CONCURRENTLY on populated tables. Rule: every recommendation ships the lock-safe path; a fix that would cause the outage is a defect in the audit itself.
- Dual-write search sync: the request handler writing the database and the search engine in sequence, or a nightly rebuild cited as sync with no delete propagation. Hunt: search-engine client calls inside write handlers (A-DB-20).
- Dev-dataset evidence: an `EXPLAIN` capture or benchmark from toy data presented as production proof. Rule: static analysis cannot see row counts or plans; such findings are Tentative with the confirming measurement named.
- Double-billing: injection sinks and committed connection strings belong to security (cross-reference F-SEC); N+1 and missing indexes belong here and code-quality cross-references F-DB. Rule: one owner per the intake ownership map; this module never re-scores another domain's finding.
- Vague findings and severity inflation: "indexing could be improved" fails the substitution test; a missing index on a ten-row lookup graded like the hot orders join fails calibration. Rule: every finding names the table, column, and query with file:line, and severity scales with blast radius per intake scale calibration.
