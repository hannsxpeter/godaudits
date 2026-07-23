# UX audit module

Audits the experience layer of the codebase: actors, journeys, state handling, workflows, forms, navigation, onboarding, and the trust surfaces around billing and consent. Experience is broader than pixels here: CLIs, APIs, and back-office workflows count. The pass feeds findings `F-UX-n` and a 0-100 ux domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads this module for every archetype with a human-facing, developer-facing, or workflow surface; it is excluded only when no such surface exists (a pure internal library with no CLI, UI, API, or user flow), with the reason recorded in the applicability matrix.

## Lineage

Descends from uxauditor, the read-only end-to-end experience auditor among the seven hannsxpeter auditors, by way of the godplans ux module that inverted its checks into R-UX plan requirements; this module runs those same checks forward against code. The method DNA preserved: the eleven-dimension lens set (Nielsen heuristics, WCAG 2.2 AA, journeys, Lean process analysis, IA, interaction design, UX writing, Baymard forms, AARRR activation, RAIL/Doherty responsiveness, deceptive.design trust); evidence over assertion with the substitution test applied to every finding; root-not-leaves clustering (twelve placeholder-as-label fields are one systemic finding with member sites); adversarial refutation before anything is recorded; the static-inference-is-a-prediction discipline (uxauditor's Suspected confidence maps to this suite's Tentative); and the severity convention that a blocking accessibility failure or a confirmed deceptive pattern is Critical, never cosmetic, carrying uxauditor's cap of the dimension and domain when open.

## Surface map

Inventory before any check runs. The intake fingerprint already lists HTTP routes, entry points, auth flows, and test reality; cite it instead of re-scanning.

- Screens and routes: `src/routes/`, `app/`, `pages/`, navigation config, breadcrumb components; the CLI command tree or API surface for non-GUI products.
- Async and state handling: fetch and mutation call sites, `isLoading` flags, skeleton and spinner components, empty and error state components, literal strings like `"No data"`.
- Forms: form components, `placeholder=` usage versus `<label>` elements, `autocomplete` and `inputmode` attributes, submit handlers and their double-submit guards.
- Workflow machinery: status enums, scattered `status ===` comparisons, state-machine or transition files, role checks on transitions, `version` columns for optimistic locking.
- Onboarding and activation: signup routes, email-verification and card gates, tour libraries in the manifest (`react-joyride`, `intro.js`), seed or sample data.
- Copy and vocabulary: i18n catalogs, button label strings, error catalogs, email templates that carry cross-channel handoffs.
- Trust surfaces: billing and subscription routes, consent banners, `defaultChecked` inputs, countdown or scarcity strings.

Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: forms, multi-actor workflows, billing or consent flows, signup and onboarding, non-GUI surfaces (CLI, API, SDK), and cross-channel handoffs.

## Checks

Severities are funded-product calibration; scale them per intake. In plan-aware mode each check also inspects the matching PLAN.mdx section and tags the R-id.

Mirror boundary: A-UX-1..20 mirror R-UX-1..20 one to one; A-UX-21 and up are audit-only. Cross-verified against godplans: R-UX-1..20 defined.

1. A-UX-1: One primary actor per journey is reconstructible from the product itself, with functional, emotional, and social jobs and a context of use.
   Look: README, landing and onboarding copy, role or persona enums, `docs/`; plan-aware: the actor decision in PLAN.mdx.
   Fail: flows addressed to an undifferentiated "users" with no reconstructible actor or job; Medium.
2. A-UX-2: The 2-4 primary journeys (signup to first value, main recurring task, recovery or upgrade, conversion) complete in a defensible step count and never re-ask data the system holds.
   Look: route trees, wizard and stepper components, redirect chains; count screens per core goal.
   Fail: re-entry of held data on a core journey, High; a journey materially longer than the job requires, Medium.
3. A-UX-3: Every async action has loading, pending, disabled, and success states; every screen has an empty state with a forward action; no error, expired, or zero-result state dead-ends.
   Look: mutation and fetch sites without loading handling, `grep -rn '"No data"'`, empty-state and error components.
   Fail: silent async actions or any dead-end state without a forward action; High.
4. A-UX-4: Waits get treatment where the roughly 100ms/400ms RAIL and Doherty budgets cannot hold: skeletons or optimistic UI, and position shown in every multi-step flow.
   Look: skeleton components, optimistic update code, stepper progress indicators, long-running handlers behind bare spinners.
   Fail: a multi-step flow with no position indicator, or a long operation with no visible progress; Medium.
5. A-UX-5: Destructive actions carry undo or a recovery path, every state has a marked exit, no modal or wizard traps, confirmations guard only costly irreversible actions.
   Look: delete handlers, soft-delete or trash code, modals lacking close and escape handling, `confirm(` calls.
   Fail: hard delete with neither undo nor confirmation, High; confirmations on trivial actions, Low.
6. A-UX-6: One term per concept and one label per action product-wide; buttons name the action or outcome, never "Submit", "OK", or "Click here".
   Look: i18n catalogs and button strings; grep pairs like "Sign in" versus "Log in" for the same concept.
   Fail: the same concept under two names, or generic labels on primary actions; Medium.
7. A-UX-7: Errors state what happened, why, how to fix it, and what happens next, at the field, in plain language; raw codes and stack traces never render; user input survives the error.
   Look: catch blocks rendering `err.message` or `error.code`, error catalogs, form reset calls inside error paths.
   Fail: raw codes or stack traces reaching users, or a form cleared on error; High.
8. A-UX-8: Flow accessibility holds against the stated or inferable conformance target: full keyboard operability with no traps, focus order following visual order, no redundant entry of provided data, paste and autofill never blocked in auth. Contrast tokens and focus visuals are ui's: cross-reference F-UI per the ownership map.
   Look: custom widgets without key handlers, paste handlers calling `preventDefault`, `autocomplete="off"` on credential fields, `tabIndex` abuse.
   Fail: a keyboard-unreachable core task, Critical; blocked paste or autofill in auth, High.
9. A-UX-9: Forms meet the Baymard standard: persistent visible labels, inline validation on blur, minimal field count, correct `type` and `inputmode`, standard `autocomplete` tokens, format-tolerant normalization, double-submit guards, never clearing on error.
   Look: `grep -rln "placeholder=" src | xargs grep -L "<label"`, validation triggers, submit handlers.
   Fail: placeholder-as-label or missing autocomplete on identity fields, one systemic finding; High.
10. A-UX-10: Every multi-actor process runs on an explicit state machine: start and end states, a join for every branch, exception paths, no unreachable states.
    Look: state-machine or workflow files, xstate or step configs, status enums whose transitions scatter across handlers.
    Fail: stringly-typed status mutated ad hoc from many call sites with no machine; High.
11. A-UX-11: Workflow integrity mechanics exist: server-side role checks on every transition, timeout or escalation for stalled items, optimistic locking or a conflict path, status visibility for waiting parties, and in-product reassign, recall, and rollback.
    Look: transition endpoints and their middleware, escalation jobs, `version` checks, reassignment routes.
    Fail: any of the five missing on a live workflow, High; an exploitable authorization hole cross-references F-SEC instead of double-billing.
12. A-UX-12: Flows carry no unexamined waste: no serial approvals that could parallelize, no deterministic rule-based human steps a machine should do, a locatable bottleneck. Plan-aware: the TIMWOODS classification table exists.
    Look: approval chains in workflow code, manual routing or status-setting endpoints, the longest serial screen chain.
    Fail: serial approvals with independent approvers, or automatable human steps; Medium, Tentative without runtime data.
13. A-UX-13: Navigation matches the actor's mental model: labels with information scent in user vocabulary, breadcrumbs on deep pages, a current-location indicator, and typo-tolerant search with a useful zero-results state where volume warrants.
    Look: nav config, sidebar and menu components, breadcrumb and search implementations; trace two realistic find-X tasks.
    Fail: nav mirroring the code's module names or the org chart, or no current-location signal; Medium.
14. A-UX-14: The activation event is identifiable, the signup-to-value path carries no unjustified walls (account, email verification, card, sales call), and first-run drives the core action with templates or sample data, not a tour or a blank canvas.
    Look: onboarding routes, verification gates, tour libraries in `package.json`, seed data.
    Fail: an unjustified wall before first value, High; feature-tour or blank-canvas first-run, Medium.
15. A-UX-15: Repeat-use products have a retention loop: saved state worth returning to and value-driven re-engagement, not spam.
    Look: persistence of drafts and history, notification and digest jobs, re-engagement email triggers.
    Fail: re-engagement sends with no user value, or no saved state behind the return trigger; Low.
16. A-UX-16: Responsiveness basics hold: a loading state on every async action, viewport meta with zoom enabled, no horizontal scroll at 320px, thumb-sized touch targets. CWV code signals (unsized media, render blocking) are seo's: cross-reference F-SEO.
    Look: `grep -rn "user-scalable=no"`, viewport meta tags, target sizing in component styles.
    Fail: `user-scalable=no` anywhere, High; a numeric CWV verdict asserted from static code is refused: mark Tentative with the confirming Lighthouse command named.
17. A-UX-17: No deceptive patterns: cancellation as easy as signup, "Reject all" as prominent and as few clicks as "Accept all", total pricing before commitment, no pre-checked opt-ins, no fake scarcity or manufactured social proof, granular revocable consent.
    Look: billing and subscription routes, consent banners, `defaultChecked`, countdown timers, hardcoded viewer or stock counts.
    Fail: any confirmed deceptive pattern, Critical; legal exposure under GDPR, the FTC click-to-cancel rule, and EU DSA Art. 25.
18. A-UX-18: Interactive components carry hover, focus, active, disabled, loading, empty, and error states; interactive elements look interactive; one dominant primary action per screen; expert accelerators never block novices.
    Look: design-system component prop surfaces, `div` elements with `onClick` and no role, screens with competing primary buttons.
    Fail: custom controls missing disabled and loading states, or clickable divs masquerading as buttons; Medium. Focus-visible styling itself is visual a11y: cross-reference F-UI per the ownership map.
19. A-UX-19: Context survives cross-channel and cross-device handoffs, multi-step flows show remaining progress, and each journey ends on a designed note rather than a dead stop.
    Look: email link targets and their post-auth redirects, resume tokens, deep-link handling, success screens.
    Fail: a handoff that drops the user at a bare login and loses their place, High; anticlimactic endings, Low.
20. A-UX-20: Non-GUI surfaces get the same discipline: exit codes and messages follow the error standard, help output teaches the next step, destructive commands take confirmation or `--dry-run`, API errors are specific and recovery-oriented.
    Look: CLI entry and argument parser, destructive subcommands, API error payload shapes.
    Fail: a destructive command with no guard, High; bare 500s or opaque API error bodies, Medium.
21. A-UX-21 (audit-only): No UX theater: spinners bound to no request, progress bars reflecting nothing, confirmations guarding nothing costly, accessibility labels describing the wrong thing.
    Look: read the binding behind each state widget: which promise drives the spinner, which value feeds the bar.
    Fail: any element performing UX without doing its job; High, because it actively misleads.
22. A-UX-22 (audit-only): Dates, numbers, and currency match the user's locale, and format hints appear where input format matters.
    Look: hardcoded date and currency formats, `Intl.` or locale-library usage versus string concatenation.
    Fail: hardcoded single-locale formats in a product with multi-locale reach; Low.

## Scoring

Weights derive from uxauditor's dimension table. Conditional dimensions re-normalize when their sub-surface is declared absent in the surface map.

| Dimension | Weight | Checks |
|---|---|---|
| Usability and heuristics | 13 | A-UX-3, A-UX-4, A-UX-5, A-UX-22 |
| Flow accessibility | 13 | A-UX-8 |
| Journeys and flows | 11 | A-UX-1, A-UX-2, A-UX-19 |
| Process and workflow (conditional: multi-actor workflows) | 11 | A-UX-10, A-UX-11, A-UX-12 |
| Interaction design | 9 | A-UX-18, A-UX-21 |
| IA and navigation | 8 | A-UX-13 |
| Content and UX writing | 8 | A-UX-6, A-UX-7 |
| Onboarding and activation (conditional: signup flow) | 8 | A-UX-14, A-UX-15 |
| Forms and input (conditional: forms present) | 7 | A-UX-9 |
| Performance and responsiveness | 6 | A-UX-16 |
| Trust and anti-deception (conditional: billing or consent) | 6 | A-UX-17 |

A-UX-20 scores inside whichever dimensions the non-GUI surface expresses (journeys, content, usability), calibrated to that surface. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Representative tasks in the audit-format grammar; at audit time the agent adds the `Fixes:` line with real finding ids.

- [ ] GA-xxx Replace bare empty and error states with forward-action components
  - Files: src/components/states/EmptyState.tsx, src/components/states/ErrorState.tsx
  - Acceptance: no rendered "No data" text anywhere; every empty state names what the area is and the next action; every error state keeps a retry or a route out
  - Verify: `! grep -rn '"No data"' src/`
  - Checks: A-UX-3, A-UX-7
- [ ] GA-xxx Remove placeholder-as-label across all form fields
  - Files: src/components/forms/Field.tsx, src/components/forms/Form.tsx
  - Acceptance: every field renders a visible label element; `autocomplete` tokens set on name, email, tel, and address fields; validation fires on blur; form state survives a failed submit
  - Verify: `grep -rln "placeholder=" src/components/forms | xargs grep -L "<label" | wc -l | grep -q "^0$"`
  - Checks: A-UX-9, A-UX-7
- [ ] GA-xxx Add server-side role checks and stall escalation to workflow transitions
  - Files: src/server/workflow/transitions.ts, src/server/workflow/machine.ts
  - Acceptance: every transition asserts the allowed role server-side; stalled items escalate after a named timeout; concurrent edits hit a version check; reassign and recall exposed as endpoints
  - Verify: `grep -q "assertRole" src/server/workflow/transitions.ts && grep -q "version" src/server/workflow/machine.ts`
  - Checks: A-UX-10, A-UX-11
- [ ] GA-xxx Unblock paste, autofill, and zoom in auth
  - Files: src/routes/login/, src/components/auth/
  - Acceptance: no paste handler calls `preventDefault` on credential fields; `autocomplete="current-password"` and `autocomplete="one-time-code"` present; no `user-scalable=no` in any viewport meta
  - Verify: `! grep -rn "user-scalable=no" src/`
  - Checks: A-UX-8, A-UX-16
- [ ] GA-xxx Restore cancellation symmetry and pricing transparency in billing
  - Files: src/routes/billing/, src/routes/settings/subscription/
  - Acceptance: cancel reachable in no more clicks than subscribe; total price with fees rendered before payment; no `defaultChecked` on any opt-in or upsell input
  - Verify: `! grep -rn "defaultChecked" src/routes/billing/`
  - Checks: A-UX-17
- [ ] GA-xxx Clear the walls between signup and activation
  - Files: src/routes/onboarding/, src/lib/activation.ts
  - Acceptance: the activation route is reachable without email verification or card entry; first-run seeds sample data instead of a blank canvas; the tour library is removed from the manifest
  - Verify: `! grep -q "react-joyride" package.json`
  - Checks: A-UX-14, A-UX-2

## Anti-patterns hunted

- UX theater: a spinner bound to no promise, a progress bar fed a constant, a confirmation guarding nothing costly. Hunting rule: read the binding, not the widget, before crediting any state element (A-UX-21).
- Placeholder-as-label: `placeholder=` doing label duty across every field. Hunting rule: run the A-UX-9 grep, then report one systemic finding with member sites, never twelve leaves.
- Roach motel: subscribe in two clicks, cancel behind a support email; "Reject all" dimmed or an extra click away. Rule: confirmed instances are Critical, no negotiation (A-UX-17).
- Wall-before-value: verification, card, or sales-call gates before the first taste of value, justified nowhere in repo or plan (A-UX-14).
- Feature-tour onboarding: a tour library in the manifest and a first-run that walks the interface instead of driving the core action (A-UX-14).
- Database-surgery recovery: workflows whose stuck items have no reassign, recall, or rollback path in the product, so the runbook says "ask an engineer" (A-UX-11).
- Prediction-as-verdict: asserting CWV numbers, real contrast, or runtime focus order from static code. Refusal: such claims are Tentative, routed to the Verify-first phase with the confirming command named.
- Platitude findings: "onboarding is confusing", "improve usability". Refusal: every finding passes the substitution test and cites a file:line, route, or named step; anything less is deleted, not softened.
- Double-billing: contrast tokens and focus visuals belong to F-UI, CWV code signals to F-SEO, injection and exploitable authorization to F-SEC, stub handlers and fake data to F-BUILD. Refusal: cross-reference per the ownership map, never re-score.
- Severity inflation: a cosmetic nit dressed as High to force attention. Refusal: severities follow the funded-product calibration in Checks, moved only by the intake scale with the move stated.
