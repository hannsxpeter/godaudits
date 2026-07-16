# Security audit module

Audits the security posture of the codebase the way secauditor would: read-only, source-to-sink, adversarial. It runs the R-SEC controls forward as A-SEC checks against the code as written, emits findings `F-SEC-n` and a 0-100 security domain score into AUDIT.json and its generated AUDIT.mdx view, and feeds Phase 1 of the remediation plan. The orchestrator loads this module in every domain-pass phase: per the intake hard rule, no archetype excludes security. Weekend-scale repos get calibrated severity, not a skipped pass, and the calibration is recorded in the applicability matrix.

## Lineage

Descends from secauditor (an 11-dimension read-only vulnerability audit anchored to OWASP 2025/2021, API Top 10 2023, ASVS, SLSA, and the OWASP LLM Top 10: source-to-sink evidence, per-dimension paper-control hunting, cluster-the-leaves-find-the-root discipline, and a fixed automatic-Critical list that caps the dimension and the overall score) and harden-ready (post-deploy adversarial verification: paper trust boundaries, compliance-without-security traps, class-not-instance hardening, and disclosure-program reality checks). Three disciplines carry over intact. A search hit is a lead, and only a read-confirmed source-to-sink path becomes a finding. Every candidate is adversarially refuted before recording: guards, framework defaults, and compensating controls are searched for first. And any control found defined but unwired is itself a finding, usually the worst one in the repo. The dimension weights in Scoring are secauditor's, carried verbatim.

## Surface map

Inventory before any check runs, citing the intake fingerprint for what it already holds (routes, entry points, manifests, CI workflows, LLM call sites: cite, do not re-scan):

- Execution path: bootstrap and middleware mount order (`src/app.*`, `src/server.*`, `main.py`, `manage.py`), route registration, webhook receivers, queue consumers.
- Auth surface: `auth/`, session and cookie config, `passport`, `jwt`, OAuth clients, password, MFA, and reset flows.
- Sinks: ORM and raw query sites (`.raw(`, `text(`, `$where`, string-built SQL), process invocation, template renders and HTML sinks, outbound fetches, file writes, deserializers, XML parsers.
- Secrets surfaces: `.env*`, `config/`, `Dockerfile*`, `.github/workflows/*.yml`, lockfiles, `.npmrc`, IaC files (`*.tf`, `k8s/`, `helm/`), plus full git history.
- Logging: shared formatters, redaction helpers, logger calls inside auth-failure and 403 branches.
- Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: auth, uploads, outbound fetches of user URLs, containers/IaC, CI/CD, LLM calls, regulated data. A surface detected in code overrides any declaration of absence.

## Checks

A-SEC-n mirrors R-SEC-n one to one; A-SEC-26 and A-SEC-27 are audit-only. Severities are funded-product calibration; scale them per intake. In plan-aware mode every finding's Checks line also carries the mirrored R-SEC id.

1. A-SEC-1: The threat model is reconstructable from the repo: entry points enumerable, every trust boundary has a locatable enforcement mechanism, principals and their limits discernible; plan-aware mode also diffs the plan's threat-model subsection against the routes on disk.
   Look: route registration, middleware mounts, webhook and upload handlers, queue consumers, README deployment claims, `.godplans/PLAN.mdx`.
   Fail: an entry point with no identifiable guard on its path, or a boundary named in docs with no enforcing code: Medium (High when it fronts tenant or regulated data).
2. A-SEC-2: Every conditional surface the fingerprint detected (uploads, outbound fetches, containers, CI/CD, LLM calls, regulated data) has its control set present in code, not silently uncontrolled.
   Look: the fingerprint surface list against the controls found by A-SEC-10, A-SEC-16, A-SEC-17, A-SEC-22, and A-SEC-23.
   Fail: a live surface with zero corresponding controls, such as an upload route with no validation anywhere: High.
3. A-SEC-3: Central deny-by-default authorization with object-level ownership inside the query: every load and mutation binds the id to the current user or tenant (`findOne({ id, ownerId })` or RLS), covering PUT/PATCH/DELETE, list, search, and export.
   Look: mount order in `app.use`/router files, `findById(req.params`, `findOne({ id`, `where: { id:` with no owner key, migrations for RLS policies, list and export handlers.
   Fail: a handler resolving a record by request-supplied id with no owner or tenant predicate: Critical on PII, financial, or cross-tenant data; High otherwise.
4. A-SEC-4: Server-side role checks on every privileged route with mutating verbs guarded like their GET siblings; allowlist DTO binding for writes and explicit response DTOs for reads.
   Look: admin route files, `Object.assign(user, req.body)`, `new Model(req.body)`, `permit!`, `fields = '__all__'`, serializer definitions.
   Fail: a request-settable `role`/`isAdmin`/`scope`/`tenant` field: Critical. Whole-body binding or raw ORM objects returned: High.
5. A-SEC-5: Trust placement: JWT claims used only after signature verification, CORS never the access control, client identity headers never trusted, signed URLs and storage keys scoped to the requester.
   Look: `jwt.decode(` versus `jwt.verify(`, reads of `X-User-Id` or tenant headers, CORS config treated as the only guard, storage URL generation.
   Fail: decode-without-verify feeding authorization: Critical. A trusted client identity header: High.
6. A-SEC-6: Password KDF is argon2id, scrypt, bcrypt, or PBKDF2 at cost floors with per-user salts; constant-time comparison on every credential, token, and HMAC; throttling mounted before login, MFA-verify, and reset routes; CSPRNG single-use reset tokens; generic auth errors; no env==dev bypass branch.
   Look: hashing calls in `auth/` (`md5`, `sha1`, `createHash` on passwords), `==` on tokens versus `timingSafeEqual`/`compare_digest`, limiter mount line against route registration order, reset token generation.
   Fail: fast-hashed or reversible passwords: Critical. Limiter mounted after auth routes, or `==` token comparison: High.
7. A-SEC-7: Session and token design: CSPRNG session ids regenerated on privilege change, server-side logout invalidation, Secure/HttpOnly/SameSite cookies; a JWT algorithm allowlist rejecting `alg:none` and RS256-to-HS256 confusion; OAuth is Code plus PKCE with exact-match `redirect_uri` and session-bound state; MFA enforced on the real path.
   Look: session config, cookie options, the `algorithms:` option on verify calls, OAuth client config, `startsWith` in redirect validation.
   Fail: no algorithm allowlist or `alg:none` accepted: Critical. Missing session regeneration or cookie flags: Medium.
8. A-SEC-8: Parameterized queries with values passed separately; allowlisted dynamic identifiers; argv-array process invocation with the shell disabled and `--` separators; stored data re-encoded at every reuse.
   Look: string-concatenated SQL, `.raw(`, `.extra(`, `text(` fed f-strings or template literals, `{$where:`, `child_process.exec(`, `shell=True`, `system(`.
   Fail: user or stored input in a string-built query or shell command: Critical.
9. A-SEC-9: Auto-escaping templating as the default with every raw-HTML escape hatch justified; no `eval`/`exec`/`new Function` on input; redirect targets validated same-origin; merge utilities guard `__proto__`.
   Look: `dangerouslySetInnerHTML`, `|safe`, `mark_safe`, `v-html`, `[innerHTML]`, `eval(`, `new Function(`, `?next=` into redirects, recursive merge helpers.
   Fail: request or DB data in a raw-HTML sink: High (Critical when reachable unauthenticated). Code execution on input: Critical.
10. A-SEC-10: Outbound fetches of user-influenced URLs pass a scheme-and-host allowlist with private-range and metadata-IP blocking and post-redirect re-checks; input-derived paths canonicalized with base-dir containment (archives included); no native deserialization of untrusted bytes; DTDs off on every XML parser.
    Look: fetch/axios/requests calls fed request data, webhook target registration, `path.join(req`, archive extraction, `pickle.loads`, `yaml.load(`, `readObject`, XML parser factories.
    Fail: an unallowlisted user URL fetched server-side: High (Critical when cloud metadata is reachable). Native deserialization of untrusted bytes: Critical.
11. A-SEC-11: AEAD-only encryption with unique nonces, CSPRNG for all security randomness, keys from KMS or env with a rotation scheme the code honors, TLS 1.2+ everywhere including DB and cache links, and certificate validation never disabled in any branch.
    Look: cipher mode choices, ECB or MD5/SHA-1 for integrity, `Math.random` for tokens, hardcoded IVs or keys, `rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify: true`.
    Fail: cert validation disabled on a reachable path: Critical. A broken primitive or non-CSPRNG token: High.
12. A-SEC-12: Sensitive data classified and protected: encryption at rest for regulated fields including backups, `Cache-Control: no-store` on sensitive responses, no secrets or PII in URL query strings or logs.
    Look: schema for PII/PHI/PAN columns, response headers on auth and account routes, tokens in query strings, log statements near sensitive objects.
    Fail: a regulated field plaintext at rest where the regime demands otherwise: High. A token or PII in a URL: Medium.
13. A-SEC-13: Secrets sourced from a manager or injected env with no hardcoded fallbacks, no tracked credential files, no client-exposed server secrets, no Docker layer secrets, CI referencing `secrets.*` only.
    Look: `git ls-files` for `.env`, `*.pem`, `credentials*.json`; provider key shapes (`AKIA`, `sk_live_`, `ghp_`, PEM blocks); `process.env.X || "literal"` fallbacks; `NEXT_PUBLIC_`/`VITE_` prefixes on server secrets; Dockerfile `ENV`/`ARG`/`COPY .env`.
    Fail: a live committed secret: Critical, and rotation, not deletion, is the fix. A hardcoded fallback or client-exposed secret: High.
14. A-SEC-14: Secret scanning wired to fail the build: gitleaks, detect-secrets, or trufflehog in pre-commit or CI, full-history scope, no soft-fail.
    Look: `.pre-commit-config.yaml`, workflow files for scanner steps, `continue-on-error`, `|| true`, a mass-allowlisted `.secrets.baseline`.
    Fail: no scanner on a repo with CI: Medium. A scanner present but soft-failed or HEAD-only: High (paper control).
15. A-SEC-15: The security header set mounts before routes (enforcing CSP without `unsafe-inline`, HSTS, nosniff, frame-ancestors, Referrer-Policy) with a presence test; exact-match CORS; production hardened: debug off by default, generic error handlers, no exposed Swagger, introspection, `.git`, or `.env` routes, TRACE off.
    Look: helmet or equivalent mount line against route registration, CSP directives, CORS origin logic for reflection or `startsWith`, `DEBUG` defaults, docs and introspection route guards.
    Fail: reflected Origin with credentials, or debug defaulting on: High. No enforcing CSP or no header test: Medium.
16. A-SEC-16: Resource controls per endpoint class: rate limits on auth, reset, OTP, search, and export; body-size limits; server-enforced max page size; quotas on paid actions; uploads validated by magic bytes with sanitized names stored outside the web root.
    Look: limiter configs and which routes mount behind them, `limit`/`page_size` handling, upload middleware options, filename handling.
    Fail: no limiter on auth endpoints, or extension-blocklist uploads: High. Unbounded pagination or a missing body cap: Medium.
17. A-SEC-17: Supply chain integrity: a committed lockfile installed with `npm ci`, `--immutable`, or `--require-hashes`; digest-pinned base images; actions pinned to 40-char SHAs; ignore-scripts in CI; SCA gating on high or critical with no soft-fail; SBOM from the real graph.
    Look: workflow install commands, `uses:` lines carrying `@v` tags, Dockerfile `FROM` lines, `.npmrc`, audit steps with `|| true` or `--audit-level=none`.
    Fail: a floating third-party action, or `npm install` in CI despite a lockfile: Medium. A soft-failed SCA gate: High (paper control).
18. A-SEC-18: CI/CD access control: least-privilege job tokens, environment protection before prod, no self-approval, protected branches enforced, no `pull_request_target` or `workflow_run` running fork code with secrets in scope.
    Look: `permissions:` blocks, `write-all`, `pull_request_target` paired with a checkout of the PR head, environment definitions.
    Fail: a poisoned-pipeline pattern with secrets reachable: Critical. A missing permissions block or ungated prod deploy: Medium.
19. A-SEC-19: API residue: GraphQL depth, complexity, and cost limits with introspection off in prod; no stale `/v1` or `/internal` mounts with weaker auth; anti-automation on high-value flows; hardened outbound clients (TLS verify on, timeouts, bounded redirects); webhooks verified inbound (HMAC plus replay window) and signed outbound.
    Look: GraphQL server options, route mounts for versioned prefixes, webhook receiver signature checks and their comparison operator, outbound client options.
    Fail: an unverified inbound webhook mutating state: High. Introspection open plus weakly-authed resolvers in prod: High; either alone: Medium.
20. A-SEC-20: Security events logged (auth success and failure, resets, 403 denials, role grants, admin CRUD, exports) with actor, target, source IP, and outcome at a production-visible level; redaction lives in the shared formatter; CR/LF neutralized. Redaction is owned here; alert routing shape cross-references F-OBS per the ownership map.
    Look: catch and deny branches in auth middleware for logger calls, formatter config for redaction, `console.log` of request or user objects.
    Fail: secrets or PII in logs: High. Silent 403 and auth-failure branches: Medium.
21. A-SEC-21: Regulated data, when present: a classification map evidenced in the schema; retention and deletion jobs whose erasure reaches backups, caches, indexes, and logs; consent checked in code; audited reads; DSAR code paths.
    Look: schema annotations, delete endpoints (soft-delete flags versus purge jobs), consent middleware, audit tables.
    Fail: erasure that only soft-deletes while copies persist in logs or backups: High. No consent enforcement where the regime requires it: High.
22. A-SEC-22: Containers and IaC, when present: non-root digest-pinned minimal images without layer secrets; K8s securityContext (runAsNonRoot, no privilege escalation, drop ALL), default-deny NetworkPolicy, least-privilege RBAC; no public buckets, no `0.0.0.0/0` to SSH, RDP, or databases, no wildcard IAM, IMDSv2 required; IaC and image scanning gating CI.
    Look: `Dockerfile*` USER and FROM lines, securityContext blocks in `k8s/` or `helm/`, `*.tf` for `acl`, ingress CIDRs, `Action: "*"`, scanner steps for `--soft-fail`.
    Fail: a public bucket or open database ingress: Critical. A root container or wildcard IAM: High.
23. A-SEC-23: LLM surfaces, when present: role-separated prompts treating retrieved and tool content as untrusted; model output validated before any sink; per-action authorization and human gates on high-impact tools; loop and spend budgets; no secrets or authz rules living only in the system prompt; ACL and tenant filters inside vector similarity queries. Prompt quality, model choice, and token cost cross-reference F-LLM per the ownership map.
    Look: prompt assembly sites, model-output flows into `eval`, shell, SQL, HTML, or URLs, tool definitions and their credential scope, similarity query filters.
    Fail: injectable input reaching a shell, eval, or SQL sink through model output: Critical. Unfiltered cross-tenant vector retrieval: High.
24. A-SEC-24: Paper-control sweep: every control discovered in the repo (middleware, validator, redactor, limiter, scanner, policy) is verified mounted on the execution path with a test proving it fires; and none of the automatic-Critical conditions exist: user-settable roles, unsigned-JWT acceptance, fast-hashed passwords, live committed secrets, public buckets or open DB ingress, prompt injection into shell, eval, or SQL.
    Look: the definition site against the mount site for every guard surfaced by A-SEC-3 through A-SEC-20; `tests/` for a firing assertion per control.
    Fail: a control defined but unwired: High, and it counts as absent for every other check. Any automatic-Critical condition: Critical, with no calibration discount.
25. A-SEC-25: Hardening evidence in the harden-ready mold: cross-tenant isolation and paper-control test suites exist and run in CI; SECURITY.md plus `/.well-known/security.txt` with a named owner for deployed apps; class-level regression guards for finding classes fixed in the repo's history.
    Look: `tests/security/`, the CI test invocation, `SECURITY.md`, a static or route-served `security.txt`, lint rules or tests guarding previously fixed classes.
    Fail: a multi-tenant app with no isolation test: High. A deployed app with no disclosure baseline: Medium.
26. A-SEC-26 (audit-only): Locked dependency versions cross-referenced against known advisories, read-only: flag locked versions carrying published high or critical CVEs on code paths the app exercises.
    Look: lockfiles against advisory knowledge, then the import sites of each flagged package to confirm the vulnerable surface is actually used.
    Fail: a known-critical CVE in a used dependency: High (Critical when the vulnerable function is reachable from an entry point).
27. A-SEC-27 (audit-only): Git history secrets sweep run by the auditor itself, not delegated to tooling config: history is scanned, not just HEAD, because a secret deleted from the working tree but never rotated is still live.
    Look: `git log -p` over credential-shaped patterns and deleted `.env` or key files; rotation evidence in later commits or docs.
    Fail: a provider-shaped credential in history with no rotation evidence: Critical when plausibly live, High otherwise.
28. A-SEC-28 (audit-only): Every OWASP Web Top 10:2025 category receives a pass, fail, unknown, or justified not-applicable disposition backed by its owning checks, including A10 exceptional-condition paths.
    Look: map A01 through A10 to this module's checks and cross-referenced ARCH, CODE, DB, DEPLOY, and OBS findings; for A10 trace dependency failure, partial writes, resource exhaustion, invalid state transitions, restart recovery, and authorization or validation dependency failure.
    Fail: any category silently uninspected: Medium. A catch-all that returns success, drops work, bypasses a control, leaks sensitive errors, or permits an unauthorized transition on failure: High (Critical when exploitation crosses a tenant or regulated-data boundary).
29. A-SEC-29 (audit-only): Authorization parity across caller paths: every privileged operation enforces the same authentication, tenant-suspension, step-up or MFA, and role gate on EVERY path that can reach it, not only on the primary interactive one. The paths are an interactive session, an API key or bearer token, a publicly exported function, an action whose authorization runs inside a non-writable query context, and any agent or tool call.
    Look: the API-key or token auth path against the interactive guard for suspension, MFA, and role parity; `mutation` versus `internalMutation` exports of privileged handlers; action handlers whose only authorization runs inside an internal query; agent or tool definitions that pass caller-influenced arguments into privileged mutations; a route group reachable under a shared-path list on a non-owning host whose gate keys off the host context.
    Fail: a privileged resource reachable through a caller path that skips a gate its sibling enforces (an API key still valid after tenant suspension, MFA enforced at the page but not at the token or API, a role checked in the wrapper while the raw action stays public, a step-up keyed to a host context the resource does not require): High (Critical when the gap moves money, crosses a tenant, or grants physical access).
30. A-SEC-30 (audit-only): Caller-supplied selectors are ownership-bound before use: any identifier, email, slug, or hostname taken from the request body, query, or model output that selects a record is verified to belong to the authenticated principal, and for an email or hostname is proven controlled by the caller, before that record is read, charged, mutated, or state-transitioned.
    Look: mutations, actions, and tools that resolve a member, booking, tenant, space, listing, or domain from a caller-supplied id, email, or hostname; whether the resolved document's tenant or owner is checked against the caller; public checkout that attaches an existing member by email; unauthenticated verification that transitions state by hostname; agent tools acting on a model-chosen id.
    Fail: a caller-supplied selector reaches a read, charge, mutation, or state transition without being bound to the authenticated principal (public checkout spending an existing member's credit by email, unauthenticated domain-verify taking a tenant offline, an agent tool writing into a model-named booking's tenant): High (Critical when it spends money or credit, exposes another tenant, or overwrites another party's data).
31. A-SEC-31 (audit-only): Consent and tracking lifecycle, when the product sets non-essential cookies, loads third-party trackers, or processes personal data of consumers in a consent regime (GDPR, CCPA/CPRA, PIPEDA): consent or a lawful basis is captured BEFORE non-essential cookies or trackers fire; a genuine reject or opt-out path exists and is as prominent as accept; the consent choice is honored server-side and in analytics or tag initialization (for example a Consent Mode gate), not just hidden in the UI; and Do-Not-Sell/Share and opt-out signals reach the code that would otherwise share data.
    Look: cookie or consent banner components and whether tracker/analytics init is gated on the stored choice; `gtag`, `fbq`, pixel, or tag-manager calls that run before consent; a "reject all" control against the "accept" control; server handling of an opt-out or global privacy control signal.
    Fail: non-essential cookies or trackers fire before consent, or reject/opt-out is missing, buried, or ignored by the code that shares data: High for a consent regime with regulated personal data, Medium otherwise. Cross-reference F-CMP for the applicable regime.
32. A-SEC-32 (audit-only): Regulated-data governance records exist in the repository when a regulatory surface is present: a data classification or record-of-processing inventory (GDPR Art 30 ROPA), data-processing agreements or business-associate agreements referenced for third-party processors that receive regulated data (GDPR DPA, HIPAA BAA), a cross-border transfer basis where regulated data leaves its jurisdiction, and a stated scope boundary that minimizes regulated data (PCI cardholder-data scope; PHI minimization) so unneeded regulated data is not stored or transmitted.
    Look: a schema-backed classification map or ROPA doc; processor/subprocessor lists with DPA/BAA references; transfer-mechanism notes (SCCs, adequacy); where card or health data enters and whether it is tokenized or scoped out; `.godplans`/docs for a stated regulated-data scope.
    Fail: regulated data is processed with no classification/record, no processor agreement reference, no transfer basis where required, or an unbounded regulated-data scope: High (Critical when card or health data is stored in cleartext or out of a declared scope). Cross-reference F-CMP.

## Scoring

Weights are secauditor's dimension table carried forward. Conditional dimensions drop out and the rest re-normalize proportionally when the sub-surface is absent; the audit reports which were active.

- Authorization and access control (18): A-SEC-3, A-SEC-4, A-SEC-5.
- Injection and input handling (16): A-SEC-8, A-SEC-9, A-SEC-10.
- Authentication and sessions (15, conditional on an auth surface): A-SEC-6, A-SEC-7.
- Crypto and data protection (11): A-SEC-11, A-SEC-12.
- Misconfiguration and hardening (9): A-SEC-15, A-SEC-16.
- Supply chain and CI/CD (9): A-SEC-17, A-SEC-18, A-SEC-26.
- Secrets management (8): A-SEC-13, A-SEC-14, A-SEC-27.
- API and web service (6, conditional on an API surface): A-SEC-19.
- Logging and privacy (4, privacy half conditional on regulated data): A-SEC-20, A-SEC-21.
- Cloud, container, and IaC (2, conditional on container or IaC files): A-SEC-22.
- AI and LLM security (2, conditional on model calls): A-SEC-23.

A-SEC-1, A-SEC-2, A-SEC-24, A-SEC-25, A-SEC-28, A-SEC-29, A-SEC-30, A-SEC-31, and A-SEC-32 carry no weight of their own: their findings score inside the dimension of the control they implicate. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Seeds follow the task grammar in audit-format.md; at audit time the agent adds the Fixes: line with real finding ids.

- [ ] GA-xxx Add ownership predicates behind a central deny-by-default layer
  - Files: src/api/boards.ts, src/middleware/authorize.ts, src/app.ts
  - Acceptance: every resource query carries an owner or tenant predicate; authorize mounts before all route registration; a cross-user request returns 403 or 404 on GET, PUT, DELETE, list, and export
  - Verify: `npm test -- tests/security/isolation.test.ts`
  - Checks: A-SEC-3, A-SEC-4
- [ ] GA-xxx Replace fast password hashing and mount the limiter before auth routes
  - Files: src/auth/password.ts, src/middleware/ratelimit.ts, src/app.ts
  - Acceptance: argon2id is the only credential hashing call; `timingSafeEqual` on every token and HMAC compare; login, reset, and MFA routes register after the limiter mounts; existing hashes upgrade on next login
  - Verify: `grep -rn "argon2id\|timingSafeEqual" src/auth/ && npm test -- tests/security/auth`
  - Checks: A-SEC-6, A-SEC-7
- [ ] GA-xxx Rotate the committed secret and gate CI on full-history scanning
  - Files: .gitignore, .github/workflows/ci.yml, .pre-commit-config.yaml
  - Acceptance: the exposed credential is rotated at the provider, not just deleted; gitleaks scans full history in pre-commit and CI; no `continue-on-error` or `|| true` on scan steps
  - Verify: `gitleaks detect --no-banner && ! grep -n "continue-on-error" .github/workflows/ci.yml`
  - Checks: A-SEC-13, A-SEC-14, A-SEC-27
- [ ] GA-xxx Parameterize string-built queries and disable shell invocation
  - Files: src/db/reports.ts, src/jobs/export.ts
  - Acceptance: no template literal or concatenation builds SQL from request data; process invocation uses argv arrays with the shell disabled and `--` separators; dynamic ORDER BY columns come from an allowlist
  - Verify: `npm test -- tests/security/injection.test.ts`
  - Checks: A-SEC-8
- [ ] GA-xxx Mount security headers globally and lock CORS to an exact-match allowlist
  - Files: src/middleware/headers.ts, src/config/cors.ts, tests/security/headers.test.ts
  - Acceptance: enforcing CSP without `unsafe-inline`; HSTS, nosniff, and frame-ancestors on every response; CORS compares origins by exact string, rejects null, never reflects; a test asserts every header
  - Verify: `npm test -- tests/security/headers.test.ts`
  - Checks: A-SEC-15
- [ ] GA-xxx Pin CI actions to commit SHAs and remove the soft-failed SCA gate
  - Files: .github/workflows/ci.yml, package-lock.json
  - Acceptance: every third-party action pinned to a 40-char SHA; CI installs with `npm ci`; the audit step gates on high with no `|| true`; a `permissions:` block replaces the default token scope
  - Verify: `grep -Ec "uses: .*@[0-9a-f]{40}" .github/workflows/ci.yml && grep -c "npm ci" .github/workflows/ci.yml`
  - Checks: A-SEC-17, A-SEC-18, A-SEC-26

## Anti-patterns hunted

- Paper control (secauditor): the guard exists, the path skips it: a validator never called before the sink, a limiter mounted after login, helmet imported but never used with `app.use`, `redact()` in one formatter of three. Hunt by pairing every definition site with its mount site; an unwired control is a High finding and counts as absent everywhere else.
- Scanner-first posture (harden-ready): a green Snyk or CodeQL badge presented as the posture while an incrementing object id leaks tenants. Rule: scanner config satisfies only A-SEC-14 and A-SEC-17; every other check requires read-confirmed source-to-sink evidence.
- Paper trust boundary (harden-ready, the Lovable CVE-2025-48757 class): RLS-capable schemas with no policies, an internal-only service bound to a public interface, boundaries in architecture docs with no enforcing code. Rule: credit no declared boundary until its enforcement mechanism is read at file:line.
- Compliance-without-security (harden-ready): badges, policy docs, or a SOC 2 folder with no code path behind the claims. Rule: every compliance claim maps control-to-code or it becomes a finding, never a credit.
- CVE-of-the-week residue (harden-ready): one patched handler among twelve siblings with the same flaw. Rule: cluster into one systemic F-SEC finding listing every site in Evidence, and seed a class-level fix with a regression guard.
- Hardening-as-ritual (harden-ready): a two-year-old pen test PDF, a dated SECURITY.md, nothing since. Rule: evidence must hold at the audited commit; stale artifacts earn no score.
- Severity inflation (auditor discipline): filing a missing nicety as Critical on a weekend repo. Rule: only the automatic-Critical list in A-SEC-24 is calibration-proof; every other severity scales with intake's calibration and states it in the finding.
- The vague finding (secauditor): "input is not validated". Refused: no F-SEC ships without file:line, a source-to-sink path, and a named safe pattern in its Fix line.
- Double-billing (ownership map): N+1 and index gaps belong to F-DB, prompt construction and token cost to F-LLM, alert routing to F-OBS, test wiring to F-REPO. Security cites their ids; it never re-scores their findings.
