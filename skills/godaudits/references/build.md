# Build audit module

Audits whether the app is real or a museum: every visible feature wired end to end to a live backend, auth that actually gates, CTAs whose chains complete, and zero scaffold shipped as product. Emits findings `F-BUILD-n` and a 0-100 build score into AUDIT.mdx. The orchestrator loads it for saas-dashboard, api-service, mobile-app, and any repo with auth, navigation, and CRUD over domain data; marketing-site, library, and single-component repos may exclude it with the reason recorded in the applicability matrix.

## Lineage

Descends from production-ready, the building-tier core of the aihxp ready-suite, whose target failure mode is the hollow dashboard: buttons that do not save, filters that do not filter, charts rendering hardcoded JSON, sidebar links that 404, login that accepts anything. The disciplines that carry over into audit time are the vertical-slice test (a feature is done only when a person can do a job with it), the no-scaffold-no-placeholder rule and its have-nots list, the CTA-completeness contract (the chain completing is the gate, not the leaf `onClick` being non-empty), the 30-second hollow-check grep battery run forward as evidence collection, the four-tier calibration bar, and the deferred-CTA and open-questions closure gates. Its severity conventions survive intact: fake persistence and login theater are Critical at any scale; TODO density is Medium, never inflated.

## Surface map

Inventory before any check runs. The intake fingerprint already covers stack and versions, entry points, HTTP routes, schema files and migrations, and test suites: cite it, do not re-scan.

- Route registry: `src/app/**/page.tsx`, `src/pages/**`, router registration files, `urls.py`, `routes.rb`, `mux.Handle` sites.
- Navigation sources: sidebar, header, and command-bar components; every `href`, `Link`, and `router.push` target.
- Server write surface: API handlers, server actions, controllers, RPC procedures, with per-handler auth and permission call sites.
- Client data layer: query and mutation hooks, cache invalidation calls, toast call sites, form submit handlers.
- Auth stack: session config, middleware, password-hash call sites, the login page.
- Identity artifacts: `DESIGN.md`, global stylesheet, theme or token config, icon imports.
- Build-state artifacts: `.godplans/STATE.md` or `.production-ready/STATE.md`, `adr/` directories, `deferred-cta.md`.
- Test tree mapped feature by feature, not just suite-level.

Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: first-party rendered UI (absent for api-service; A-BUILD-11 skips and its dimension re-normalizes), multi-tenancy (activates the tenant boundary in A-BUILD-10, findings filed under security), live money or regulated data (raises A-BUILD-2 severity), plan artifacts (`.godplans/PLAN.mdx` triggers plan-aware checks; brownfield legacy trees trigger A-BUILD-20).

## Checks

A-BUILD-1 through A-BUILD-20 mirror R-BUILD-1 through R-BUILD-20 one to one; A-BUILD-21 and A-BUILD-22 are audit-only. In plan-aware mode each check also inspects the matching PLAN.mdx section and tags the R-id on its findings.

1. A-BUILD-1: The 12 pre-flight answers are reconstructable from the repo: who uses it and for what job, entities, stack, persistence, auth model, permission matrix, route map, deploy target, responsive scope.
   Look: README, docs, schema files, manifests, `.godplans/STATE.md`; in plan-aware mode, the PLAN.mdx build sections themselves.
   Fail: a foundational answer (persistence, auth, routes) that neither code nor any doc yields: Medium.
2. A-BUILD-2: Domain traps are encoded in the schema: money as integer cents or `Decimal` (never float), append-only audit tables where regulation applies, an explicit soft-delete or hard-delete stance.
   Look: `prisma/schema.prisma`, migrations, ORM models; grep `Float` or `double` on columns named `price|amount|total|balance`.
   Fail: float-typed money columns: High, Critical when live payment flows exist; regulated data with no audit table: High. When the database pass already carries the same root cause, cross-reference the F-DB id instead of double-billing.
3. A-BUILD-3: User data lives in a real persistence layer: survives reload, consistent across two sessions, no in-memory store or fixture acting as the database.
   Look: server handlers and hooks; grep module-scope `let users = [`, `new Map(` caches serving CRUD, JSON fixture imports in server code.
   Fail: any user-facing feature persisting to memory or a fixture: Critical.
4. A-BUILD-4: Each shipped feature is a complete vertical: schema, server CRUD with permission checks, client hooks, pages with states, an audit entry, tests.
   Look: map each nav-exposed feature to its entity, handlers, hooks, pages, and tests.
   Fail: a nav-exposed feature missing its server layer or persisting nothing: High; missing its audit write where sibling features have one: Medium.
5. A-BUILD-5: No layer skew: the repo does not show the 80-percent-per-layer signature of horizontal building.
   Look: count schema entities vs endpoints vs wired pages; endpoints no client calls, models no endpoint serves.
   Fail: two or more entities with schema and endpoints but no working page, or pages with no backing endpoint: High.
6. A-BUILD-6: Every interactive element completes its chain to a user-visible outcome; blocked CTAs are removed, disabled with a visible reason, or logged in `deferred-cta.md` with all five fields.
   Look: grep `onClick={() => {}}`, `<form` without `onSubmit` or `action=`, `useMutation` without `onSuccess` or invalidation, empty `<DialogContent>` shells; read `.production-ready/deferred-cta.md`.
   Fail: half-wired CTA on a primary flow: High, elsewhere Medium; a deferred entry with a vague blocker such as "later": Low.
7. A-BUILD-7: Every nav link resolves to a registered route, and no route ships as a placeholder.
   Look: sidebar and header `href` values against the route registry; grep `Coming soon|Not implemented|WIP` in page files.
   Fail: a nav link that 404s: High; a coming-soon page or permanently disabled nav item: Medium.
8. A-BUILD-8: Auth is real: bad credentials rejected, session stored and persisted, every protected route gated server-side, passwords hashed with argon2 or bcrypt.
   Look: auth handlers, middleware, session config; grep `argon2|bcrypt`, and the negative `md5|sha1|sha256` near password fields.
   Fail: login accepting arbitrary credentials, or gating enforced only client-side: Critical; fast-hash or plaintext passwords: Critical at any scale.
9. A-BUILD-9: RBAC is server-enforced: at least two roles, every mutation checks its permission-matrix cell on the server; UI hiding is courtesy, not security.
   Look: mutation handlers and middleware for role checks; compare admin-only UI actions to their server handlers.
   Fail: a mutation whose only permission check lives in the client: Critical; no reconstructable role matrix: Medium.
10. A-BUILD-10: The three threat answers (attacker gain, highest-blast-radius mutation, trust boundaries) are reconstructable, and the named boundaries exist in code.
    Look: ADRs, STATE.md, middleware, the mutation with the widest write scope.
    Fail: no reconstructable threat stance on a funded product: Medium. Missing tenant predicates and injection are security's: cross-reference F-SEC per the ownership map.
11. A-BUILD-11: A visual identity was committed: tokens wired globally, at least one rendered component inherits `--color-primary`, icons come from an icon library, no unmodified default theme.
    Look: `DESIGN.md`, global stylesheet or Tailwind theme, token variables, component class usage.
    Fail: unmodified shadcn, Radix, or MUI default theme user-visible: Medium; emojis as UI icons: Low. Conditional: skip when no first-party UI. Visual a11y is ui's: cross-reference F-UI.
12. A-BUILD-12: Async surfaces carry loading, empty, and error states; forms validate client and server side with inline errors; every mutation ends in a toast or banner; tables over 25 rows paginate, sort, and filter with URL-preserved state.
    Look: list pages for the three branches, form components, mutation hooks, table components.
    Fail: server-side validation absent on a write path: High; silent mutations or missing error states: Medium.
13. A-BUILD-13: Each feature carries its tests in-slice: integration CRUD, permission-denial, axe on new pages, and a contract test for any cross-slice public signature.
    Look: `tests/` or `__tests__/` per feature; OpenAPI snapshot or zod round-trip tests where another feature imports the signature. CI wiring is repo's: cross-reference F-REPO.
    Fail: a shipped feature with zero integration and zero permission tests: High; a consumed cross-slice signature with no contract test: Medium. Whole-suite absence is F-REPO's existence concern, cross-referenced; this check scores per-feature coverage only.
14. A-BUILD-14: Every manifest dependency resolved against the registry: a lockfile entry exists for each, no typo-shaped names.
    Look: `package.json` against `package-lock.json` (or ecosystem equivalent); names one edit away from popular packages (`@tansatck/react-query`).
    Fail: a manifest dependency with no lockfile resolution: Critical (slopsquatting risk); no lockfile at all: High.
15. A-BUILD-15: The hardening block landed: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers; rate limiting on login, mutations, uploads, exports; heavy libraries code-split under a bundle budget.
    Look: `next.config.js`, middleware, helmet or equivalent, rate-limit call sites, dynamic `import()` for chart and editor libs.
    Fail: no rate limit on login: High; the header set absent: Medium. Secrets in repo or bundle are security's: cross-reference F-SEC per the ownership map.
16. A-BUILD-16: Production paths pass the hollow check: no TODO or implement-later markers, no raw `console.log` (logger calls in catch blocks excluded), no hardcoded fake-data arrays in components, no `Math.random()` driving charts or KPIs, no `alert()` or `prompt()` UI, no `Example*` or `Demo*` components shipped.
    Look: the grep battery over `src/`, adapted per stack (`binding.pry`, `dd(`, `var_dump(`, `raise NotImplementedError`).
    Fail: fake data or `Math.random()` rendered as real metrics: High; TODO or debug-print density in prod paths: Medium.
17. A-BUILD-17: Session-state artifacts exist and match the code: a STATE.md scoped to build facts, an ADR for each non-obvious architectural choice.
    Look: `.godplans/STATE.md` or `.production-ready/STATE.md`, `adr/` directories; sample two ADR claims against the code.
    Fail: a multi-contributor repo with zero ADRs behind non-obvious choices: Medium; STATE.md contradicting code: Medium (code wins).
18. A-BUILD-18: If the repo presents as shipped (deploy config, release tags), the closure gates hold: zero live deferred-CTA entries, zero open questions, zero TODOs.
    Look: `deferred-cta.md` Status fields, the STATE.md open-questions block, the A-BUILD-16 grep results.
    Fail: a released repo with entries still `deferred` or questions still `open`: Medium; blockers reading "later" or "soon": Low.
19. A-BUILD-19: Cross-cutting features (search, exports, notifications, theme toggle, audit-log viewer) query real data.
    Look: the search handler's data source, export endpoints, the audit-log viewer's table reads.
    Fail: search over a hardcoded array, an export serving a static fixture, or an audit-log viewer reading a table nothing writes: High.
20. A-BUILD-20: In brownfield or replan mode, the keep-rewrite-discard inventory exists and every rewrite item shipped or was reclassified with a reason.
    Look: the PLAN.mdx inventory table (plan-aware); `legacy/`, `old/`, `*-v1` trees against the import graph.
    Fail: unshipped rewrite items on a plan marked complete: Medium. Dead-code specifics are code-quality's: cross-reference F-CODE per the ownership map.
21. A-BUILD-21 (audit-only): No unguarded destructive commands in project scripts: `migrate reset`, `db push --accept-data-loss`, `rm -rf`, or `--force` flags runnable without a confirmation gate or environment guard.
    Look: `package.json` scripts, `Makefile`, `justfile`. Pipeline placement is deploy's: cross-reference F-DEPLOY when CI runs one.
    Fail: a destructive script that can point at a non-local database without a guard: High; unguarded but provably local-only: Low.
22. A-BUILD-22 (audit-only): No orphaned routes: every registered page is reachable from nav, a link, or a documented deep link.
    Look: the route registry against all `href`, `Link`, and `router.push` references.
    Fail: an orphaned scaffold page: Medium; an orphaned page exposing data without auth: cross-reference F-SEC.

## Scoring

Weighted dimensions, summing to 100. Derived from the production-ready tier table via the godplans self-audit rubric.

- Vertical completeness (20): A-BUILD-2, A-BUILD-4, A-BUILD-5, A-BUILD-19.
- Real wiring and CTA completeness (20): A-BUILD-3, A-BUILD-6, A-BUILD-7, A-BUILD-16, A-BUILD-22.
- Auth, RBAC, and threat model (15): A-BUILD-8, A-BUILD-9, A-BUILD-10.
- States, feedback, and tests (15): A-BUILD-12, A-BUILD-13.
- Visual identity (10, conditional: drop and re-normalize when the repo renders no first-party UI): A-BUILD-11.
- Supply chain and hardening (10): A-BUILD-14, A-BUILD-15, A-BUILD-21.
- Session state and closure (10): A-BUILD-1, A-BUILD-17, A-BUILD-18, A-BUILD-20.

Any open Critical finding caps this domain at 69.

## Remediation seeds

Templates in the audit-format task grammar; at audit time the agent adds the Fixes: line with real finding ids and adapts Files and Verify to the committed stack.

- [ ] GA-xxx Rewire fixture-backed features to the committed persistence layer
  - Files: src/server/orders.ts, src/hooks/use-orders.ts, prisma/schema.prisma
  - Acceptance: no component or handler imports a JSON fixture or module-scope array as its data source; created records survive reload and appear in a second browser session; every read goes through the data layer
  - Verify: `! grep -rnE "from ['\"].*fixtures|(let|const) [a-z]+Data = \[" src/ --include="*.tsx" --include="*.ts"`
  - Checks: A-BUILD-3
- [ ] GA-xxx Enforce real auth: credential rejection, hashing, server-side gating
  - Files: src/server/auth.ts, src/middleware.ts, tests/auth.test.ts
  - Acceptance: bad credentials return 401; password hashing uses argon2 or bcrypt; every protected route redirects unauthenticated requests server-side
  - Verify: `npm test -- tests/auth.test.ts`
  - Checks: A-BUILD-8
- [ ] GA-xxx Add server-side permission checks to every mutation
  - Files: src/server/, src/middleware.ts, tests/permissions.test.ts
  - Acceptance: each mutation handler enforces its role check before the write; a non-admin request to an admin mutation returns 403; UI hiding remains but is never the only gate
  - Verify: `npm test -- tests/permissions.test.ts`
  - Checks: A-BUILD-9
- [ ] GA-xxx Complete or retire half-wired CTA chains
  - Files: src/app/, src/components/, .production-ready/deferred-cta.md
  - Acceptance: every button, link, and form completes its chain to a user-visible outcome; blocked CTAs are removed, disabled with a visible reason, or logged with all five fields; zero nav links to unregistered routes
  - Verify: `! grep -rnE "onClick=\{\(\) => \{\}\}" src/ --include="*.tsx"`
  - Checks: A-BUILD-6, A-BUILD-7
- [ ] GA-xxx Purge hollow indicators from production paths
  - Files: src/
  - Acceptance: zero TODO or FIXME markers in prod paths; zero hardcoded fake-data arrays in components; zero `Math.random()` in charts or KPIs; zero `alert()` or `prompt()` for UI
  - Verify: `! grep -rnE "TODO|FIXME|Math\.random\(\)|alert\(" src/ --include="*.ts" --include="*.tsx"`
  - Checks: A-BUILD-16
- [ ] GA-xxx Add states and mutation feedback to async surfaces
  - Files: src/app/orders/page.tsx, src/hooks/use-orders.ts
  - Acceptance: every list page renders loading, empty, and error branches; every mutation invalidates its query and raises a toast; forms validate client and server side with inline field errors
  - Verify: `npm test -- tests/states.test.ts`
  - Checks: A-BUILD-12
- [ ] GA-xxx Land the hardening block: headers, rate limits, bundle budget
  - Files: next.config.js, src/server/rate-limit.ts
  - Acceptance: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy set; rate limiting active on login, mutations, uploads, and exports; heavy libraries code-split
  - Verify: `grep -q "Content-Security-Policy" next.config.js`
  - Checks: A-BUILD-15

## Anti-patterns hunted

- **The hollow dashboard**: fake-data arrays, `Math.random()` charts, `Example*` components shipped as product. Run the grep battery; every hit becomes quoted evidence, not a category claim.
- **The half-wired CTA**: empty `onClick`, forms without `onSubmit`, mutations that never invalidate or toast, empty dialog shells. Walk the chain; handler existence is never the gate.
- **Login theater**: auth accepting any credentials, or permission checks that live only in the client. Always Critical; never averaged away by a polished UI.
- **Coming-soon navigation**: sidebar hrefs with no registered route, disabled nav items, placeholder pages. Cross-check every nav target against the route registry both directions.
- **Mock-now-wire-later**: in-memory Maps or JSON fixtures serving as the database with a promise of later. There is no later; file the Critical.
- **Layer-skew residue**: complete schema and endpoints for entities with no working page, or the reverse. Count per layer; the 80-percent signature is one High finding, not twenty smalls.
- **Default-theme shipping**: unmodified shadcn, Radix, or MUI tokens visible to users. Medium, evidence is the untouched theme file plus a rendered component.
- **Slopsquatting**: manifest dependencies absent from the lockfile or typo-shaped names near popular packages. Critical on any unresolved name.
- **Demo-data bleed**: seed or fixture rows rendered in production paths as if real. Trace the data source before trusting any KPI.
- **Vague findings**: any finding without file:line and quotable evidence is a hypothesis; label it Tentative or delete it.
- **Double-billing**: tenant scoping, injection, and secrets go to F-SEC; dead code to F-CODE; CI wiring to F-REPO; deploy pipelines to F-DEPLOY, per the ownership map. One root cause, one owner.
- **Severity inflation**: TODO density is Medium, a missing toast is not High, and calibration follows the intake scale; fake persistence and login theater stay Critical at every scale.
