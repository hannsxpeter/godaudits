# SEO audit module

Audits how the codebase makes its website visible to classic search engines and citable by AI answer engines: crawl and index controls, the rendering path that decides what reaches non-JS crawlers, canonical and URL discipline, structured data honesty, the AI-crawler policy, and the regression net around all of it. It emits findings `F-SEO-n` and a 0-100 domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads it during the domain passes whenever the applicability matrix marks seo applicable, which requires a public crawlable surface per intake.md; cli-tool, library, api-service, ml-pipeline, extension, game, and mobile-app archetypes may exclude it with the reason recorded in the applicability matrix (a store listing or registry page is not a crawl surface this module owns).

## Lineage

Descends from seoauditor, the read-only 12-dimension visibility audit (CRAWL, RENDER, CONTENT, CANON, SCHEMA, AIVIS, URLARCH, PERF, SOCIAL, OBSV, I18N, FEEDS), via the godplans SEO module that inverted its checks into R-SEO-1 through R-SEO-22. The method DNA that carries over intact: verify against what reaches the crawler, never against intent (a `react-helmet` title in a CSR app reaches no non-JS bot; a Disallowed URL never shows its noindex); hunt paper controls as first-class findings; keep the three-way AI bot taxonomy (training vs search/citation vs user-fetch) and never conflate Google-Extended with AI Overviews; never score `llms.txt` as load-bearing; calibrate to site type so a monolingual site never draws hreflang findings; cluster systemic root causes into one finding; and enforce the visibility floor, where deindexing, CSR-invisibility, cloaking, canonical collapse, and self-defeating AI blocks are Critical no matter how good the rest is.

## Surface map

Inventory before checking; the intake fingerprint already records stack, framework, route inventory, entry points, and CI wiring, so cite it instead of re-scanning.

- Indexation controls: `app/robots.ts`, `public/robots.txt`, `static/robots.txt`, robots plugins, meta-robots and `X-Robots-Tag` emitters, env-conditional noindex branches.
- Rendering config: `ssr: false`, `output: 'export'`, `"use client"` at route roots, `client:only`, `export const prerender`, prerender-for-bots middleware.
- Metadata layer: `generateMetadata`, `next/head`, `useSeoMeta`, `react-helmet`, `<svelte:head>` blocks, `meta-tags`-style server helpers, canonical builders.
- URL and edge config: `next.config.*` redirects, `middleware.ts`, `vercel.json`, `netlify.toml`, `_redirects`, nginx or apache conf, header and WAF rules in-repo.
- Sitemaps and discovery: `app/sitemap.ts`, `next-sitemap.config.js`, sitemap plugins and their source queries.
- Structured data: every `application/ld+json` emitter, schema helper libs, SEO plugin output.
- Social surface: `opengraph-image.*`, `twitter-image.*`, dynamic OG routes, favicon and `apple-touch-icon` assets.
- AI surface: robots UA groups for AI bots, `public/llms.txt`, `ai.txt`, license markup.
- Conditional sub-surfaces, each declared present or absent with the reason recorded: I18N activates only when more than one locale exists (locales array, per-locale folders, message catalogs); FEEDS activates only when a content stream, feed generator, IndexNow key, or web app manifest exists.

## Checks

1. A-SEO-1 Every route class has a deliberate indexation disposition: public content indexable, authed app routes, previews, and internal search noindexed. In plan-aware mode, diff against the plan's route-class matrix.
   Look: robots meta in layouts and `generateMetadata`, middleware `X-Robots-Tag`, per-route `robots` exports.
   Fail: an indexable content route shipping noindex is Critical; authed or search-result routes with no index control is Medium.
2. A-SEO-2 Body content, title, canonical, robots meta, and JSON-LD exist in the initial server HTML of every indexable route.
   Look: `ssr: false`, `"use client"` at content route roots, `react-helmet` with no server pass, `document.title =`, meta writes in `useEffect`, `prerender.io`, `rendertron`, `react-snap`.
   Fail: CSR-only indexable content is Critical; any prerender-for-bots middleware is High.
3. A-SEO-3 Navigation is crawlable and status codes are honest: real `<a href>` links, a hard 404 for unknown routes, no JS or meta-refresh redirects, paginated URLs behind infinite scroll.
   Look: hash routing `#/`, `onClick` navigation, `/* /index.html 200` in `_redirects`, `error_page 404 =200`, infinite-scroll components.
   Fail: SPA catch-all serving 200 is High; hash-routed indexable content is High; infinite scroll with no paginated fallback is Medium.
4. A-SEO-4 The robots.txt generator obeys the five constraints: no `Disallow: /` under `User-agent: *` in prod, no dead directives (`noindex:`, `crawl-delay`, `host:`), no blocking of `/_next/`, `/static/`, `*.js`, `*.css`, an absolute `Sitemap:` line, and robots.txt never used as an index control.
   Look: `app/robots.ts`, `public/robots.txt`, robots plugins and their env branches.
   Fail: prod `Disallow: /` is Critical; a Disallowed URL that also carries noindex is High; dead directives are Low.
5. A-SEO-5 The environment indexability guard fails safe (unset env resolves to noindex, prod never emits it) and CI asserts prod builds contain no noindex.
   Look: env comparisons around noindex output, `VERCEL_ENV` or `DEPLOY_ENV` reads, CI build-integrity steps.
   Fail: inverted or missing polarity that can noindex prod is Critical; multiple deploy envs with no guard or no CI assertion is High.
6. A-SEO-6 The sitemap derives from the content model: only canonical, indexable, 200-status URLs, real per-URL lastmod, chunked above 50000 URLs, no `priority` or `changefreq`.
   Look: sitemap source queries, lastmod assignment, chunking logic.
   Fail: noindexed or redirected URLs emitted is Medium; a uniform build-time lastmod is Medium; `priority`/`changefreq` is Low theater.
7. A-SEO-7 Crawl traps consolidate: faceted navigation, sort orders, and session params canonicalize or noindex to the clean base URL; pagination is crawlable and never canonicalizes to page 1.
   Look: listing templates with query params, canonical builders echoing the raw request URL, pagination components.
   Fail: an uncontrolled facet space on an indexable catalog is High; page-1 canonicals on deeper pages is Medium.
8. A-SEO-8 One canonical model: a single redirect layer enforcing host, scheme, and slash with single-hop 301/308, and exactly one absolute self-referencing canonical per indexable page with `metadataBase` set.
   Look: framework redirects vs edge vs server layers, `alternates.canonical`, shared metadata helpers.
   Fail: a hardcoded homepage canonical on every page is Critical; competing redirect layers or chains is High; relative canonicals with no `metadataBase` is High.
9. A-SEO-9 Slug convention and lifecycle hold: lowercase hyphenated stable slugs, a redirect-map entry on every slug change, framework-correct status codes (`redirect()` is 307, `permanentRedirect()` is 308, Express defaults to 302).
   Look: slug generation, redirect maps, redirect call sites.
   Fail: permanent moves shipping 302/307 is Medium; slug edits with no redirect-map mechanism is Medium.
10. A-SEO-10 Every routable page has a unique title and description, exactly one meaningful h1, logical heading nesting, and semantic landmarks.
    Look: root layout vs per-page metadata, defaults like `React App`, heading components, `main`/`article`/`nav` counts per template.
    Fail: root-layout-only titles making every page identical is High; framework default titles is High; zero landmarks on a content template is Medium.
11. A-SEO-11 Content images carry descriptive alt (empty alt on decorative), anchors are descriptive, and the E-E-A-T surface is visible: bylines, publish and update dates, real About and Contact pages.
    Look: content templates, `alt=` values, `click here` anchors, byline and date components.
    Fail: article templates with no byline or dates is Medium; placeholder or stuffed alt text is Low.
12. A-SEO-12 JSON-LD is server-rendered per template with required fields per type, ISO 8601 dates, ISO 4217 currency, schema.org enum URLs, and entity grounding (`sameAs`, author as linked Person, publisher with logo).
    Look: `application/ld+json` emitters and schema helpers.
    Fail: Article missing headline, datePublished, or author is Medium; client-injected JSON-LD is High; dangling `@id` references is Low.
13. A-SEO-13 No fabricated structured data: no AggregateRating or Review without visible reviews in the same rendered template, no hardcoded sample values, no schema asserting facts absent from the page, no retired types (FAQPage, HowTo, SearchAction) as tactics.
    Look: grep `AggregateRating|ratingValue|FAQPage|HowTo|SearchAction` across templates and helpers.
    Fail: rating markup with no rendered reviews is Critical (manual-action trigger); retired types are Low theater.
14. A-SEO-14 The AI-crawler policy matches the three-way taxonomy and the stated visibility goal; `llms.txt` never load-bearing; `noai` meta known non-enforcing.
    Look: robots UA groups (GPTBot, Google-Extended, ClaudeBot, CCBot vs OAI-SearchBot, PerplexityBot, Claude-SearchBot vs ChatGPT-User, Perplexity-User, Claude-User), `public/llms.txt`, comments equating Google-Extended with AI Overviews.
    Fail: citation or user-fetch bots blocked while the site courts AI visibility is Critical; load-bearing `llms.txt` is Medium.
15. A-SEO-15 Content templates are answer-extractable: h2/h3 sections, lists and tables instead of undifferentiated paragraph blocks, machine-readable dates via `<time datetime>` matching schema fields.
    Look: article and docs templates, date rendering components.
    Fail: paragraph-only bodies on answer-target templates is Medium; styled-text-only dates is Medium.
16. A-SEO-16 The CWV code budget holds: LCP image never lazy and prioritized (`fetchpriority` or preload), dimensions on all media, `font-display` plus preload for critical fonts, code splitting, AVIF/WebP with srcset, immutable cache on hashed assets, async/defer third parties, viewport without `user-scalable=no`. This module owns CWV code signals; ui cross-references the F-SEO id per the ownership map.
    Look: hero components, `loading="lazy"`, framework image bypasses, font loading, script tags in head.
    Fail: a lazy-loaded LCP image is High; missing media dimensions is Medium; synchronous third-party scripts in head is Medium.
17. A-SEO-17 Per-route social metadata: `og:title`/`og:type`/`og:url`/`og:image` plus description, site_name, locale, `twitter:card`, absolute HTTPS images near 1200x630 with width, height, and alt, a square favicon of 48px or more, an apple-touch-icon; dynamic OG routes export size and contentType, use PNG or JPEG, load explicit fonts, and cache. Launch-page OG card execution belongs to the launch domain per the ownership map.
    Look: metadata exports, `opengraph-image.*`, OG route handlers, icon assets.
    Fail: relative or localhost `og:image` is High; one sitewide OG image and title is Medium.
18. A-SEO-18 (conditional: I18N) hreflang generates centrally from one locales list with reciprocity and self-reference, x-default to a neutral page, valid codes (`en-GB` not `en-UK`, hyphen not underscore), per-locale self-canonicals, full coverage, `html lang` and `og:locale` matching the route, no IP or Accept-Language hard redirects.
    Look: i18n config, hreflang generators, locale middleware.
    Fail: missing return tags is High; a cross-language canonical nullifying the cluster is Critical; IP auto-redirects is High. Monolingual: record I18N absent with the reason.
19. A-SEO-19 (conditional: FEEDS) feeds are valid with stable GUIDs and correct date formats, autodiscovery links point at feeds actually generated, any IndexNow key file is hosted, the manifest has name, short_name, in-scope start_url, and 192/512/maskable icons, and PWA is never framed as a ranking factor.
    Look: feed routes, `rel="alternate"` links, `manifest.webmanifest`, IndexNow key file.
    Fail: autodiscovery pointing at a 404 feed is Medium; build-derived GUIDs is Medium; an unhosted IndexNow key is Low.
20. A-SEO-20 SEO observability is wired: CI snapshot tests asserting title, canonical, robots meta, hreflang, and JSON-LD on key templates, robots and sitemap build-integrity assertions, broken-link and redirect-chain CI, exactly one owned verification token, Consent Mode v2 default-then-update wiring where consent applies, and zero user-agent or `isBot` content branching.
    Look: `tests/seo/`, CI workflows, `isBot(` and UA regexes in middleware, verification metas.
    Fail: cloaking via content branching is Critical; no SEO regression suite at funded-product scale is Medium; stale or unowned verification tokens is Low.
21. A-SEO-21 Edge config is crawl-safe: CSP does not block the site's own render-critical assets, HSTS pairs with an HTTP-to-HTTPS 301, WAF and rate limits never 403/429 legitimate search or allowed AI crawlers, no mixed content. Header security posture itself is owned by security; audit only crawler impact and cross-reference F-SEC per the ownership map.
    Look: header config in `next.config.*`, `vercel.json`, server conf, in-repo WAF or IaC rules.
    Fail: CSP blocking own JS/CSS is High; a crawler-blocking WAF rule is High; HSTS with no redirect is Medium theater.
22. A-SEO-22 Zero paper controls anywhere: `noindex:` robots lines, `priority`/`changefreq`, rel=next/prev shipped as a fix, hardcoded homepage canonicals, dead-URL redirects to the homepage, `llms.txt` as the strategy.
    Look: sweep every emitter inventoried in the surface map.
    Fail: inert instances are Low (remove the dead weight); actively harmful instances bill once under their owning check above, never twice.
23. A-SEO-23 No canonical contradictions: no page emits both a canonical-to-elsewhere and a noindex, no canonical points at a redirecting, 404, or noindexed URL, and exactly one canonical emitter exists (no theme-plus-plugin stacking).
    Look: all canonical sources found in the surface map, SEO plugin output vs hand-rolled head components.
    Fail: multiple conflicting canonicals on one page is High; canonical to a non-200 target is Medium.
24. A-SEO-24 Analytics hygiene: no duplicate tag firing (hardcoded gtag plus the same GA4 via GTM), no placeholder IDs (`G-XXXX`, legacy `UA-`), no dead experiment snippets (Google Optimize, sunset 2023).
    Look: analytics snippets in layouts, GTM containers, head includes.
    Fail: double-firing tags is Medium; placeholder IDs or dead snippets is Low.
25. A-SEO-25 Head hygiene: `meta charset` early in head, exactly one title element per rendered page, `html lang` present and matching the content language.
    Look: root layouts and document templates.
    Fail: missing `html lang` on a content site is Medium; duplicate or missing core head tags is Low.

## Scoring

Weighted dimensions, summing to 100. When a conditional dimension is absent, drop it and re-normalize the remaining weights proportionally; never zero-and-keep.

- Crawlability and indexation control (14): A-SEO-1, 4, 5, 6, 7.
- Rendering and content-in-HTML (13): A-SEO-2, 3.
- On-page content and semantics (12): A-SEO-10, 11.
- Canonicalization (11): A-SEO-8, 23.
- Structured data (10): A-SEO-12, 13.
- AI and generative-engine visibility (9): A-SEO-14, 15.
- URL architecture and edge config (8): A-SEO-9, 21.
- Core Web Vitals code signals (6): A-SEO-16.
- Social metadata and head hygiene (5): A-SEO-17, 25.
- SEO observability (3): A-SEO-20, 24.
- Internationalization (5, conditional): A-SEO-18.
- Feeds and installability (4, conditional): A-SEO-19.

A-SEO-22 sweep results score inside the dimension that owns each instance. Visibility-floor findings (sitewide deindex reaching prod, CSR-only indexable content, cloaking, canonical collapse, blocking citation bots while courting AI visibility) are Critical regardless of arithmetic. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

At audit time the agent adds the `Fixes:` line with real finding ids; seeds omit it.

- [ ] GA-xxx Fix the environment indexability guard and add the CI assertion
  - Files: app/robots.ts, lib/seo/env-guard.ts, .github/workflows/ci.yml
  - Acceptance: guard emits noindex only when the deploy env is not production and an unset env resolves to noindex; prod robots output has no `Disallow: /` under `User-agent: *`; CI fails when prod build HTML contains noindex
  - Verify: `node scripts/check-robots.mjs && ! grep -rq "noindex" .next/server/app/page.html`
  - Checks: A-SEO-4, A-SEO-5
- [ ] GA-xxx Move SEO signals into server HTML on indexable routes
  - Files: app/blog/[slug]/page.tsx, app/layout.tsx
  - Acceptance: no `"use client"` at any indexable route root; title, canonical, robots meta, and JSON-LD come from `generateMetadata` and server components; no `react-helmet` or `useEffect` meta writes remain; no prerender-for-bots middleware anywhere
  - Verify: `! grep -rEq "react-helmet|document.title" app/`
  - Checks: A-SEO-2
- [ ] GA-xxx Consolidate canonical emission into one helper and one redirect layer
  - Files: lib/seo/metadata.ts, next.config.js, middleware.ts
  - Acceptance: `metadataBase` set to the canonical origin; every template emits one absolute self-referencing canonical; exactly one layer owns host, scheme, and slash with 308s; no second canonical emitter remains
  - Verify: `grep -q "metadataBase" lib/seo/metadata.ts && node scripts/check-canonicals.mjs`
  - Checks: A-SEO-8, A-SEO-23
- [ ] GA-xxx Rebuild the sitemap from the content model
  - Files: app/sitemap.ts, lib/seo/sitemap-source.ts
  - Acceptance: source query excludes noindexed and redirected URLs; lastmod comes from each row's `updated_at`, not the build time; no `priority` or `changefreq` keys; chunking activates above 50000 URLs
  - Verify: `! grep -Eq "priority|changefreq" app/sitemap.ts && node scripts/check-sitemap.mjs`
  - Checks: A-SEO-6, A-SEO-22
- [ ] GA-xxx Align the AI-crawler policy with the visibility goal
  - Files: app/robots.ts, docs/seo-policy.md
  - Acceptance: OAI-SearchBot, PerplexityBot, Claude-SearchBot, and the user-fetch bots allowed; training-bot blocks are per-UA groups, never a blanket `Disallow: /`; `llms.txt`, if kept, is labeled non-load-bearing
  - Verify: `node scripts/check-robots.mjs --ai-policy`
  - Checks: A-SEO-14
- [ ] GA-xxx Wire the SEO regression suite into CI
  - Files: tests/seo/snapshots.test.ts, .github/workflows/ci.yml
  - Acceptance: snapshots assert title, canonical, robots meta, and JSON-LD per key template; a build-integrity test fails on prod noindex or an empty sitemap; no `isBot(` or user-agent content branching in source
  - Verify: `npm run test:seo && ! grep -rq "isBot(" app/ lib/`
  - Checks: A-SEO-20, A-SEO-5

## Anti-patterns hunted

- Sitewide deindex leak: `Disallow: /` in the prod robots path, or an env guard comparing with the wrong polarity so prod noindexes. Hunt every env branch around noindex; this is the catastrophic floor.
- CSR-only shell: an empty root div plus `react-helmet`, meta set in `useEffect`, JSON-LD via `document.createElement`. Hunt the rendering mode of every indexable route; intent in a plugin name is not evidence.
- Cloaking and prerender-for-bots: UA regexes branching content, `rendertron` or `prerender.io` middleware, `isBot(` gating markup. Always Critical; never recommend dynamic rendering as the fix.
- Canonical collapse: one hardcoded canonical constant reused by every template, or a per-locale constant that nullifies hreflang. Hunt shared metadata helpers for constant canonicals.
- Self-defeating AI invisibility: OAI-SearchBot or Perplexity bots blocked while `llms.txt` and answer schema ship. Check policy consistency against the stated goal before scoring AIVIS.
- llms.txt-as-strategy: a pristine `llms.txt` in front of client-rendered everything. Validate it for correctness, score it as inert, and say so.
- Fabricated structured data: AggregateRating with no rendered reviews, `"ratingValue": "5"` hardcoded, schema facts absent from the page. Content-match every schema field against the template.
- Paper-control bundle: `noindex:` robots lines, `priority`/`changefreq`, rel=next/prev, uniform build lastmod, HSTS without a redirect. Classify each as inert (remove) or actively harmful (fix), never just list absences.
- Cargo-cult calibration: hreflang findings on a monolingual site, e-commerce schema demands on a docs site, flagging noindex on authed routes as a defect. Refused: conditional dimensions activate only from the surface map, and correct noindexing is a strength.
- Auditor discipline: no finding that survives the substitution test unspecified ("improve SEO" is banned), no double-billing (CWV CSS/JS findings are owned here and cross-referenced by ui; security header posture stays with security), no severity inflation (a missing meta description on one page is never reported at sitewide-noindex severity).
