# Code quality audit module

Audits the maintainability core of a codebase: layering conventions in the code, quality budgets, typing strictness, test quality, error handling, performance shapes, dependency hygiene, docs drift, and code-level operability hooks. Emits findings `F-CODE-n` and a 0-100 domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads it in the domain-pass phase for every repo that ships application code. No archetype may exclude it: per intake.md, code-quality is never excluded, it scales down with the calibration instead, and the applicability matrix records the scale applied.

## Lineage

Descends from codeauditor, the read-only end-of-project auditor that scores nine weighted dimensions (SEC 20, ARC 15, QUAL 15, TEST 15, ERR 10, PERF 8, DEP 7, DOC 5, OBS 5) and hunts paper constructs: uncalled validators, assertion-free tests, unconditional-200 health checks. godplans inverted those checks into plan obligations R-CODE-1 through 22; this module runs them forward against real code, one A-id per R-id. The method DNA carries over intact: evidence over assertion with `file:line` on every claim, the substitution test on every sentence, adversarial refutation before recording, root-cause clustering (twelve empty catches are one systemic finding), calibration to declared maturity, and the hard cap, because risk never averages away. The SEC dimension does not carry over: the security domain owns it, and this module cross-references F-SEC where the lenses touch.

## Surface map

Inventory before any check runs. The intake fingerprint already records stack, manifests, entry points, module layout, and test-and-CI reality; cite it, do not re-scan.

- Quality tooling: `eslint.config.js` or `.eslintrc*`, `ruff.toml`, `.golangci.yml`, `tsconfig.json`, `mypy.ini`, format configs.
- Test surface: `tests/`, `**/*.test.*`, `**/*_test.go`, `conftest.py`, snapshot dirs, coverage config in manifest or CI.
- Dependency surface: manifest plus lockfile (`package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `go.sum`, `Cargo.lock`), CI audit steps.
- Error and I/O sites: catch and except blocks, error middleware mounts, shared HTTP and DB client constructors, retry loops.
- Operability hooks: the logger module, `/health` or `/ready` routes, `.env.example`, Dockerfile and build scripts.
- Convention records: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `agents/` pillars.

Conditional sub-surfaces, each declared present or absent with the reason recorded: the test suite (whole-suite absence is F-REPO's existence concern, cross-referenced, while A-CODE-8 through 10 score the quality of whatever tests exist), the service surface (absent on pure libraries: the performance and operability dimensions re-normalize), and coverage machinery (absent alongside a badge is A-CODE-11).

## Checks

Severities are funded-product calibration; the intake scale moves them, never the evidence. A-CODE-1 through A-CODE-22 mirror R-CODE-1 through 22 one to one; A-CODE-23 and A-CODE-24 are audit-only.

1. A-CODE-1: A maturity and deployment-context declaration exists and the code's quality bars match it.
   Look: `README.md` status lines, `docs/`, and in plan-aware mode the `.godplans/PLAN.mdx` objective; intake scale signals.
   Fail: no discoverable declaration while deploy workflows show real users, or bars contradicting the declaration: Medium.
2. A-CODE-2: Layering holds in code: one dependency direction, no layer-skipping imports.
   Look: the import graph from entry points; grep for ORM or DB client imports inside `src/routes/`, `src/components/`, `src/pages/`.
   Fail: presentation or transport importing persistence directly: High.
3. A-CODE-3: Similar features are built the same way, copying one canonical shape.
   Look: three sibling endpoints or handlers of the same kind; compare validation, error, and response shape.
   Fail: each sibling reinvents the shape: Medium, clustered as one systemic finding.
4. A-CODE-4: Abstraction fits the problem: repeated logic shares a helper, no speculative indirection.
   Look: near-duplicate blocks pasted three or more times; interfaces with one implementation; factories with one product.
   Fail: a copy-paste class of duplicates: Medium; indirection with a single caller and no variation: Low.
5. A-CODE-5: Quality budgets are wired to lint rules: function and file length, nesting depth, parameter count, no magic values, no dead code.
   Look: budget rules in the lint config; grep for functions past 50 lines, files past 400, commented-out blocks, unused exports.
   Fail: no budget rules while hotspots exceed those defaults: Medium; dead code: Low.
6. A-CODE-6: Typing is strict and escape hatches carry an inline reason.
   Look: `"strict": true` in `tsconfig.json` or mypy strict flags; grep `: any`, `as unknown as`, `@ts-ignore`, `# type: ignore`.
   Fail: strict mode off where the language supports it: High; unexplained suppressions: Medium.
7. A-CODE-7: Deferred-work markers reference tracked issues.
   Look: grep `TODO|FIXME|HACK|XXX` under source dirs; check the hits for issue references.
   Fail: ten or more bare markers: Medium. Stub handlers and fake data behind markers belong to build; cross-reference F-BUILD per the ownership map.
8. A-CODE-8: Every critical path (authn, authz, payments, irreversible mutations) has tests asserting success and at least one failure case.
   Look: map `tests/` files to the auth, payment, and mutation modules the fingerprint names.
   Fail: a critical path with zero tests: High; failure cases untested: Medium.
9. A-CODE-9: Tests assert meaningful outcomes.
   Look: test files containing no `expect(` or `assert`; snapshot-only suites; mocks asserted against themselves.
   Fail: assertion-free or mock-echo tests guarding load-bearing modules: High; elsewhere: Medium.
10. A-CODE-10: Tests are deterministic by construction: injected clock, seeded randomness, no live network, order independence.
    Look: grep `Date.now(`, `new Date(`, `Math.random(`, `time.time(`, and live URLs inside `tests/`.
    Fail: wall clock or live network in tests: Medium. Whether CI runs the suite at all is repo's concern; cross-reference F-REPO.
11. A-CODE-11: Coverage claims match machinery.
    Look: README badges and thresholds against the CI step that computes them.
    Fail: a badge or threshold that no command enforces: Medium (coverage theater).
12. A-CODE-12: Errors propagate with cause to one named boundary; nothing is swallowed.
    Look: grep `catch {}`, `catch (e) {}`, `except: pass`, ignored error returns (`_ = err`); find the error middleware mount.
    Fail: an empty catch on a load-bearing path: High; no single boundary, per-handler improvisation: Medium.
13. A-CODE-13: Outbound I/O carries timeouts and retries back off, both from a shared client.
    Look: HTTP and DB client constructor sites, `timeout` options, hand-rolled retry loops.
    Fail: an outbound call with no timeout on a request path: High; retries without backoff: Medium.
14. A-CODE-14: Multi-step operations cannot half-complete, and resources release on error paths.
    Look: sequential external writes with no compensation; file, lock, or connection acquisition without `finally`, `defer`, or a context manager.
    Fail: a partial multi-system write with no compensation: High; leaked handles on error paths: Medium. Database transaction boundaries are database's; cross-reference F-DB.
15. A-CODE-15: List queries paginate; per-item lookups batch.
    Look: list endpoints returning unbounded `findAll` or `SELECT *`; awaited queries inside loops.
    Fail: an unpaginated list endpoint: Medium. N+1 and missing-index root causes file as F-DB per the ownership map; cross-reference, never re-score.
16. A-CODE-16: Caches state their invalidation, long-lived collections are bounded, hot paths do not block.
    Look: module-level `Map` or dict caches, ever-growing arrays, `readFileSync` or other sync calls inside request handlers.
    Fail: an unbounded cache or collection, or sync I/O on a request path: Medium.
17. A-CODE-17: Dependencies are pinned and scanned: committed lockfile, no floating majors, advisory scanner in CI, one package per job.
    Look: lockfile presence, manifest ranges (`*`, `latest`), the CI audit step, duplicate-purpose packages.
    Fail: no lockfile: High; floating `*` or `latest` ranges: Medium; no advisory step at funded-product scale: Medium.
18. A-CODE-18: Docs match reality: README setup, build, and run commands exist; shipped endpoints, flags, and env vars are documented.
    Look: README commands against manifest scripts; grep `process.env.` and `os.environ` against the configuration docs.
    Fail: a README command that no longer exists, or an undocumented required env var: Medium.
19. A-CODE-19: Code-level observability hooks exist: structured logging at boundaries, a health check exercising a real dependency.
    Look: the logger module; `console.log` or bare `print(` outside it; the `/health` route body.
    Fail: a health check returning 200 unconditionally: High (paper health check); printf logging on a service: Medium. Redaction is security's, stack depth is observe's; cross-reference F-SEC and F-OBS.
20. A-CODE-20: Config lives outside code with per-environment values; the build is reproducible; the run procedure is documented.
    Look: hardcoded hosts, ports, and URLs under `src/`; `.env.example`; Dockerfile and build scripts.
    Fail: environment-specific values hardcoded: Medium. Migrations are database's, the pipeline is deploy's; cross-reference F-DB and F-DEPLOY.
21. A-CODE-21: The repo carries runnable verification entry points: one command each for tests, lint, and typecheck.
    Look: manifest scripts, `Makefile`, `noxfile.py`, `justfile`.
    Fail: no single command runs the suite or lint: Medium. Plan-aware: a checked R-CODE task whose Verify command now fails: High.
22. A-CODE-22: Recorded conventions are enforced, not aspirational: every quality rule stated in `AGENTS.md` or `CONTRIBUTING.md` maps to a config or check.
    Look: convention files against lint, type, and CI configs; grep the code for violations of stated rules.
    Fail: a stated rule with no enforcement and live violations: Medium (paper convention).
23. A-CODE-23: Complexity stays out of load-bearing code: no deep nesting, long parameter lists, or god modules there.
    Look: nesting past depth 4 and functions past 50 lines in files the fingerprint marks load-bearing; one module imported by most others.
    Fail: a hotspot on a load-bearing path: Medium.
24. A-CODE-24: Dependencies are alive: not majors behind, not abandoned, no deprecated APIs in active use.
    Look: manifest versions against known majors; deprecation warnings in code; staleness signals readable offline.
    Fail: an abandoned dependency on a critical path: Medium, Tentative when advisory knowledge cannot be confirmed offline.

## Scoring

Dimensions derive from codeauditor's weight table with SEC removed (security owns it) and the remainder re-normalized to 100:

- Architecture conventions: 19 (A-CODE-2, A-CODE-3, A-CODE-4, A-CODE-23)
- Maintainability and budgets: 19 (A-CODE-1, A-CODE-5, A-CODE-6, A-CODE-7, A-CODE-22)
- Testing discipline: 19 (A-CODE-8, A-CODE-9, A-CODE-10, A-CODE-11, A-CODE-21)
- Error handling and resilience: 12 (A-CODE-12, A-CODE-13, A-CODE-14)
- Performance shapes: 10, conditional (A-CODE-15, A-CODE-16); re-normalize for pure libraries with no I/O or service surface
- Dependencies: 9 (A-CODE-17, A-CODE-24)
- Docs and drift: 6 (A-CODE-18)
- Operability hooks: 6, conditional (A-CODE-19, A-CODE-20); re-normalize for non-service archetypes

Score each dimension against its findings, weight, and sum. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

- [ ] GA-xxx Enable strict type checking and burn down suppressions
  - Files: tsconfig.json, src/lib/types.ts
  - Acceptance: `"strict": true` set with zero new suppressions; every remaining `@ts-ignore` carries an inline reason; the type check gates CI
  - Verify: `npx tsc --noEmit`
  - Checks: A-CODE-6

- [ ] GA-xxx Wire quality budgets into the lint config CI runs
  - Files: eslint.config.js, .github/workflows/ci.yml
  - Acceptance: max function length, nesting depth, and no-magic-numbers rules enabled at the audited thresholds; bare TODO markers fail the marker check; lint exit code gates CI
  - Verify: `npx eslint .`
  - Checks: A-CODE-5, A-CODE-7

- [ ] GA-xxx Add asserting, deterministic tests to the critical paths
  - Files: tests/integration/auth.test.ts, tests/setup.ts
  - Acceptance: every critical path named in the findings has a success and a failure assertion; setup injects a fake clock and seeded RNG; no live network calls remain under `tests/`
  - Verify: `npm test -- --run tests/integration/`
  - Checks: A-CODE-8, A-CODE-9, A-CODE-10

- [ ] GA-xxx Establish the error boundary and shared HTTP client
  - Files: src/middleware/error-handler.ts, src/lib/http-client.ts
  - Acceptance: one mounted boundary logs with the cause chain and returns generic client messages; the shared client sets a default timeout and backoff retry; no empty catch blocks remain under `src/`
  - Verify: `! grep -rn "catch {}" src/`
  - Checks: A-CODE-12, A-CODE-13

- [ ] GA-xxx Pin dependencies and add the advisory scanner to CI
  - Files: package-lock.json, .github/workflows/ci.yml
  - Acceptance: lockfile committed; no `*` or `latest` ranges in the manifest; the advisory scan fails CI on high-severity findings
  - Verify: `npm ci && npm audit --audit-level=high`
  - Checks: A-CODE-17

- [ ] GA-xxx Replace the paper health check and align the README
  - Files: src/routes/health.ts, README.md
  - Acceptance: the health endpoint pings one real dependency and returns non-200 on failure; README setup, build, and run commands match the manifest scripts exactly
  - Verify: `npm test -- --run tests/health.test.ts`
  - Checks: A-CODE-18, A-CODE-19

## Anti-patterns hunted

- Paper constructs: a validator defined but never imported, middleware registered but not mounted on the routes it should guard, a rate limiter that does not limit. Pair every definition with its call or mount site; the unwired artifact is the finding, graded as if the protection were absent.
- The unconditional-200 health check: a `/health` route whose body touches no dependency. Read the route body, not its name; a constant return is High under A-CODE-19 no matter how healthy the code reads.
- Assertion-free testing: test files that execute code and assert nothing, snapshot suites nobody reviews, mocks asserted against themselves. Grep for missing asserts, then read the survivors; count these as missing tests, never as coverage.
- Coverage theater: a badge or threshold with no CI step computing it. Compare the badge to the workflow; the gap is the A-CODE-11 finding.
- Swallow-and-continue: empty catches and ignored error returns copied as an idiom. Cluster every site into one systemic F-CODE finding with the site list in Evidence; twelve leaves are one root.
- Vague findings: "error handling is weak" and any line that survives the substitution test for a different repo. Refused: a finding without `file:line` and quotable evidence is a hypothesis, labeled Tentative or deleted.
- Double-billing: N+1 and index findings belong to database, naming and idiom drift to style-genome, secrets to security, stub handlers to build, CI wiring to repo. Refused: this module cross-references F-DB, F-DNA, F-SEC, F-BUILD, and F-REPO per the ownership map instead of re-scoring them.
- Severity inflation: grading a weekend script on a payment-platform bar, or Critical labels on lint nits. Refused: calibration is stated with its signals, moves severity only, and never touches evidence.
