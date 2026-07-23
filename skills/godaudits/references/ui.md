# UI audit module

Audits how the codebase implements its user interface as written: accessibility of the rendered markup, semantic structure, styling architecture, component state correctness, responsive layout, render-path wiring, design-system consistency, assets, i18n readiness, and native surfaces. It emits findings `F-UI-n` and a 0-100 domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads it during the domain pass whenever the applicability matrix marks ui applicable, which per intake requires rendered pixels the project owns; cli-tool (terminal output is ux, not ui), library, api-service, and ml-pipeline without an ops console exclude it, each with the reason recorded in the applicability matrix. Boundaries per the ownership map: journey design and flow a11y belong to ux; DOM-XSS sinks (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`) belong to security and are cross-referenced as F-SEC, never scored here; sitewide Core Web Vitals code signals cross-reference F-SEO; generic bundle weight and dead JS belong to code-quality.

## Lineage

This module descends from uiauditor (github.com/hannsxpeter/uiauditor), one of the seven hannsxpeter auditors, by way of the godplans ui module that inverted it into plan requirements R-UI-1 through R-UI-20. From the ancestor it keeps: the ten-dimension structure and weights with accessibility highest under every combination; the accessibility floor (an accessibility Critical drags the audit one band below any other Critical); the eight enumerated always-Critical conditions; the paper-control hunt (declared-but-unwired protections are findings, never credit); the calibrate-to-paradigm rule (the Tailwind config IS the token source; React Native is judged on native primitives, not semantic HTML); the rendered-output-over-the-prop's-promise discipline; root-cause clustering (one systemic finding, not forty leaves); and the severity/confidence/effort triple, with the ancestor's Suspected label mapping to Tentative in the godaudits grammar. Read-only carries over absolutely: never run the app, open a browser, execute a scanner, or claim a measurement not made.

## Surface map

Cite the intake fingerprint for stack, manifests, monorepo layout, entry points, and route registration; do not re-scan them. Then inventory the UI surface:

- Templates and components: `src/**/*.{jsx,tsx,vue,svelte,astro}`, `*.component.html`, plain `*.html` pages; the primitive layer (`src/components/ui/`) and every custom interactive widget (menus, tabs, dialogs, comboboxes, carousels).
- Document shell: `app/layout.tsx`, `index.html`, `src/app.html`, `_document.tsx`, or the framework metadata API; the global reset and `src/styles/globals.css`.
- Token and theme sources: `tailwind.config.*`, `tokens.json`, `theme.ts`, `:root` custom-property blocks; exactly one should be authoritative.
- Styles: `**/*.{css,scss,less}`, CSS-in-JS sites, CSS modules; where the cascade strategy lives (`@layer`, modules, scoped styles).
- Assets: `public/`, `static/`, `assets/`: images, icons, fonts, the favicon set, the web app manifest.
- Forms and overlays: every form (label to error to submit) and every dialog, drawer, and popover implementation.

Conditional sub-surfaces, each declared present or absent with the reason recorded in the audit: i18n (catalogs under `locales/`, `*.po`, i18next/next-intl/vue-i18n config), native (`react-native` or `expo` in `package.json`), Web Components and shadow DOM (Lit, Stencil, `customElements.define`), theming and dark mode (`data-theme`, `.dark`, `color-scheme`), and print surfaces (invoice or report routes). Before checks run, trace two or three load-bearing render paths end to end: the primary form, the landing shell to its LCP element, one custom widget from markup to keyboard handler to focus management.

## Checks

A grep hit is a lead, not a finding: read the cited template or stylesheet and confirm the rendered output before recording. Severities are funded-product calibration; in plan-aware mode every finding's Checks line adds the matching R-UI id.

Mirror boundary: A-UI-1..20 mirror R-UI-1..20 one to one; A-UI-21 and up are audit-only. Cross-verified against godplans: R-UI-1..21 defined.

1. A-UI-1 The stack contract is reconstructable and singular: one framework, one rendering model, one styling model, exactly one design-token source, a named design system, deliberate Web Components use.
   Look: `package.json`, `next.config.*`, `astro.config.*`, `nuxt.config.*`, `vite.config.*`, `tailwind.config.*`, `tokens.json`, `theme.ts`, `:root` blocks.
   Fail: two competing token sources or styling models with neither authoritative: Medium. Plan-aware: code contradicting a PLAN.mdx stack decision: High.
2. A-UI-2 Native elements do interactive work: `button` for actions, `a[href]` for navigation, native inputs, `details`/`summary` disclosure, `dialog` modals.
   Look: `grep -rEn '<(div|span)[^>]*(onClick|@click|on:click)' src/` across `*.jsx`, `*.tsx`, `*.vue`, `*.svelte`, `*.html`.
   Fail: a `div`/`span` doing a control's work without role, `tabindex="0"`, and a key handler: High; when it locks keyboard users out of a load-bearing control: Critical.
3. A-UI-3 Every control has an accessible name, every field a programmatic label, images follow an alt policy, load-bearing media has captions or a transcript.
   Look: icon-only buttons whose only child is an `svg`; `input`/`select`/`textarea` without `for`/`id`, wrapping `label`, or `aria-label`; missing `alt`; placeholder-only fields; `video`/`audio` sites.
   Fail: unnamed core control or captionless load-bearing media: Critical; placeholder-only labels or informative `alt=""`: High.
4. A-UI-4 ARIA is valid and keyboard discipline holds: widget roles carry mandatory states, ID references resolve, no `aria-hidden` on focusables, no positive `tabindex`, a skip link first, APG keyboard models on custom widgets.
   Look: `grep -rEn 'role="(tab|checkbox|combobox|menu|listbox)"' src/` then read for `aria-selected`/`aria-checked` and arrow-key handlers; `grep -rEn 'tabindex="[1-9]' src/`.
   Fail: a custom widget with no keyboard path on a load-bearing surface: Critical; positive `tabindex`, unresolved refs, or `aria-hidden` wrapping focusables: High.
5. A-UI-5 Overlays run through one shared focus-managed primitive: focus set on open, trapped while open, restored on close, Escape dismisses, portal-rendered, `showModal()` or `role="dialog"` plus `aria-modal`.
   Look: overlay sources in `src/components/ui/`; `grep -rn '\.show()' src/`; per-feature dialog copies.
   Fail: a focus trap with no keyboard escape or a non-dismissable full-page overlay: Critical; `dialog.show()` for modal use: High; parallel overlay implementations: Medium.
6. A-UI-6 Focus stays visible: a `:focus-visible` baseline exists and survives the cascade; no `outline: none` without a replacement indicator.
   Look: `grep -rn 'outline' src/styles/` and the reset; rule order against every `:focus-visible` declaration.
   Fail: a global reset strips outlines with no replacement, or the `:focus-visible` rule is defeated by a later selector: High.
7. A-UI-7 Motion is gated: animation behind `prefers-reduced-motion`, `transform`/`opacity` only, pause controls on auto-advancing content.
   Look: `grep -rn 'prefers-reduced-motion' src/`; `@keyframes` and `transition` sites; carousel, ticker, and auto-dismiss toast components.
   Fail: auto-advancing content with no pause/stop/extend control: High; ungated animation or layout-property animation (`width`, `top`, `margin`): Medium.
8. A-UI-8 Status and shell basics are wired: errors via `aria-describedby` plus `aria-invalid`, live regions written by real code paths, semantic input types with `autocomplete` and `inputmode`, `html lang` set, zoom never blocked.
   Look: `grep -rEn 'user-scalable=no|maximum-scale=1' src/`; `aria-live`/`role="status"` regions and their writers; form error rendering; the document shell.
   Fail: zoom disabled: Critical; a live region nothing writes to, or errors not tied to their fields: High; missing `lang`: Medium.
9. A-UI-9 Document structure holds per route: one `h1`, no skipped levels, a single `main` with landmarks, no stranded content, valid nesting, no duplicate ids, descriptive per-route titles, complete shell metadata.
   Look: route templates and layouts; `grep -rEn '<(main|h1)' src/`; interactive-in-interactive nesting (`button` inside `a`); duplicate id values.
   Fail: nested interactive elements or duplicate ids breaking ARIA references: High; missing or multiple `h1`/`main`, skipped levels, generic titles: Medium.
10. A-UI-10 Styling architecture is deliberate: a cascade strategy, no `!important` wars, a z-index scale, logical properties for RTL safety, Flexbox/Grid primitives, print styles on report surfaces.
    Look: `grep -rc '!important' src/`; `grep -rEn 'z-index: *[0-9]{3,}' src/`; physical `margin-left` density vs `margin-inline`; `@media print` when invoice or report routes exist.
    Fail: `!important` wars or magic z-index stacks: Medium; a report surface with no print styles, or RTL scope built on physical properties: Medium.
11. A-UI-11 Data views render the full state matrix: loading, empty, error, and success wired to real state; controlled inputs paired with `onChange`; stable keys; portal overlays; error boundaries on data trees.
    Look: fetching and mutating components; `grep -rEn 'key=\{(index|i)\}' src/`; `value=` without `onChange`; error boundary presence.
    Fail: a load-bearing form frozen (controlled input, no `onChange`) or losing input on submit: Critical; happy-path-only data views: High; index keys on mutable lists: Medium.
12. A-UI-12 The responsive contract is real: reflow at 320 CSS px, fluid containers, dimensions reserved on media, targets at least 24x24 CSS px, no hover-only affordances, click alternatives to drag, `rem`/`em` text, safe-area insets.
    Look: fixed container widths (`grep -rEn 'width: *[0-9]{3,}px' src/`); `img`/`iframe` without `width`/`height`/`aspect-ratio`; `:hover`-only menus; breakpoints vs content min-widths.
    Fail: fixed-width layout forcing horizontal scroll at 320px: Critical; hover-only navigation: High; undimensioned media: Medium.
13. A-UI-13 The render path is wired: the LCP element prioritized (`fetchpriority="high"` or the framework `priority` prop), never lazy above the fold, critical fonts preloaded with `font-display`, below-fold images lazy, long lists virtualized.
    Look: hero and landing components; positions of `grep -rn 'loading="lazy"' src/` hits; font preload in the shell; list renderers over large collections.
    Fail: `loading="lazy"` on the LCP hero: High; unvirtualized thousand-row lists or fonts without `font-display`: Medium. Sitewide CWV code signals cross-reference F-SEO; numeric CWV claims stay Tentative.
14. A-UI-14 Token discipline holds: no raw hex/rgb or off-scale spacing, no arbitrary utility values, no hand-rolled duplicates of existing primitives, no inline restyling of DS components per use.
    Look: `grep -rEn '#[0-9a-fA-F]{3,6}' src/components/` outside the token source; `grep -rEn '\[[0-9]+px\]|\[#' src/` for arbitrary Tailwind values; near-duplicate primitives.
    Fail: a decorative token source (declared, widely bypassed): High; scattered raw literals: Medium.
15. A-UI-15 Theming swaps end to end when in scope: every color routed through tokens that fully swap, `color-scheme` set, no subtree bypassing the provider, custom properties crossing any shadow boundary.
    Look: `data-theme` or `.dark` selectors against the token file; hardcoded colors inside themed components; `color-scheme` in globals; `:host` plumbing in Web Components.
    Fail: a half-hardcoded theme (dark mode leaves literals unswapped): High; missing `color-scheme`: Low. Absent theming: record the absence and skip.
16. A-UI-16 The asset pipeline is sound: modern formats with `srcset`/`sizes`, per-icon imports or a sprite, optimized SVGs, subset preloaded fonts, a complete favicon/manifest set, iframes carrying `title`, `sandbox`, `loading="lazy"`.
    Look: `public/` and `static/` weights and formats; whole-library icon imports; SVG editor cruft and embedded rasters; the shell's icon and manifest links.
    Fail: a broken asset or favicon reference on a load-bearing surface: High; whole icon-library imports or unsubset font families: Medium.
17. A-UI-17 (conditional: i18n surface present) Localization is real: strings in the catalog including `alt` and `aria-label`, ICU or `Intl.PluralRules` plurals, `Intl` date/number formatting, `dir` derived from locale, mirrored icons, expansion-safe layouts.
    Look: `locales/**`, `*.po`, i18next/next-intl/vue-i18n config; hardcoded strings in templates; `grep -rn 'n === 1' src/`; `dir=` derivation.
    Fail: an i18n runtime installed while screens hardcode English: High; hand-rolled plurals or fixed-locale formatting: Medium. Absent surface: record the absence with reason.
18. A-UI-18 (conditional: native toolkit present) Native UI uses native primitives: `Pressable`/`TextInput` over tap-handler `View`s, accessibility props on custom controls, `FlatList` with a stable `keyExtractor`, safe-area insets, explicit `Platform.select` branches.
    Look: `react-native` or `expo` in `package.json`; `.map()` renders inside `ScrollView`; `accessibilityLabel` and `accessibilityRole` density; web assumptions in shared code.
    Fail: hundreds of rows mapped inside `ScrollView`, or custom controls without `accessibilityLabel`/`accessibilityRole`: High.
19. A-UI-19 No paper controls: every declared protection traces to real wiring: spinners to pending state, live regions to writers, skip links to existing ids, tokens to consumers, focus styles surviving the cascade.
    Look: each protection surfaced by A-UI-3 through A-UI-15, traced from declaration to the code path that exercises it.
    Fail: a declared-but-unwired protection on a load-bearing surface (accessibility theater): Critical; elsewhere: High.
20. A-UI-20 The eight always-Critical conditions are absent: keyboard lockout, unnamed core control, inescapable focus trap, zoom disabled, captionless load-bearing media, a11y theater, no 320px reflow, broken load-bearing form.
    Look: the zero-count sweep `grep -rEn '<(div|span)[^>]*onClick|tabindex="[1-9]|user-scalable=no|maximum-scale=1' src/` plus the A-UI-3, A-UI-5, A-UI-11, and A-UI-12 reads.
    Fail: any confirmed hit: Critical, never downgraded at any scale calibration. Plan-aware: a checked PLAN.mdx UI sweep task whose greps now fail also cross-references roadmap drift.
21. A-UI-21 (audit-only) Color independence and computable contrast: no meaning carried by color alone; statically computable token pairs meet 4.5:1.
    Look: error, success, and status styling that changes only color with no icon or text; the token file's foreground/background pairs computed numerically.
    Fail: color-only signaling on forms or status surfaces: High; a token pair computing below 4.5:1: Medium at Tentative confidence (real pixel contrast needs a browser tool).
22. A-UI-22 (audit-only) The cascade is live: no never-matched `@media` blocks (breakpoint below the guarded element's own fixed min-width), no selectors matching nothing, no later rules silently defeating earlier protections.
    Look: media queries read against the fixed dimensions of the elements they guard; duplicated declarations; reset order relative to component styles.
    Fail: a never-matched responsive block guarding a load-bearing adaptation: High; dead or duplicated CSS: Low. Dead JS/TS belongs to code-quality per the ownership map.
23. A-UI-23 (audit-only) Hydration and island wiring is deliberate: interactive islands carry client directives, no `use client` at route roots, no SSR/client markup divergence, lazy routes not statically imported anyway.
    Look: `grep -rn 'use client' src/app/` at route roots; Astro components with handlers but no `client:` directive; `Date.now()` or `Math.random()` in SSR render paths.
    Fail: an interactive island shipped with no client directive (dead controls): High; a route-root `use client` or a lazy route still statically imported: Medium.
24. A-UI-24 (audit-only) WCAG 2.2 pointer target size and focus appearance: interactive targets meet the 24 by 24 CSS px minimum with adequate spacing (WCAG 2.5.8 Target Size Minimum), and the stated mobile target contract where one exists; the focus indicator meets the focus-appearance minimum (WCAG 2.4.11): never removed without an equivalent, with sufficient area and contrast against adjacent colors.
    Look: CSS for interactive controls' min-width/min-height/padding and spacing; `outline: none` or `outline: 0` with no replacement `:focus-visible` style; icon-only, close, or nav controls sized below 24px; dense list or toolbar tap targets.
    Fail: interactive targets below the 24px minimum without a valid exception (inline text links, user-agent controls), or a removed or too-faint focus indicator: Medium (High when it blocks a primary action on touch or defeats keyboard focus visibility). Cross-reference F-CMP for WCAG 2.2 AA.

## Scoring

Dimensions and weights carry over from uiauditor. The eight always-on dimensions sum to 100; the two conditional dimensions carry nominal weights outside that pool. When a conditional surface is absent, its dimension drops entirely (never zero-and-keep) with the absence reason recorded; when present, add its nominal weight and rescale all active weights to sum to 100 (I18N alone: multiply by 100/108; both active: 100/117).

| Dimension | Weight | Checks |
|---|---|---|
| Accessibility and inclusive markup | 22 | A-UI-3, A-UI-4, A-UI-5, A-UI-6, A-UI-7, A-UI-8, A-UI-19, A-UI-20, A-UI-21 |
| Semantic structure | 14 | A-UI-2, A-UI-9 |
| Styling architecture | 13 | A-UI-10, A-UI-22 |
| Component state correctness | 13 | A-UI-11, A-UI-23 |
| Responsive layout | 12 | A-UI-12 |
| Render-path performance | 11 | A-UI-13 |
| Design system and theming | 9 | A-UI-1, A-UI-14, A-UI-15 |
| Assets and media | 6 | A-UI-16 |
| I18n readiness (conditional) | 8 nominal | A-UI-17 |
| Native UI (conditional) | 9 nominal | A-UI-18 |

A-UI-24 carries no weight of its own: its findings score inside the accessibility dimension of the control they implicate.

The accessibility floor carries over: a Critical owned by the accessibility dimension holds that dimension in the 0-59 band, and the eight A-UI-20 conditions stay Critical at every scale calibration; calibration moves other severities, never these. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

Seed shapes for the most common UI findings; at audit time the agent adds the `Fixes:` line with real finding ids.

- [ ] GA-xxx Replace `div`/`span` click targets with native controls
  - Files: src/components/, src/features/
  - Acceptance: every action is a `button` and every navigation an `a[href]`; zero `onClick`/`@click` handlers on `div`/`span`; converted controls keep their visible styling
  - Verify: `! grep -rEn '<(div|span)[^>]*onClick' src/`
  - Checks: A-UI-2, A-UI-4, A-UI-20
- [ ] GA-xxx Consolidate overlays into one focus-managed primitive
  - Files: src/components/ui/overlay.tsx, src/features/
  - Acceptance: one shared primitive using `showModal()` or `role="dialog"` plus `aria-modal`; focus set on open, trapped while open, restored on close; Escape dismisses; every feature overlay imports it
  - Verify: `grep -rn 'showModal' src/components/ui/ && ! grep -rn '\.show()' src/`
  - Checks: A-UI-5, A-UI-19
- [ ] GA-xxx Restore focus visibility and motion gating in globals
  - Files: src/styles/globals.css
  - Acceptance: a `:focus-visible` style that survives the cascade; zero `outline: none` without an adjacent replacement; all animation gated behind `prefers-reduced-motion`
  - Verify: `grep -n 'focus-visible' src/styles/globals.css && grep -n 'prefers-reduced-motion' src/styles/globals.css`
  - Checks: A-UI-6, A-UI-7
- [ ] GA-xxx Label every field and wire error surfaces to real state
  - Files: src/components/ui/field.tsx, src/features/
  - Acceptance: zero inputs without a programmatic label; errors reach fields via `aria-describedby` plus `aria-invalid`; semantic types with `autocomplete` on identifiable fields
  - Verify: `grep -rEn 'aria-describedby|aria-invalid' src/components/ui/field.tsx`
  - Checks: A-UI-3, A-UI-8
- [ ] GA-xxx Add the four-branch state matrix to data views
  - Files: src/components/views/
  - Acceptance: every fetching view renders loading, empty, error, and success tied to real state; zero `key={index}` on mutable lists; an error boundary wraps each data-driven tree
  - Verify: `! grep -rEn 'key=\{(index|i)\}' src/components/`
  - Checks: A-UI-11
- [ ] GA-xxx Re-point raw literals at the token source
  - Files: src/components/, tailwind.config.ts
  - Acceptance: zero raw hex/rgb literals outside the token source; zero arbitrary utility values off the configured scale; the dark theme swaps every color token
  - Verify: `! grep -rEn '#[0-9a-fA-F]{6}' src/components/`
  - Checks: A-UI-14, A-UI-15
- [ ] GA-xxx Fix the render path on the landing route
  - Files: src/app/page.tsx, src/app/layout.tsx
  - Acceptance: the LCP element carries `fetchpriority="high"` or the framework `priority` prop; zero `loading="lazy"` above the fold; critical fonts preloaded with `font-display` set
  - Verify: `grep -rEn 'fetchpriority|priority' src/app/ && grep -rn 'font-display' src/styles/`
  - Checks: A-UI-13, A-UI-16

## Anti-patterns hunted

- Paper controls: an `aria-live` region nothing writes to, a spinner with no pending state, a skip link targeting a missing id, a token file components bypass. Hunt: trace every protection to its writer or consumer; unwired on a load-bearing surface is Critical under A-UI-19.
- The prop's promise: a component named `AccessibleModal` that never moves focus or sets `aria-modal`. Hunt: verify the rendered markup, never the name; the gap between the claim and the output is itself the finding.
- Decorative tokens: `tokens.json` or a `:root` block declared while components hardcode the literal next to it. Hunt: token adoption is proven by a zero-count grep for raw literals, never by the file's existence.
- Display-none responsive: a mobile layout that is only the desktop nav hidden. Hunt: demand actual reflow and adapted interaction at 320px under A-UI-12; a hidden element is not adaptation.
- Happy-path-only views: data views with a success branch and nothing else, or an `isLoading` flag declared but never rendered. Hunt: absent or unrendered branches on fetching views are findings under A-UI-11, not style preferences.
- Self-defeating performance: `loading="lazy"` on the LCP hero, `use client` at a route root, a lazy route statically imported anyway. Hunt: flag inverted optimizations by name under A-UI-13 and A-UI-23.
- Framework-blind calibration: holding Tailwind to a `tokens.json` bar or React Native to semantic HTML. Refusal: every check is instantiated in the detected stack's own idiom; the Tailwind config is a token source, not its absence.
- Double-billing: scoring a DOM-XSS sink, a walked keyboard journey, a sitewide CWV signal, or dead JS in this domain. Refusal: cross-reference F-SEC, the ux domain, F-SEO, and code-quality per the ownership map; emit nothing here for them.
- Suspected-as-fact: claiming real pixel contrast, runtime focus order, screen-reader output, or CWV numbers from a static read. Refusal: mark such findings Tentative with the confirming step named; no cap applies until confirmed.
- Platitude findings: "improve accessibility", "make it responsive". Refusal: every finding names `file:line`, the element or selector, the WCAG success criterion or APG pattern, and a countable fix; anything failing the substitution test is cut.
