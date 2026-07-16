# Check map

Generated from `catalog/checks.json` by `npm run check-map`. Do not edit by hand.

18 domains, 429 checks, and 11 standards frameworks. Each check's ownership, weight, and standards mapping are derived from its domain module and the standards catalog.

## Standards frameworks

- **OWASP Web Top 10:2025** (`owasp-web-2025`): 10 categories, 43 mapped checks.
- **GDPR (EU 2016/679)** (`gdpr-eu`): 6 categories, 14 mapped checks.
- **CCPA / CPRA (California)** (`ccpa-cpra`): 4 categories, 7 mapped checks.
- **PIPEDA (Canada)** (`pipeda-ca`): 4 categories, 7 mapped checks.
- **WCAG 2.2 Level AA** (`wcag-2.2-aa`): 4 categories, 14 mapped checks.
- **AODA (Ontario, IASR WCAG 2.0 AA)** (`aoda-on`): 1 categories, 6 mapped checks.
- **ADA / Section 508 (US, WCAG 2.0 AA)** (`ada-508`): 1 categories, 5 mapped checks.
- **SOC 2 (Trust Services Criteria)** (`soc2-tsc`): 6 categories, 22 mapped checks.
- **ISO/IEC 27001:2022 (Annex A)** (`iso-27001`): 7 categories, 18 mapped checks.
- **PCI DSS v4.0** (`pci-dss-4`): 5 categories, 17 mapped checks.
- **HIPAA Security Rule** (`hipaa-security-rule`): 5 categories, 11 mapped checks.

## Domains

### product (product.md)

21 checks: 20 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-PRD-1 | weighted (Problem, user, and framing) | - | Verify the repo carries a product definition answering the seven pre-flight questions: problem, who  |
| A-PRD-2 | weighted (Problem, user, and framing) | - | Verify appetite or timeline is expressed as a duration bound to a scope-cut rule, never as an effort |
| A-PRD-3 | weighted (Problem, user, and framing) | - | Verify the problem statement is solution-free and specific: the "users today do X manually, which ta |
| A-PRD-4 | weighted (Problem, user, and framing) | - | Verify one primary user in five bullets: role, context, constraint, current workaround, citation or  |
| A-PRD-5 | weighted (Success metrics and live instrumentation) | - | Verify at most 5 success metrics, each with number, deadline, outcome frame, and named source; at le |
| A-PRD-6 | weighted (Requirements and promise integrity) | - | Verify functional requirements are user-observable, MoSCoW ranked under the caps (at most 50% Must,  |
| A-PRD-7 | weighted (NFR coverage) | - | Verify all ten NFR dimensions carry a threshold with a stated basis or an owned open question; secur |
| A-PRD-8 | weighted (Scope negative space) | - | Verify the negative-space record: 3 or more reasoned no-gos with reconsider conditions, a deferral,  |
| A-PRD-9 | weighted (Registers and question hygiene) | - | Verify risks and assumptions live in two separate complete registers, and validation artifacts exist |
| A-PRD-10 | weighted (Registers and question hygiene) | - | Verify every open product question carries owner, due date, blocking flag, and recommended default |
| A-PRD-11 | weighted (Registers and question hygiene) | - | Verify the product record passes the three-label test and contains none of the banned phrases |
| A-PRD-12 | weighted (Lifecycle, prior art, and closure) | - | Verify a prior-art record: 3 comparables, each with honest status (thriving, stagnant, dead, pivoted |
| A-PRD-13 | weighted (Lifecycle, prior art, and closure) | - | Verify the downstream pre-fill is reconstructable and true: entities, flows with error paths, roles, |
| A-PRD-14 | weighted (Lifecycle, prior art, and closure) | - | Verify a sign-off roster with specific attestations (problem, feasibility, flows, testability), neve |
| A-PRD-15 | weighted (Lifecycle, prior art, and closure) | - | Verify change control: lifecycle state declared, changelog rule followed, fork threshold named; post |
| A-PRD-16 | weighted (Lifecycle, prior art, and closure) | - | Verify exactly one visual-identity direction phrase exists for UI and launch to inherit |
| A-PRD-17 | weighted (Lifecycle, prior art, and closure) | - | Verify closure artifacts: a 30-day retro record or schedule with metric baselines, a top-5 support r |
| A-PRD-18 | weighted (Requirements and promise integrity) | - | Verify every outward promise has a shipped counterpart: README and landing feature claims map to liv |
| A-PRD-19 | weighted (Success metrics and live instrumentation) | - | Verify the metric-event mapping holds in both directions: every documented metric is computable from |
| A-PRD-20 | weighted (Requirements and promise integrity) | - | Verify monetization promises are enforced: every documented tier cap, quota, or plan boundary has an |
| A-PRD-21 | routing | - | Requirements traceability: a traceability record links each requirement to its design component, its |

### architecture (architecture.md)

22 checks: 22 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-ARCH-1 | weighted (Shape and grounding) | - | Architecture claims trace to a product constraint or a labeled assumption; plan-aware, the plan's ar |
| A-ARCH-2 | weighted (Shape and grounding) | - | Ceremony matches load. Re-run the load-bearing triggers against repo reality: persistence layers, de |
| A-ARCH-3 | weighted (Shape and grounding) | - | A numeric 12-month scale ceiling and binding NFRs are recorded where the team can find them, and eac |
| A-ARCH-4 | weighted (Shape and grounding) | - | Exactly one system shape is recorded with ADR-001 semantics: alternatives rejected, flip point, blas |
| A-ARCH-5 | weighted (Component boundaries and dependency structure) | - | Code boundaries are bounded contexts, not layers: no `UserService`/`CoreAPI`/`common` as a context,  |
| A-ARCH-6 | weighted (Component boundaries and dependency structure) | - | The cross-context dependency graph is cycle-free |
| A-ARCH-7 | weighted (Data architecture and invariants) | - | Storage shape matches each entity group's access pattern; tenancy and lifecycle are evident in the s |
| A-ARCH-8 | weighted (Data architecture and invariants) | owasp-web-2025/A10:2025 | Each cross-entity invariant has one enforcement point; cross-component state changes use an outbox o |
| A-ARCH-9 | weighted (Integration discipline) | owasp-web-2025/A10:2025 | Every network mutation carries a timeout, a retry policy with backoff and jitter, and an idempotency |
| A-ARCH-10 | weighted (Integration discipline) | - | Every heavy pattern present is justified by a recorded product constraint: event sourcing, CQRS, ser |
| A-ARCH-11 | weighted (NFR reality) | - | Recorded NFR targets survive arithmetic against the code path |
| A-ARCH-12 | weighted (NFR reality) | - | No bare quality adjectives stand in for numbers in architecture records |
| A-ARCH-13 | weighted (Trust boundary placement) | - | The four trust boundaries are locatable in code (network edge, authn, authz, tenant isolation); load |
| A-ARCH-14 | weighted (Decision records and drift) | - | An ADR corpus lives in-repo with flip point and blast radius fields; superseded ADRs are retained, n |
| A-ARCH-15 | weighted (Decision records and drift) | - | Version-controlled text diagrams exist and match the code: every arrow labeled with protocol and pur |
| A-ARCH-16 | weighted (Decision records and drift) | - | Architecture fitness functions are wired into CI: dependency conformance, data-ownership conformance |
| A-ARCH-17 | weighted (Decision records and drift) | - | The declared architecture is consistent with the manifests downstream work reads: declared storage,  |
| A-ARCH-18 | weighted (Decision records and drift) | - | Built system matches declared shape, the ghost-architecture catch: component count, writer-per-table |
| A-ARCH-19 | weighted (Decision records and drift) | - | Architecture records are specific: they fail the substitution test and stay under three pages of pro |
| A-ARCH-20 | weighted (Data architecture and invariants) | - | No distributed monolith: no table written by more than one deployable, no request path chaining thre |
| A-ARCH-21 | weighted (Component boundaries and dependency structure) | - | Context boundaries hold at import level: no deep imports into another context's internals, no shared |
| A-ARCH-22 | weighted (Component boundaries and dependency structure) | - | A domain layer exists where the record claims boundaries: invariants, pricing, and state transitions |

### stack (stack.md)

24 checks: 24 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-STACK-1 | weighted (Constraint and compliance fit) | - | Inventory truth. Rebuild the stack inventory from manifests and import sites; compare against any re |
| A-STACK-2 | weighted (Decision record and honesty triple) | - | Pre-flight basis on record. The six pre-flight answers (domain, team, budget posture, time-to-ship,  |
| A-STACK-3 | weighted (Constraint and compliance fit) | - | Constraints honored in code. Every stated hard constraint traces into config |
| A-STACK-4 | weighted (Bundle coherence) | - | Twelve dimensions accounted for. Framework, language/runtime, database, ORM, auth, UI library, clien |
| A-STACK-5 | weighted (Decision record and honesty triple) | - | Losers recorded. Decided dimensions name at least one rejected alternative with a reason |
| A-STACK-6 | weighted (Decision record and honesty triple) | - | Weights published. Any scored comparison in the record prints its weight vector |
| A-STACK-7 | weighted (Decision record and honesty triple) | - | Score rationale. Scores carry a one-line rationale; no unexplained 10, no sub-3 without a named fail |
| A-STACK-8 | weighted (Bundle coherence) | - | Pairing coherence. Exactly one occupant per single-slot category; no known-bad pairs |
| A-STACK-9 | weighted (Decision record and honesty triple) | - | Flip point. The record names the concrete signal that would reverse the bundle choice |
| A-STACK-10 | weighted (Decision record and honesty triple) | - | Ceiling as metric. The scale ceiling is a number or named boundary, not an adjective |
| A-STACK-11 | weighted (Decision record and honesty triple) | - | Switching cost. The rebuild bill for leaving the bundle is stated in engineer-weeks with the dominan |
| A-STACK-12 | weighted (Decision record and honesty triple) | - | Prior art. Novel or minority picks carry named comparable deployments with dates |
| A-STACK-13 | weighted (Constraint and compliance fit) | - | Compliance and ops fit. Regulated-path managed vendors show documentation status; self-hosted statef |
| A-STACK-14 | weighted (Dependency and runtime hygiene) | - | Liveness and version reality. Pinned versions exist; direct dependencies are maintained |
| A-STACK-15 | weighted (Cost realism) | - | Cost realism. The cost posture in config matches the product's scale |
| A-STACK-16 | weighted (Decision record and honesty triple) | - | Date and staleness trigger. The decision is dated and carries a re-check condition |
| A-STACK-17 | weighted (Decision record and honesty triple) | - | Decision artifact complete. `.stack-ready/DECISION.md` or an equivalent ADR set carries pre-flight,  |
| A-STACK-18 | weighted (Decision record and honesty triple) | - | Open questions owned. Recorded stack unknowns carry an owner, a due date, and a default |
| A-STACK-19 | weighted (Migration discipline (conditional)) | - | Migration discipline. Any dual-run in flight has an end condition, per-phase rollback checkpoints, a |
| A-STACK-20 | weighted (Decision record and honesty triple) | - | Rigor proportionality. A compact record naming a previously shipped identical bundle satisfies A-STA |
| A-STACK-21 | weighted (Bundle coherence) | - | Phantom stack members (audit-only). Framework-class dependencies with zero call sites |
| A-STACK-22 | weighted (Dependency and runtime hygiene) | - | Runtime version coherence (audit-only). Declared runtime versions agree everywhere |
| A-STACK-23 | weighted (Bundle coherence) | - | Lockfile discipline (audit-only). One package manager, one lockfile, committed |
| A-STACK-24 | weighted (Dependency and runtime hygiene) | - | Runtime EOL (audit-only). The pinned language runtime is inside its support window |

### database (database.md)

24 checks: 22 weighted, 2 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-DB-1 | weighted (Schema design) | - | The data-layer profile is reconstructable from the repo: paradigm (OLTP, analytics, document, mixed) |
| A-DB-2 | weighted (Schema design) | - | Every base table has a PRIMARY KEY; M:N goes through a junction table with composite PK and both FKs |
| A-DB-3 | weighted (Schema design) | - | Lifecycle fields are one constrained state column (CHECK, lookup FK, or enum), never boolean-flag ex |
| A-DB-4 | weighted (Types) | pci-dss-4/protect-stored-account-data | Money is integer minor units or `NUMERIC(p,s)` beside a currency column, everywhere including interm |
| A-DB-5 | weighted (Types) | - | Types are decided per column: `TIMESTAMPTZ` in UTC for instants, native `uuid` or `BINARY(16)` never |
| A-DB-6 | weighted (Referential integrity) | - | Every column naming another table's key carries a DDL FOREIGN KEY with an intentional `ON DELETE`: C |
| A-DB-7 | weighted (Referential integrity) | gdpr-eu/data-minimization-and-retention | Soft-delete and cross-boundary policy is decidable: children, hard FKs, and partial uniques behave p |
| A-DB-8 | weighted (Constraints) | - | Invariants are DB-enforced: NOT NULL on required columns, DB DEFAULTs mirroring app defaults, CHECKs |
| A-DB-9 | weighted (Constraints) | soc2-tsc/processing-integrity | Every payment, webhook, or dedup path persists a UNIQUE-constrained idempotency key in the same tran |
| A-DB-10 | weighted (Indexing) | - | Hot queries map to real indexes: every FK child column indexed on Postgres/Oracle; composites equali |
| A-DB-11 | weighted (Indexing) | - | Index types match access patterns: GIN for `jsonb`, arrays, tsvector, trigram; GiST for ranges and n |
| A-DB-12 | weighted (Query layer) | - | The query layer prevents N+1 with an eager-load primitive per rendered relation, projects columns on |
| A-DB-13 | weighted (Query layer) | - | Runtime posture: statement, lock, and idle-in-transaction timeouts set at the role default and survi |
| A-DB-14 | weighted (Transactions) | owasp-web-2025/A10:2025, soc2-tsc/processing-integrity, hipaa-security-rule/integrity | Multi-statement writes run in one transaction with guaranteed commit or rollback; mutable shared val |
| A-DB-15 | weighted (Transactions) | owasp-web-2025/A10:2025 | No external I/O inside an open transaction: commit-then-call, or a transactional outbox written in t |
| A-DB-16 | weighted (Migrations) | - | Schema changes are expand-contract: `CREATE INDEX CONCURRENTLY` outside a transaction, ADD COLUMN wi |
| A-DB-17 | weighted (Migrations) | - | Migrations are reversible or gated: tested down paths, or an explicit backup gate for destructive st |
| A-DB-18 | weighted (DB security) | - | Access posture: the app role holds DML only on its tables and a separate migration identity owns DDL |
| A-DB-19 | weighted (DB security) | gdpr-eu/security-of-processing, soc2-tsc/confidentiality, pci-dss-4/protect-stored-account-data, pci-dss-4/encrypt-transmission, hipaa-security-rule/transmission-security | Data protection binds in the database: multi-tenant isolation via RLS FORCEd with pooler-safe polici |
| A-DB-20 | weighted (Search) | - | Search uses the right primitive per feature: `pg_trgm` GIN for substring and fuzzy, `tsvector` plus  |
| A-DB-21 | weighted (Scale and operations) | gdpr-eu/data-minimization-and-retention, soc2-tsc/availability, iso-27001/backup-and-continuity | Growth and operations: every growth-bearing table (events, logs, audit, sessions, outbox) has retent |
| A-DB-22 | routing | - | Controls bind in shipped DDL, not annotations: hunt every named paper control (NOT VALID without a s |
| A-DB-23 | weighted (Scale and operations) | - | Non-relational and analytics surfaces are graded by their own physics, where denormalization is corr |
| A-DB-24 | routing | soc2-tsc/processing-integrity | Money flows reconcile end to end across every stage and store: the amount authorized or charged equa |

### security (security.md)

32 checks: 23 weighted, 9 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-SEC-1 | routing | owasp-web-2025/A06:2025 | The threat model is reconstructable from the repo: entry points enumerable, every trust boundary has |
| A-SEC-2 | routing | owasp-web-2025/A06:2025, gdpr-eu/privacy-by-design | Every conditional surface the fingerprint detected (uploads, outbound fetches, containers, CI/CD, LL |
| A-SEC-3 | weighted (Authorization and access control) | owasp-web-2025/A01:2025, gdpr-eu/security-of-processing, ccpa-cpra/reasonable-security, pipeda-ca/safeguards, soc2-tsc/security-common-criteria, iso-27001/access-control, pci-dss-4/access-control, hipaa-security-rule/access-control | Central deny-by-default authorization with object-level ownership inside the query: every load and m |
| A-SEC-4 | weighted (Authorization and access control) | owasp-web-2025/A01:2025, soc2-tsc/security-common-criteria, iso-27001/access-control, pci-dss-4/access-control, hipaa-security-rule/access-control | Server-side role checks on every privileged route with mutating verbs guarded like their GET sibling |
| A-SEC-5 | weighted (Authorization and access control) | owasp-web-2025/A01:2025, soc2-tsc/security-common-criteria, iso-27001/access-control | Trust placement: JWT claims used only after signature verification, CORS never the access control, c |
| A-SEC-6 | weighted (Authentication and sessions) | owasp-web-2025/A07:2025, soc2-tsc/security-common-criteria, pci-dss-4/access-control | Password KDF is argon2id, scrypt, bcrypt, or PBKDF2 at cost floors with per-user salts; constant-tim |
| A-SEC-7 | weighted (Authentication and sessions) | owasp-web-2025/A07:2025, soc2-tsc/security-common-criteria, pci-dss-4/access-control, hipaa-security-rule/access-control | Session and token design: CSPRNG session ids regenerated on privilege change, server-side logout inv |
| A-SEC-8 | weighted (Injection and input handling) | owasp-web-2025/A05:2025, iso-27001/secure-development, pci-dss-4/secure-systems-and-software | Parameterized queries with values passed separately; allowlisted dynamic identifiers; argv-array pro |
| A-SEC-9 | weighted (Injection and input handling) | owasp-web-2025/A05:2025, iso-27001/secure-development, pci-dss-4/secure-systems-and-software, hipaa-security-rule/integrity | Auto-escaping templating as the default with every raw-HTML escape hatch justified; no `eval`/`exec` |
| A-SEC-10 | weighted (Injection and input handling) | owasp-web-2025/A01:2025, owasp-web-2025/A05:2025, owasp-web-2025/A08:2025, iso-27001/secure-development, pci-dss-4/secure-systems-and-software | Outbound fetches of user-influenced URLs pass a scheme-and-host allowlist with private-range and met |
| A-SEC-11 | weighted (Crypto and data protection) | owasp-web-2025/A04:2025, gdpr-eu/security-of-processing, ccpa-cpra/reasonable-security, pipeda-ca/safeguards, soc2-tsc/confidentiality, iso-27001/cryptography, pci-dss-4/encrypt-transmission, hipaa-security-rule/transmission-security | AEAD-only encryption with unique nonces, CSPRNG for all security randomness, keys from KMS or env wi |
| A-SEC-12 | weighted (Crypto and data protection) | owasp-web-2025/A04:2025, gdpr-eu/security-of-processing, gdpr-eu/privacy-by-design, ccpa-cpra/reasonable-security, pipeda-ca/safeguards, soc2-tsc/confidentiality, iso-27001/cryptography, pci-dss-4/protect-stored-account-data, hipaa-security-rule/encryption-and-agreements | Sensitive data classified and protected: encryption at rest for regulated fields including backups,  |
| A-SEC-13 | weighted (Secrets management) | owasp-web-2025/A04:2025 | Secrets sourced from a manager or injected env with no hardcoded fallbacks, no tracked credential fi |
| A-SEC-14 | weighted (Secrets management) | - | Secret scanning wired to fail the build: gitleaks, detect-secrets, or trufflehog in pre-commit or CI |
| A-SEC-15 | weighted (Misconfiguration and hardening) | owasp-web-2025/A02:2025 | The security header set mounts before routes (enforcing CSP without `unsafe-inline`, HSTS, nosniff,  |
| A-SEC-16 | weighted (Misconfiguration and hardening) | owasp-web-2025/A02:2025, owasp-web-2025/A06:2025 | Resource controls per endpoint class: rate limits on auth, reset, OTP, search, and export; body-size |
| A-SEC-17 | weighted (Supply chain and CI/CD) | owasp-web-2025/A03:2025, owasp-web-2025/A08:2025, soc2-tsc/security-common-criteria, iso-27001/supplier-and-supply-chain | Supply chain integrity: a committed lockfile installed with `npm ci`, `--immutable`, or `--require-h |
| A-SEC-18 | weighted (Supply chain and CI/CD) | owasp-web-2025/A03:2025 | CI/CD access control: least-privilege job tokens, environment protection before prod, no self-approv |
| A-SEC-19 | weighted (API and web service) | owasp-web-2025/A08:2025 | API residue: GraphQL depth, complexity, and cost limits with introspection off in prod; no stale `/v |
| A-SEC-20 | weighted (Logging and privacy) | owasp-web-2025/A09:2025, gdpr-eu/security-of-processing, pipeda-ca/accountability, soc2-tsc/security-common-criteria, iso-27001/logging-and-monitoring, pci-dss-4/logging-and-monitoring, hipaa-security-rule/audit-controls | Security events logged (auth success and failure, resets, 403 denials, role grants, admin CRUD, expo |
| A-SEC-21 | weighted (Logging and privacy) | gdpr-eu/data-subject-rights, gdpr-eu/data-minimization-and-retention, ccpa-cpra/consumer-rights, pipeda-ca/access-and-accuracy, soc2-tsc/privacy | Regulated data, when present: a classification map evidenced in the schema; retention and deletion j |
| A-SEC-22 | weighted (Cloud, container, and IaC) | owasp-web-2025/A02:2025, owasp-web-2025/A08:2025 | Containers and IaC, when present: non-root digest-pinned minimal images without layer secrets; K8s s |
| A-SEC-23 | weighted (AI and LLM security) | - | LLM surfaces, when present: role-separated prompts treating retrieved and tool content as untrusted; |
| A-SEC-24 | routing | owasp-web-2025/A06:2025 | Paper-control sweep: every control discovered in the repo (middleware, validator, redactor, limiter, |
| A-SEC-25 | routing | owasp-web-2025/A06:2025 | Hardening evidence in the harden-ready mold: cross-tenant isolation and paper-control test suites ex |
| A-SEC-26 | weighted (Supply chain and CI/CD) | owasp-web-2025/A03:2025, iso-27001/vulnerability-management, pci-dss-4/secure-systems-and-software | Locked dependency versions cross-referenced against known advisories, read-only: flag locked version |
| A-SEC-27 | weighted (Secrets management) | - | Git history secrets sweep run by the auditor itself, not delegated to tooling config: history is sca |
| A-SEC-28 | routing | owasp-web-2025/A10:2025 | Every OWASP Web Top 10:2025 category receives a pass, fail, unknown, or justified not-applicable dis |
| A-SEC-29 | routing | - | Authorization parity across caller paths: every privileged operation enforces the same authenticatio |
| A-SEC-30 | routing | - | Caller-supplied selectors are ownership-bound before use: any identifier, email, slug, or hostname t |
| A-SEC-31 | routing | gdpr-eu/lawful-basis-and-consent, ccpa-cpra/opt-out-of-sale-and-sharing, pipeda-ca/consent, soc2-tsc/privacy | Consent and tracking lifecycle, when the product sets non-essential cookies, loads third-party track |
| A-SEC-32 | routing | gdpr-eu/records-and-transfers, ccpa-cpra/data-inventory, pipeda-ca/accountability, pci-dss-4/protect-stored-account-data, hipaa-security-rule/encryption-and-agreements | Regulated-data governance records exist in the repository when a regulatory surface is present: a da |

### llm (llm.md)

25 checks: 24 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-LLM-1 | weighted (Security, trust boundaries, and data governance: 17) | - | The trust-boundary architecture is real per LLM feature: every untrusted content source (RAG docs, t |
| A-LLM-2 | weighted (Prompt construction and context: 12) | - | Prompts flow through one versioned registry with strict role separation: durable instructions in the |
| A-LLM-3 | weighted (Prompt construction and context: 12) | - | Context assembly is budgeted and cache-stable: documents high, question last, token budget with wind |
| A-LLM-4 | weighted (Security, trust boundaries, and data governance: 17) | - | Every model-output sink validates: parameterized SQL, argv arrays, context-aware HTML encoding, URL  |
| A-LLM-5 | weighted (Security, trust boundaries, and data governance: 17) | - | No secrets or authorization rules live in prompts; every security decision runs in deterministic cod |
| A-LLM-6 | weighted (Security, trust boundaries, and data governance: 17) | - | Data governance is deliberate: PII minimized or redacted on the provider payload before send, provid |
| A-LLM-7 | weighted (Model selection and configuration: 10) | - | Model ids are pinned dated snapshots in one config constant with per-environment selection, a deprec |
| A-LLM-8 | weighted (Model selection and configuration: 10) | - | Sampling and limits fit each task: temperature near 0 for extraction, classification, structured out |
| A-LLM-9 | weighted (Model selection and configuration: 10) | - | Routing and fallback are live: the escalation trigger reflects answer quality and can actually fire; |
| A-LLM-10 | weighted (Provider API and SDK usage: 10) | - | Every response consumption branches on `stop_reason`, `finish_reason`, and refusal before parsing, w |
| A-LLM-11 | weighted (Provider API and SDK usage: 10) | - | Native SDK mechanics are used: structured outputs or tool calling over prose parsing, prompt caching |
| A-LLM-12 | weighted (Reliability: 10) | - | Reliability mechanics hold: a timeout on every call plus an overall deadline on multi-step operation |
| A-LLM-13 | weighted (Reliability: 10) | - | Failures surface: no except-pass or return-empty on model errors, bounded fan-out concurrency, a cir |
| A-LLM-14 | weighted (Output handling: 8) | - | Every parsed response is schema-validated before downstream use with strict schemas (`additionalProp |
| A-LLM-15 | weighted (Cost and token efficiency: 6) | - | Cost is controlled: model tier mapped to task value, pre-call per-user or per-tenant quotas, loop bu |
| A-LLM-16 | weighted (Latency: 4) | - | Latency is engineered: unbuffered streaming on user-facing paths, parallel independent calls, embedd |
| A-LLM-17 | weighted (Evaluation: 5) | - | An eval harness gates change: a golden dataset with negative, adversarial, and refusal cases per qua |
| A-LLM-18 | weighted (Evaluation: 5) | - | Judges and specialized evals are sound: rubric, randomized pairwise order, and a different model fam |
| A-LLM-19 | weighted (Observability: 5) | - | Observability is attached: a tracing wrapper on every call capturing prompt, response, model, latenc |
| A-LLM-20 | weighted (RAG and retrieval: 7, conditional) | - | Embedding parity and lifecycle: one pinned model and dimension across ingestion and query with the v |
| A-LLM-21 | weighted (RAG and retrieval: 7, conditional) | - | Retrieval is tuned: hybrid dense plus BM25 with rank fusion where the corpus holds exact identifiers |
| A-LLM-22 | weighted (Agents and tools: 6, conditional) | - | The loop is bounded and gated: rich tool schemas (descriptions, enums, required arrays), hard limits |
| A-LLM-23 | routing | - | Every control is central and on the blocking request path: one prompt assembly, one validated output |
| A-LLM-24 | weighted (Model selection and configuration: 10) | - | No deprecated or retired provider surface remains: retired model ids in callers, fallback chains, or |
| A-LLM-25 | weighted (Prompt construction and context: 12) | - | No prompt-claim-versus-payload gap: every control the prompt wording claims ("respond only with JSON |

### ux (ux.md)

22 checks: 21 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-UX-1 | weighted (Journeys and flows) | - | One primary actor per journey is reconstructible from the product itself, with functional, emotional |
| A-UX-2 | weighted (Journeys and flows) | - | The 2-4 primary journeys (signup to first value, main recurring task, recovery or upgrade, conversio |
| A-UX-3 | weighted (Usability and heuristics) | - | Every async action has loading, pending, disabled, and success states; every screen has an empty sta |
| A-UX-4 | weighted (Usability and heuristics) | - | Waits get treatment where the roughly 100ms/400ms RAIL and Doherty budgets cannot hold: skeletons or |
| A-UX-5 | weighted (Usability and heuristics) | - | Destructive actions carry undo or a recovery path, every state has a marked exit, no modal or wizard |
| A-UX-6 | weighted (Content and UX writing) | - | One term per concept and one label per action product-wide; buttons name the action or outcome, neve |
| A-UX-7 | weighted (Content and UX writing) | wcag-2.2-aa/understandable | Errors state what happened, why, how to fix it, and what happens next, at the field, in plain langua |
| A-UX-8 | weighted (Flow accessibility) | wcag-2.2-aa/operable, aoda-on/web-content-accessibility, ada-508/web-content-accessibility | Flow accessibility holds against the stated or inferable conformance target: full keyboard operabili |
| A-UX-9 | weighted (Forms and input (conditional: forms present)) | wcag-2.2-aa/understandable | Forms meet the Baymard standard: persistent visible labels, inline validation on blur, minimal field |
| A-UX-10 | weighted (Process and workflow (conditional: multi-actor workflows)) | - | Every multi-actor process runs on an explicit state machine: start and end states, a join for every  |
| A-UX-11 | weighted (Process and workflow (conditional: multi-actor workflows)) | - | Workflow integrity mechanics exist: server-side role checks on every transition, timeout or escalati |
| A-UX-12 | weighted (Process and workflow (conditional: multi-actor workflows)) | - | Flows carry no unexamined waste: no serial approvals that could parallelize, no deterministic rule-b |
| A-UX-13 | weighted (IA and navigation) | - | Navigation matches the actor's mental model: labels with information scent in user vocabulary, bread |
| A-UX-14 | weighted (Onboarding and activation (conditional: signup flow)) | - | The activation event is identifiable, the signup-to-value path carries no unjustified walls (account |
| A-UX-15 | weighted (Onboarding and activation (conditional: signup flow)) | - | Repeat-use products have a retention loop: saved state worth returning to and value-driven re-engage |
| A-UX-16 | weighted (Performance and responsiveness) | - | Responsiveness basics hold: a loading state on every async action, viewport meta with zoom enabled,  |
| A-UX-17 | weighted (Trust and anti-deception (conditional: billing or consent)) | gdpr-eu/lawful-basis-and-consent, ccpa-cpra/opt-out-of-sale-and-sharing | No deceptive patterns: cancellation as easy as signup, "Reject all" as prominent and as few clicks a |
| A-UX-18 | weighted (Interaction design) | - | Interactive components carry hover, focus, active, disabled, loading, empty, and error states; inter |
| A-UX-19 | weighted (Journeys and flows) | - | Context survives cross-channel and cross-device handoffs, multi-step flows show remaining progress,  |
| A-UX-20 | routing | - | Non-GUI surfaces get the same discipline: exit codes and messages follow the error standard, help ou |
| A-UX-21 | weighted (Interaction design) | - | No UX theater: spinners bound to no request, progress bars reflecting nothing, confirmations guardin |
| A-UX-22 | weighted (Usability and heuristics) | - | Dates, numbers, and currency match the user's locale, and format hints appear where input format mat |

### ui (ui.md)

24 checks: 23 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-UI-1 | weighted (Design system and theming) | - | The stack contract is reconstructable and singular: one framework, one rendering model, one styling  |
| A-UI-2 | weighted (Semantic structure) | wcag-2.2-aa/robust, ada-508/web-content-accessibility | Native elements do interactive work: `button` for actions, `a[href]` for navigation, native inputs,  |
| A-UI-3 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/perceivable, aoda-on/web-content-accessibility, ada-508/web-content-accessibility | Every control has an accessible name, every field a programmatic label, images follow an alt policy, |
| A-UI-4 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/operable, aoda-on/web-content-accessibility, ada-508/web-content-accessibility | ARIA is valid and keyboard discipline holds: widget roles carry mandatory states, ID references reso |
| A-UI-5 | weighted (Accessibility and inclusive markup) | - | Overlays run through one shared focus-managed primitive: focus set on open, trapped while open, rest |
| A-UI-6 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/operable, aoda-on/web-content-accessibility | Focus stays visible: a `:focus-visible` baseline exists and survives the cascade; no `outline: none` |
| A-UI-7 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/operable | Motion is gated: animation behind `prefers-reduced-motion`, `transform`/`opacity` only, pause contro |
| A-UI-8 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/understandable | Status and shell basics are wired: errors via `aria-describedby` plus `aria-invalid`, live regions w |
| A-UI-9 | weighted (Semantic structure) | wcag-2.2-aa/robust | Document structure holds per route: one `h1`, no skipped levels, a single `main` with landmarks, no  |
| A-UI-10 | weighted (Styling architecture) | - | Styling architecture is deliberate: a cascade strategy, no `!important` wars, a z-index scale, logic |
| A-UI-11 | weighted (Component state correctness) | - | Data views render the full state matrix: loading, empty, error, and success wired to real state; con |
| A-UI-12 | weighted (Responsive layout) | - | The responsive contract is real: reflow at 320 CSS px, fluid containers, dimensions reserved on medi |
| A-UI-13 | weighted (Render-path performance) | - | The render path is wired: the LCP element prioritized (`fetchpriority="high"` or the framework `prio |
| A-UI-14 | weighted (Design system and theming) | - | Token discipline holds: no raw hex/rgb or off-scale spacing, no arbitrary utility values, no hand-ro |
| A-UI-15 | weighted (Design system and theming) | - | Theming swaps end to end when in scope: every color routed through tokens that fully swap, `color-sc |
| A-UI-16 | weighted (Assets and media) | - | The asset pipeline is sound: modern formats with `srcset`/`sizes`, per-icon imports or a sprite, opt |
| A-UI-17 | weighted (I18n readiness (conditional)) | wcag-2.2-aa/perceivable | Localization is real: strings in the catalog including `alt` and `aria-label`, ICU or `Intl.PluralRu |
| A-UI-18 | weighted (Native UI (conditional)) | - | Native UI uses native primitives: `Pressable`/`TextInput` over tap-handler `View`s, accessibility pr |
| A-UI-19 | weighted (Accessibility and inclusive markup) | - | No paper controls: every declared protection traces to real wiring: spinners to pending state, live  |
| A-UI-20 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/operable | The eight always-Critical conditions are absent: keyboard lockout, unnamed core control, inescapable |
| A-UI-21 | weighted (Accessibility and inclusive markup) | wcag-2.2-aa/perceivable, aoda-on/web-content-accessibility, ada-508/web-content-accessibility | Color independence and computable contrast: no meaning carried by color alone; statically computable |
| A-UI-22 | weighted (Styling architecture) | - | The cascade is live: no never-matched `@media` blocks (breakpoint below the guarded element's own fi |
| A-UI-23 | weighted (Component state correctness) | - | Hydration and island wiring is deliberate: interactive islands carry client directives, no `use clie |
| A-UI-24 | routing | wcag-2.2-aa/operable, aoda-on/web-content-accessibility | WCAG 2.2 pointer target size and focus appearance: interactive targets meet the 24 by 24 CSS px mini |

### seo (seo.md)

25 checks: 24 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-SEO-1 | weighted (Crawlability and indexation control) | - | Every route class has a deliberate indexation disposition: public content indexable, authed app rout |
| A-SEO-2 | weighted (Rendering and content-in-HTML) | - | Body content, title, canonical, robots meta, and JSON-LD exist in the initial server HTML of every i |
| A-SEO-3 | weighted (Rendering and content-in-HTML) | - | Navigation is crawlable and status codes are honest: real `<a href>` links, a hard 404 for unknown r |
| A-SEO-4 | weighted (Crawlability and indexation control) | - | The robots.txt generator obeys the five constraints: no `Disallow: /` under `User-agent: *` in prod, |
| A-SEO-5 | weighted (Crawlability and indexation control) | - | The environment indexability guard fails safe (unset env resolves to noindex, prod never emits it) a |
| A-SEO-6 | weighted (Crawlability and indexation control) | - | The sitemap derives from the content model: only canonical, indexable, 200-status URLs, real per-URL |
| A-SEO-7 | weighted (Crawlability and indexation control) | - | Crawl traps consolidate: faceted navigation, sort orders, and session params canonicalize or noindex |
| A-SEO-8 | weighted (Canonicalization) | - | One canonical model: a single redirect layer enforcing host, scheme, and slash with single-hop 301/3 |
| A-SEO-9 | weighted (URL architecture and edge config) | - | Slug convention and lifecycle hold: lowercase hyphenated stable slugs, a redirect-map entry on every |
| A-SEO-10 | weighted (On-page content and semantics) | - | Every routable page has a unique title and description, exactly one meaningful h1, logical heading n |
| A-SEO-11 | weighted (On-page content and semantics) | - | Content images carry descriptive alt (empty alt on decorative), anchors are descriptive, and the E-E |
| A-SEO-12 | weighted (Structured data) | - | JSON-LD is server-rendered per template with required fields per type, ISO 8601 dates, ISO 4217 curr |
| A-SEO-13 | weighted (Structured data) | - | No fabricated structured data: no AggregateRating or Review without visible reviews in the same rend |
| A-SEO-14 | weighted (AI and generative-engine visibility) | - | The AI-crawler policy matches the three-way taxonomy and the stated visibility goal; `llms.txt` neve |
| A-SEO-15 | weighted (AI and generative-engine visibility) | - | Content templates are answer-extractable: h2/h3 sections, lists and tables instead of undifferentiat |
| A-SEO-16 | weighted (Core Web Vitals code signals) | - | The CWV code budget holds: LCP image never lazy and prioritized (`fetchpriority` or preload), dimens |
| A-SEO-17 | weighted (Social metadata and head hygiene) | - | Per-route social metadata: `og:title`/`og:type`/`og:url`/`og:image` plus description, site_name, loc |
| A-SEO-18 | weighted (Internationalization) | - | hreflang generates centrally from one locales list with reciprocity and self-reference, x-default to |
| A-SEO-19 | weighted (Feeds and installability) | - | feeds are valid with stable GUIDs and correct date formats, autodiscovery links point at feeds actua |
| A-SEO-20 | weighted (SEO observability) | - | SEO observability is wired: CI snapshot tests asserting title, canonical, robots meta, hreflang, and |
| A-SEO-21 | weighted (URL architecture and edge config) | - | Edge config is crawl-safe: CSP does not block the site's own render-critical assets, HSTS pairs with |
| A-SEO-22 | routing | - | Zero paper controls anywhere: `noindex:` robots lines, `priority`/`changefreq`, rel=next/prev shippe |
| A-SEO-23 | weighted (Canonicalization) | - | No canonical contradictions: no page emits both a canonical-to-elsewhere and a noindex, no canonical |
| A-SEO-24 | weighted (SEO observability) | - | Analytics hygiene: no duplicate tag firing (hardcoded gtag plus the same GA4 via GTM), no placeholde |
| A-SEO-25 | weighted (Social metadata and head hygiene) | - | Head hygiene: `meta charset` early in head, exactly one title element per rendered page, `html lang` |

### code-quality (code-quality.md)

26 checks: 24 weighted, 2 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-CODE-1 | weighted (Maintainability and budgets: 19) | - | A maturity and deployment-context declaration exists and the code's quality bars match it |
| A-CODE-2 | weighted (Architecture conventions: 19) | - | Layering holds in code: one dependency direction, no layer-skipping imports |
| A-CODE-3 | weighted (Architecture conventions: 19) | - | Similar features are built the same way, copying one canonical shape |
| A-CODE-4 | weighted (Architecture conventions: 19) | - | Abstraction fits the problem: repeated logic shares a helper, no speculative indirection |
| A-CODE-5 | weighted (Maintainability and budgets: 19) | - | Quality budgets are wired to lint rules: function and file length, nesting depth, parameter count, n |
| A-CODE-6 | weighted (Maintainability and budgets: 19) | - | Typing is strict and escape hatches carry an inline reason |
| A-CODE-7 | weighted (Maintainability and budgets: 19) | - | Deferred-work markers reference tracked issues |
| A-CODE-8 | weighted (Testing discipline: 19) | iso-27001/secure-development | Every critical path (authn, authz, payments, irreversible mutations) has tests asserting success and |
| A-CODE-9 | weighted (Testing discipline: 19) | - | Tests assert meaningful outcomes |
| A-CODE-10 | weighted (Testing discipline: 19) | - | Tests are deterministic by construction: injected clock, seeded randomness, no live network, order i |
| A-CODE-11 | weighted (Testing discipline: 19) | - | Coverage claims match machinery |
| A-CODE-12 | weighted (Error handling and resilience: 12) | owasp-web-2025/A10:2025 | Errors propagate with cause to one named boundary; nothing is swallowed |
| A-CODE-13 | weighted (Error handling and resilience: 12) | owasp-web-2025/A10:2025 | Outbound I/O carries timeouts and retries back off, both from a shared client |
| A-CODE-14 | weighted (Error handling and resilience: 12) | owasp-web-2025/A10:2025 | Multi-step operations cannot half-complete, and resources release on error paths |
| A-CODE-15 | weighted (Performance shapes: 10, conditional) | - | List queries paginate; per-item lookups batch |
| A-CODE-16 | weighted (Performance shapes: 10, conditional) | - | Caches state their invalidation, long-lived collections are bounded, hot paths do not block |
| A-CODE-17 | weighted (Dependencies: 9) | iso-27001/supplier-and-supply-chain | Dependencies are pinned and scanned: committed lockfile, no floating majors, advisory scanner in CI, |
| A-CODE-18 | weighted (Docs and drift: 6) | - | Docs match reality: README setup, build, and run commands exist; shipped endpoints, flags, and env v |
| A-CODE-19 | weighted (Operability hooks: 6, conditional) | - | Code-level observability hooks exist: structured logging at boundaries, a health check exercising a  |
| A-CODE-20 | weighted (Operability hooks: 6, conditional) | - | Config lives outside code with per-environment values; the build is reproducible; the run procedure  |
| A-CODE-21 | weighted (Testing discipline: 19) | - | The repo carries runnable verification entry points: one command each for tests, lint, and typecheck |
| A-CODE-22 | weighted (Maintainability and budgets: 19) | - | Recorded conventions are enforced, not aspirational: every quality rule stated in `AGENTS.md` or `CO |
| A-CODE-23 | weighted (Architecture conventions: 19) | - | Complexity stays out of load-bearing code: no deep nesting, long parameter lists, or god modules the |
| A-CODE-24 | weighted (Dependencies: 9) | - | Dependencies are alive: not majors behind, not abandoned, no deprecated APIs in active use |
| A-CODE-25 | routing | - | Live controls and lawful state machines: every stored or configured flag meant to gate behavior is a |
| A-CODE-26 | routing | - | Wall-clock correctness: availability, booking windows, recurring schedules, and generated occurrence |

### style-genome (style-genome.md)

23 checks: 23 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-DNA-1 | weighted (Enforced layer real) | - | Enforced layer real. Formatter and linter configs exist, their exact commands are wired into scripts |
| A-DNA-2 | weighted (Naming genome) | - | Casing per identifier kind. One casing per kind (functions, methods, types, constants, variables, fi |
| A-DNA-3 | weighted (Naming genome) | - | Word-choice genome. One verb per semantic, boolean prefixes (`is`/`has`/`should`), plural collection |
| A-DNA-4 | weighted (Comment voice) | - | Comment contract. Density and register uniform across the sample; comments say why, not what |
| A-DNA-5 | weighted (Structural genome) | - | Structural genome. Function size and extraction threshold consistent with the repo's own norm |
| A-DNA-6 | weighted (Control flow and error posture) | - | Control-flow posture. One habit per fork: early returns vs nesting, ternary tolerance, loops vs high |
| A-DNA-7 | weighted (Control flow and error posture) | - | Error posture consistency. One error strategy project-wide (throw typed, Result, error-return), vali |
| A-DNA-8 | weighted (Types, imports, tests) | - | Types conventions (conditional: typed stacks only). Return-type posture, `interface` vs `type`, `any |
| A-DNA-9 | weighted (Types, imports, tests) | - | Import conventions. Default vs named exports, alias vs relative paths, barrel policy: each either en |
| A-DNA-10 | weighted (Types, imports, tests) | - | Test conventions. One location and naming scheme, one structure, one case-naming style |
| A-DNA-11 | weighted (Idioms and glossary) | - | Idiom registry lived. Each canonical helper exists exactly once; no parallel utility overlaps its pu |
| A-DNA-12 | weighted (Idioms and glossary) | - | Domain glossary. One canonical noun per entity across code, columns, routes, and UI copy; one verb p |
| A-DNA-13 | weighted (Structural genome) | - | Reference shapes (conditional: archetypes with a recurring unit). Instances of the recurring unit (c |
| A-DNA-14 | weighted (Profile artifact) | - | Profile artifact. `CODEDNA.md` (or an equivalent style profile) exists: TL;DR near 10 rules, every r |
| A-DNA-15 | weighted (Profile artifact) | - | Specificity gate. No profile rule survives verbatim substitution into another repo |
| A-DNA-16 | weighted (Enforcement, wiring, freshness) | - | Agent wiring. The genome pointer lives in an idempotent `codedna:start` / `codedna:end` block inside |
| A-DNA-17 | weighted (Anti-tells and voice drift) | - | Anti-tells appendix. The profile names where this project deviates from AI defaults, and each listed |
| A-DNA-18 | weighted (Enforcement, wiring, freshness) | - | Enforcement loop. A diff check against the profile runs somewhere real: pre-commit hook, CI step, or |
| A-DNA-19 | weighted (Enforcement, wiring, freshness) | - | Freshness. The profile stamp postdates the last style-shifting change; refresh triggers named; a kno |
| A-DNA-20 | weighted (Profile artifact) | - | Evidence-derived profile. The profile describes the code, not taste: spot-verify three observed rule |
| A-DNA-21 | weighted (Anti-tells and voice drift) | - | AI-tells sweep (audit-only). Hunt catalog tells in the code itself: over-commenting, narrating the o |
| A-DNA-22 | weighted (Anti-tells and voice drift) | - | Style-fork detection (audit-only). The newest code speaks the same dialect as the oldest |
| A-DNA-23 | weighted (Enforced layer real) | - | Suppression density (audit-only). The enforced layer is not neutered from inside |

### agent-memory (agent-memory.md)

24 checks: 23 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-MEM-1 | weighted (Archetype and applicability) | - | The declared archetype matches the code. The project type stated in `agents/context.md` (or PLAN.mdx |
| A-MEM-2 | weighted (Loader and topology) | - | Root `AGENTS.md` carries the current Pillars protocol: standard reference, 6-step loading protocol,  |
| A-MEM-3 | weighted (Archetype and applicability) | - | Every Core concern (stack, arch, data, api, ui, auth, quality, development, release, deploy, observe |
| A-MEM-4 | weighted (Archetype and applicability) | - | Exclusions use structured `{name, reason}` form with project-specific reasons that survive the subst |
| A-MEM-5 | weighted (Floor pillars) | - | Floor pillars `agents/context.md` and `agents/repo.md` exist at `status: present` with `always_load: |
| A-MEM-6 | weighted (Archetype and applicability) | - | The pillar inventory covers the product's defining concern: `cli.md` for CLI tools, `ml.md` for pipe |
| A-MEM-7 | weighted (Format conformance) | - | Every pillar's frontmatter is complete and valid: `pillar` equals the leaf filename, selectors are n |
| A-MEM-8 | weighted (Format conformance) | - | Pillar bodies carry the exact 8 sections in order (Scope, Context, Decisions, Rules, Workflows, Watc |
| A-MEM-9 | weighted (Truthfulness) | - | Decisions entries state rationale consistent with reality; the audit checks each against manifests a |
| A-MEM-10 | weighted (Truthfulness) | - | Rules pass earn-your-keep (state only constraints not inferable from code) and the code obeys them ( |
| A-MEM-11 | weighted (Drift) | - | Context claims match the code: stack and version claims against manifests, file-location claims agai |
| A-MEM-12 | weighted (Drift) | - | Content sits in its owning pillar per the boundary tiebreakers: secrets guidance in `config.md` not  |
| A-MEM-13 | weighted (Format conformance) | - | The coupling graph is clean per scope: no pillar exceeds 3 `must_read_with` entries, no shared depen |
| A-MEM-14 | weighted (Lifecycle and CI) | - | No stale exclusions: every `excluded:` name still has zero code in its area |
| A-MEM-15 | weighted (Loader and topology) | - | Tool-native instruction files are one-line redirects to `AGENTS.md` and `./agents/`, never parallel  |
| A-MEM-16 | weighted (Lifecycle and CI) | - | Structural and routing validation runs in CI: a validator checks frontmatter, headings, identities,  |
| A-MEM-17 | weighted (Lifecycle and CI) | - | Maintenance is real, not aspirational: pillars update alongside the code they describe; Gaps entries |
| A-MEM-18 | weighted (Loader and topology) | - | The memory system is operable end to end: the portable matcher and depth-1 protocol compute determin |
| A-MEM-19 | routing | - | (audit-only) Non-Pillars memory is graded on equivalents, not zeroed: a lone `CLAUDE.md`, `.cursor/r |
| A-MEM-20 | weighted (Truthfulness) | - | (audit-only) No unsafe instruction content: memory must not direct agents to bypass verification or  |
| A-MEM-21 | weighted (Format conformance) | - | (audit-only) Portable routing is executable and stable: representative tasks preserve the determinis |
| A-MEM-22 | weighted (Loader and topology) | - | (audit-only) Nested scope inheritance is coherent: applicable scopes resolve root to leaf, nearest g |
| A-MEM-23 | weighted (Lifecycle and CI) | - | (audit-only) Local absent catalogs are internally consistent and truthful: version 1, unique valid i |
| A-MEM-24 | weighted (Format conformance) | - | (audit-only) Routed context stays within the Pillars 1.1 budgets unless a specific exception is docu |

### repo (repo.md)

24 checks: 23 weighted, 1 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-REPO-1 | weighted (Tier discipline and traceability) | - | Tier coherence. Reconstruct the type x stage x audience triple from signals and check the file inven |
| A-REPO-2 | weighted (Tier discipline and traceability) | - | Brownfield layering respected. Scaffold generations coexist coherently and an existing Pillars stand |
| A-REPO-3 | weighted (Security automation) | - | No destructive git automation. No script, hook, CI step, or task runner target runs destructive git  |
| A-REPO-4 | weighted (Essentials and hygiene) | - | Stack-derived artifacts. Every tooling file traces to the stack in the manifest |
| A-REPO-5 | weighted (CI and quality tooling) | - | Polyglot layering (conditional). With more than one language: a primary is evident, tooling is layer |
| A-REPO-6 | weighted (Essentials and hygiene) | - | No placeholders. Committed repo docs carry real values everywhere a template would stub |
| A-REPO-7 | weighted (Essentials and hygiene) | - | README proof test. README contains a description, install steps, a usage example, a license referenc |
| A-REPO-8 | weighted (Community and documentation) | - | Documentation set to tier. At reconstructed tier 2 plus: CONTRIBUTING names the real branch model, s |
| A-REPO-9 | weighted (CI and quality tooling) | - | CI runs the real pipeline. CI triggers on `pull_request` and push to the default branch and runs the |
| A-REPO-10 | weighted (CI and quality tooling) | - | Quality tooling set. One linter, one formatter, a git-hook manager, `.editorconfig`, and `.gitattrib |
| A-REPO-11 | weighted (CI and quality tooling) | - | One tool per job. No two tools share a job anywhere in the repo |
| A-REPO-12 | weighted (Security automation) | iso-27001/vulnerability-management | Security automation wired. At tier 2 plus: exactly one dependency bot with update grouping, a SAST w |
| A-REPO-13 | weighted (Release machinery (conditional)) | soc2-tsc/change-management | Release machinery consistent. One release tool, `vX.Y.Z` SemVer tags, and the same commit convention |
| A-REPO-14 | weighted (Release machinery (conditional)) | - | Tier boundary honesty. Tier 4 artifacts (signed commits, SBOM, provenance, ADRs, runbooks) are whole |
| A-REPO-15 | weighted (Agent safety) | - | Agent-safety layer. `.claude/settings.json` denies destructive commands, `.githooks/pre-push` exits  |
| A-REPO-16 | weighted (Community and documentation) | - | Cross-references closed. Every file a doc links to exists, and every badge maps to a configured serv |
| A-REPO-17 | weighted (Community and documentation) | - | Single naming across artifacts. Each core concept keeps one spelling across directory, test file, en |
| A-REPO-18 | weighted (Community and documentation) | - | No empty ceremony. No `.gitkeep`-only directories, no committed `.env`, no governance pack on a solo |
| A-REPO-19 | weighted (Tier discipline and traceability) | - | Stated finish line. The repo names its own hygiene bar somewhere durable: a target tier, a Mode C ba |
| A-REPO-20 | weighted (Tier discipline and traceability) | - | Upstream consistency. Repo artifacts agree with upstream decisions on disk instead of re-deciding |
| A-REPO-21 | weighted (Essentials and hygiene) | - | Version control reality (audit-only). The project is a git repository and the index is clean of arti |
| A-REPO-22 | weighted (CI and quality tooling) | - | Tests exist and CI runs them (audit-only). A real test suite exists and the CI test step executes it |
| A-REPO-23 | weighted (Release machinery (conditional)) | - | Delivery reality (audit-only, conditional). Runs only when the roadmap domain is excluded per `intak |
| A-REPO-24 | routing | - | Documentation profile completeness (audit-only). The documentation set matches the project's detecte |

### build (build.md)

22 checks: 22 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-BUILD-1 | weighted (Session state and closure) | - | The 12 pre-flight answers are reconstructable from the repo: who uses it and for what job, entities, |
| A-BUILD-2 | weighted (Vertical completeness) | - | Domain traps are encoded in the schema: money as integer cents or `Decimal` (never float), append-on |
| A-BUILD-3 | weighted (Real wiring and CTA completeness) | - | User data lives in a real persistence layer: survives reload, consistent across two sessions, no in- |
| A-BUILD-4 | weighted (Vertical completeness) | - | Each shipped feature is a complete vertical: schema, server CRUD with permission checks, client hook |
| A-BUILD-5 | weighted (Vertical completeness) | - | No layer skew: the repo does not show the 80-percent-per-layer signature of horizontal building |
| A-BUILD-6 | weighted (Real wiring and CTA completeness) | - | Every interactive element completes its chain to a user-visible outcome; blocked CTAs are removed, d |
| A-BUILD-7 | weighted (Real wiring and CTA completeness) | - | Every nav link resolves to a registered route, and no route ships as a placeholder |
| A-BUILD-8 | weighted (Auth, RBAC, and threat model) | - | Auth is real: bad credentials rejected, session stored and persisted, every protected route gated se |
| A-BUILD-9 | weighted (Auth, RBAC, and threat model) | - | RBAC is server-enforced: at least two roles, every mutation checks its permission-matrix cell on the |
| A-BUILD-10 | weighted (Auth, RBAC, and threat model) | - | The three threat answers (attacker gain, highest-blast-radius mutation, trust boundaries) are recons |
| A-BUILD-11 | weighted (Visual identity) | - | A visual identity was committed: tokens wired globally, at least one rendered component inherits `-- |
| A-BUILD-12 | weighted (States, feedback, and tests) | - | Async surfaces carry loading, empty, and error states; forms validate client and server side with in |
| A-BUILD-13 | weighted (States, feedback, and tests) | - | Each feature carries its tests in-slice: integration CRUD, permission-denial, axe on new pages, and  |
| A-BUILD-14 | weighted (Supply chain and hardening) | - | Every manifest dependency resolved against the registry: a lockfile entry exists for each, no typo-s |
| A-BUILD-15 | weighted (Supply chain and hardening) | iso-27001/secure-development, pci-dss-4/secure-systems-and-software | The hardening block landed: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy  |
| A-BUILD-16 | weighted (Real wiring and CTA completeness) | - | Production paths pass the hollow check: no TODO or implement-later markers, no raw `console.log` (lo |
| A-BUILD-17 | weighted (Session state and closure) | - | Session-state artifacts exist and match the code: a STATE.md scoped to build facts, an ADR for each  |
| A-BUILD-18 | weighted (Session state and closure) | - | If the repo presents as shipped (deploy config, release tags), the closure gates hold: zero live def |
| A-BUILD-19 | weighted (Vertical completeness) | - | Cross-cutting features (search, exports, notifications, theme toggle, audit-log viewer) query real d |
| A-BUILD-20 | weighted (Session state and closure) | - | In brownfield or replan mode, the keep-rewrite-discard inventory exists and every rewrite item shipp |
| A-BUILD-21 | weighted (Supply chain and hardening) | - | No unguarded destructive commands in project scripts: `migrate reset`, `db push --accept-data-loss`, |
| A-BUILD-22 | weighted (Real wiring and CTA completeness) | - | No orphaned routes: every registered page is reachable from nav, a link, or a documented deep link |

### roadmap (roadmap.md)

23 checks: 23 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-ROAD-1 | weighted (Capacity and cadence honesty) | - | Verify every calendar date rests on capacity math: executor count, engineer-weeks per cycle, rotatio |
| A-ROAD-2 | weighted (Capacity and cadence honesty) | - | Verify a cadence model is declared by name as an ADR-shaped paragraph with two rejected alternatives |
| A-ROAD-3 | weighted (Grounding and classification) | - | Verify every scheduled row passes the three-label test: grounded commitment, outcome-framed directio |
| A-ROAD-4 | weighted (Grounding and classification) | - | Verify every phase and task anchors to an upstream artifact: a requirements id, a named architecture |
| A-ROAD-5 | weighted (Precision gradient and ceiling) | - | Verify the precision ceiling matches upstream quality: full decomposition only where requirements an |
| A-ROAD-6 | weighted (Sequencing correctness) | - | Verify the task queue is topologically sorted and cycle-free: every Depends on line names an earlier |
| A-ROAD-7 | weighted (Sequencing correctness) | - | Verify the riskiest unknowns come first: every flagged hypothesis has a validation task (spike, prot |
| A-ROAD-8 | weighted (Sequencing correctness) | - | Verify parallelism stays within capacity: tracks per wave at or below executor count; `[P]` tasks ha |
| A-ROAD-9 | weighted (Capacity and cadence honesty) | - | Verify a named prioritization framework fits items to appetites, and oversized items were shrunk or  |
| A-ROAD-10 | weighted (Phase anatomy and gates) | - | Verify full phase anatomy: concrete name, binary Checkpoint gate, Must-haves block, anchored in-scop |
| A-ROAD-11 | weighted (Precision gradient and ceiling) | - | Verify the precision gradient: current cycle fully decomposed; later horizons decay to themes then o |
| A-ROAD-12 | weighted (Launch and hardening gates) | - | Verify any launch block is complete: named mode, banded date, readiness gates each scheduled as date |
| A-ROAD-13 | weighted (Launch and hardening gates) | - | Verify launch is gated on hardening: the first launch task depends on the security findings check, a |
| A-ROAD-14 | weighted (Executor handoff and delivery truth) | - | Verify the task list works as the downstream handoff: each build task carries owner or lane, appetit |
| A-ROAD-15 | weighted (Executor handoff and delivery truth) | - | Verify completion is artifact verification: every checked task's named artifacts exist non-empty on  |
| A-ROAD-16 | weighted (Phase anatomy and gates) | - | Verify upstream prerequisite guards: no phase started before its upstream artifacts existed, and ups |
| A-ROAD-17 | weighted (Governance, ledger, and freshness) | - | Verify the ledger is complete: every domain or sibling appears as done, skipped (with reason), impor |
| A-ROAD-18 | weighted (Governance, ledger, and freshness) | - | Verify governance is written down: review cadence, authority map per horizon, re-plan triggers, free |
| A-ROAD-19 | weighted (Governance, ledger, and freshness) | - | Verify the audience declaration and, if mixed, a redacted public derivative: no capacity math, no ow |
| A-ROAD-20 | weighted (Governance, ledger, and freshness) | - | Verify sign-off and retrospectives are scheduled work: attestation tasks before commitments hardened |
| A-ROAD-21 | weighted (Executor handoff and delivery truth) | - | Verify the plan matches the code (audit-only; this is the plan-drift check the ownership map assigns |
| A-ROAD-22 | weighted (Governance, ledger, and freshness) | - | Verify freshness against delivery and the arc artifact dependency chain (audit-only): the roadmap mo |
| A-ROAD-23 | weighted (Governance, ledger, and freshness) | - | Verify one source of truth and a complete arc ledger (audit-only): multiple roadmap artifacts agree  |

### deploy (deploy.md)

21 checks: 21 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-DEPLOY-1 | weighted (Artifact and promotion integrity) | soc2-tsc/change-management | Same-artifact promotion. One build step produces one content-addressed artifact promoted unchanged;  |
| A-DEPLOY-2 | weighted (Artifact and promotion integrity) | - | Artifact and config separation. The artifact carries no environment-specific values and no build-tim |
| A-DEPLOY-3 | weighted (Rollback truth per change class) | - | Change classification discipline. Shipped changes are classified reversible, data-forward, mixed, or |
| A-DEPLOY-4 | weighted (Rollback truth per change class) | owasp-web-2025/A10:2025, iso-27001/backup-and-continuity | Class-matched rollback artifacts. Reversible changes carry a revert command with time-to-revert; dat |
| A-DEPLOY-5 | weighted (Migration calendar and guardrails (conditional)) | - | Expand/contract calendar. Data-forward changes decompose into expand, migrate, cutover, and contract |
| A-DEPLOY-6 | weighted (Migration calendar and guardrails (conditional)) | - | Migration guardrail forms. Migrations on populated tables use the lock-safe forms |
| A-DEPLOY-7 | weighted (Pipeline gates and secrets) | - | Promotion ladder and parity. The rungs from build to prod are named, each with five parity propertie |
| A-DEPLOY-8 | weighted (Pipeline gates and secrets) | soc2-tsc/change-management | Eight gates in order. Build, test, artifact security scan, promote non-prod, promote staging, approv |
| A-DEPLOY-9 | weighted (Pipeline gates and secrets) | soc2-tsc/change-management | Approval by mechanism. Shipping to prod is a choice enforced by tooling, never a side effect of comm |
| A-DEPLOY-10 | weighted (Pipeline gates and secrets) | - | Secrets path and identity split. Runtime-only injection; least-privileged runtime identity distinct  |
| A-DEPLOY-11 | weighted (Rollout rigor) | soc2-tsc/availability | Rollout strategy and the four-field canary. Strategy named per change; every canary carries a named  |
| A-DEPLOY-12 | weighted (First-deploy and post-deploy discipline) | - | Cold-start evidence. First deploys to an environment walk the ten-gate checklist: reachability, DNS, |
| A-DEPLOY-13 | weighted (Rollout rigor) | - | Truthful readiness probe. The probe fails while a critical dependency is down; never 200-on-bind |
| A-DEPLOY-14 | weighted (Rollout rigor) | - | Flag lineage. No flag name is reused until the old code path behind it is confirmed removed |
| A-DEPLOY-15 | weighted (First-deploy and post-deploy discipline) | - | Post-deploy verification. Prod deploys are followed by healthcheck, a latency and error-rate window  |
| A-DEPLOY-16 | weighted (Rollback truth per change class) | owasp-web-2025/A10:2025 | Rehearsal and incident log. Revert commands run against a non-prod copy within 90 days of first depl |
| A-DEPLOY-17 | weighted (First-deploy and post-deploy discipline) | - | Handoff artifacts. Topology doc, healthcheck inventory, per-service rollback doc, and migration cale |
| A-DEPLOY-18 | weighted (Rollback truth per change class) | - | Destructive command gating. `terraform destroy`, `kubectl delete`, `prisma migrate reset`, and `rm - |
| A-DEPLOY-19 | weighted (Artifact and promotion integrity) | - | Rollback targetability (audit-only). Production references immutable artifact identities so the prev |
| A-DEPLOY-20 | weighted (Pipeline gates and secrets) | - | Deploy concurrency control (audit-only). Two merges cannot interleave deploys to the same environmen |
| A-DEPLOY-21 | weighted (Pipeline gates and secrets) | - | Pipeline-as-code reality (audit-only). The deploy path lives in the repo and changes to it are revie |

### observe (observe.md)

24 checks: 24 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-OBS-1 | weighted (Promise binding and SLO design) | - | Service and journey inventory truth. A durable inventory names every service with its topology type  |
| A-OBS-2 | weighted (Promise binding and SLO design) | - | Three-lane metric classification. Every charted or alerted metric is an SLI with an SLO, a diagnosti |
| A-OBS-3 | weighted (Promise binding and SLO design) | soc2-tsc/availability | SLO completeness. Each named journey has one SLI with a measurement query, one target, one window, o |
| A-OBS-4 | weighted (Promise binding and SLO design) | - | Error-budget policy. Every SLO carries a four-field policy: Trigger, Action, Stakeholder, Exit |
| A-OBS-5 | weighted (Promise binding and SLO design) | - | Feasibility ceiling. No SLO promises above the product of its upstream availabilities |
| A-OBS-6 | weighted (Promise binding and SLO design) | - | Low-traffic strategy. Journeys with fewer requests than 10x the error budget per window declare exte |
| A-OBS-7 | weighted (Alert derivation and severity) | owasp-web-2025/A09:2025 | Burn-rate paging. Every PAGE derives from an SLI burn rate with at least two windows; cause signals  |
| A-OBS-8 | weighted (Alert derivation and severity) | owasp-web-2025/A09:2025 | Runbook link and owner per page. Every PAGE rule carries a specific runbook URL (not a directory) an |
| A-OBS-9 | weighted (Alert derivation and severity) | owasp-web-2025/A09:2025 | Deadman switches and out-of-band routing. Every silent path alerts on absence, and paging does not d |
| A-OBS-10 | weighted (Logging, tracing, and error tracking) | - | Structured log contract. One JSON format with `trace_id`, `service`, `level`, `timestamp`, `event`;  |
| A-OBS-11 | weighted (Logging, tracing, and error tracking) | - | Trace propagation and sampling. OTel context crosses every boundary in the graph; SLO-backed service |
| A-OBS-12 | weighted (Logging, tracing, and error tracking) | iso-27001/logging-and-monitoring, pci-dss-4/logging-and-monitoring, hipaa-security-rule/audit-controls | Error tracking with release tags. Every service reports exceptions with `release` bound to the deplo |
| A-OBS-13 | weighted (Cost and cardinality (conditional)) | - | Cardinality budget. High-cardinality dimensions stay off per-series priced backends, with the exclus |
| A-OBS-14 | weighted (Dashboard discipline and independence) | - | Above-the-fold discipline. The primary dashboard leads with the burn-rate gauge and holds at most 7  |
| A-OBS-15 | weighted (Dashboard discipline and independence) | - | Artifact ownership. Every dashboard and alert carries owner and last_reviewed; at most 3 dashboards  |
| A-OBS-16 | weighted (Dashboard discipline and independence) | - | Surface independence. Dashboards, alert routing, runbooks, status page, trace store, and on-call sch |
| A-OBS-17 | weighted (Runbook and incident loop) | - | Executable runbooks. One runbook per PAGE with fenced commands using exact flags, hosted out-of-band |
| A-OBS-18 | weighted (Runbook and incident loop) | - | Incident loop. A SEV-1/2/3 ladder with response expectations, an IC rotation (or named solo responde |
| A-OBS-19 | weighted (Runbook and incident loop) | - | Learning loop. The post-mortem template forces at least one observability-gap action item with a due |
| A-OBS-20 | weighted (Promise binding and SLO design) | - | Bright line and watchlist. Conversion analytics stay out of the ops surface; SLOs missing a policy o |
| A-OBS-21 | weighted (Logging, tracing, and error tracking) | - | Log level honesty (audit-only). Levels mean what they claim: ERROR is actionable, DEBUG is off in pr |
| A-OBS-22 | weighted (Alert derivation and severity) | owasp-web-2025/A09:2025, owasp-web-2025/A10:2025 | Alert wiring liveness (audit-only). Every notification route actually delivers |
| A-OBS-23 | weighted (Logging, tracing, and error tracking) | - | Dark entry points (audit-only). Every entry point in the fingerprint emits some telemetry |
| A-OBS-24 | weighted (Alert derivation and severity) | - | Phantom signals (audit-only). Alerts and charts reference metrics the code actually emits |

### launch (launch.md)

23 checks: 23 weighted, 0 routing.

| Check | Role | Standards | Title |
|---|---|---|---|
| A-LAUNCH-1 | weighted (Positioning discipline) | - | Positioning exists and survives the substitution test: the four sentences (who it is for, what it re |
| A-LAUNCH-2 | weighted (Positioning discipline) | - | Tone and founder voice hold: three adjectives plus three anti-adjectives recorded, the hero in first |
| A-LAUNCH-3 | weighted (Positioning discipline) | - | Launch mode and tier are declared and scope the assets: a mode (A pre-launch through E quiet-B2B) an |
| A-LAUNCH-4 | weighted (Landing page and copy) | - | Landing anatomy: five sections in order (hero, social proof, feature grid, pricing if applicable, CT |
| A-LAUNCH-5 | weighted (Landing page and copy) | - | Feature grid honesty: 3-6 tiles, each naming a product-specific capability that exists in the codeba |
| A-LAUNCH-6 | weighted (Landing page and copy) | - | Banned-word audit: zero hits above the fold from the slop set (seamless, powerful, revolutionary, ef |
| A-LAUNCH-7 | weighted (Landing page and copy) | - | Copy voice: active voice, second person, named subjects, and no AI self-reference in the hero unless |
| A-LAUNCH-8 | weighted (Landing page and copy) | - | Brand tokens are real: a named brand color, two grays, one or two typefaces, and a real icon library |
| A-LAUNCH-9 | weighted (SEO and OG cards) | - | Launch-page SEO checklist: exactly one `<h1>`, `<title>` under 60 characters, meta description under |
| A-LAUNCH-10 | weighted (SEO and OG cards) | - | OG card to spec: exactly 1200x630, under 300KB, product name plus a 6-10 word value prop legible at  |
| A-LAUNCH-11 | weighted (SEO and OG cards) | - | Five-channel preview evidence: the OG card was previewed on X, LinkedIn (Post Inspector), Slack, iMe |
| A-LAUNCH-12 | weighted (Waitlist and email funnel) | - | The waitlist is not paper: a capture form of two fields max, double opt-in where the confirmation em |
| A-LAUNCH-13 | weighted (Waitlist and email funnel) | - | The email sequence is complete: 2-4 pre-launch emails each with a stated purpose, a launch-day drop, |
| A-LAUNCH-14 | weighted (Waitlist and email funnel) | - | Sending-domain authentication and consent: SPF, DKIM, and DMARC recorded in IaC or documented for th |
| A-LAUNCH-15 | weighted (Channels and etiquette) | - | Channel plans follow venue etiquette: each in-scope channel has all seven fields (venue, timing with |
| A-LAUNCH-16 | weighted (Telemetry and attribution) | - | UTM discipline: a utm-registry exists and every shareable link in launch assets (emails, post drafts |
| A-LAUNCH-17 | weighted (Telemetry and attribution) | - | The conversion waterfall is instrumented: the five events (visit, CTA click, form submit, confirmati |
| A-LAUNCH-18 | weighted (Channels and etiquette) | - | Amplification and response are named: at least 5 named humans or named roles with specific asks sent |
| A-LAUNCH-19 | weighted (Runbook and sibling coupling) | - | The runbook is real: D-7 to D+7 as a timezone-aware calendar, every row with a date, owner, and pass |
| A-LAUNCH-20 | weighted (Runbook and sibling coupling) | - | Sibling coupling holds: the status page is hosted off the app's infrastructure and linked from the f |
| A-LAUNCH-21 | weighted (Runbook and sibling coupling) | - | The cold proof checkpoint exists: the runbook ends with the cold proof test naming all five observat |
| A-LAUNCH-22 | weighted (Landing page and copy) | - | No fabricated or dead social surfaces: no invented testimonials, no logos of non-customers, no "as s |
| A-LAUNCH-23 | weighted (Runbook and sibling coupling) | - | Launch state matches reality: state and registry files agree with the repo and the calendar; a passe |

