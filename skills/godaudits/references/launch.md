# Launch audit module

Audits the launch surface of a codebase: positioning and copy honesty, the landing page anatomy, launch-day SEO and OG cards, the waitlist and email funnel, channel plans and their etiquette, launch telemetry and attribution, and the D-7 to D+7 runbook with its sibling couplings. It emits findings `F-LAUNCH-n` and a 0-100 domain score into AUDIT.json and its generated AUDIT.mdx view. The orchestrator loads it during the domain passes whenever the applicability matrix marks launch applicable, which requires a public audience per intake.md; internal tools, private api-services, cli-tool, and library archetypes may exclude it with the reason recorded in the applicability matrix (a registry release page is not a launch surface this module owns).

## Lineage

Descends from launch-ready, the shipping-tier ready-suite skill, via the godplans launch module that inverted its pass/fail gates into R-LAUNCH-1 through R-LAUNCH-21. The method DNA that carries over intact: the substitution test as a sentence-by-sentence discipline (a hero that stays plausible with a competitor's name swapped in is a defect, not a style note); the banned-word list as a grep-detectable AI-slop signature; the five-section landing anatomy with a single above-the-fold CTA; the five-channel OG preview rule driven by LinkedIn's 7-day card cache; per-venue etiquette encoded as have-nots (Show HN titles, PH 12:01 AM PT Tue-Thu, Reddit 9:1, LinkedIn founder voice); the paper-waitlist and silent-launch gates; and the runbook-as-calendar mechanic. launch-ready's have-nots list is this module's severity floor: its disqualifiers land High or Critical here regardless of how polished the rest of the surface is.

## Surface map

Inventory before checking; the intake fingerprint already records stack, routes, entry points, deploy configs, and CI wiring, so cite it instead of re-scanning.

- Landing surface: `site/`, `www/`, `app/(marketing)/`, `pages/index.*`, `public/index.html`, or a separate marketing repo noted in the fingerprint.
- Launch docs: `docs/launch/`, `.launch-ready/` (`STATE.md`, `POSITIONING.md`, `launches/`, `retrospectives/`, `utm-registry.md`).
- OG and social assets: `public/og*.png`, `opengraph-image.*`, `twitter-image.*`, favicon set, press kit at `/press` or `public/press/`.
- Capture and funnel: waitlist form markup, `api/subscribe*` handlers, ESP SDK calls (Kit, Loops, Resend, Buttondown, Beehiiv), email templates and sequence docs.
- Sending domain: DNS records in IaC or zone files, SPF/DKIM/DMARC documentation, unsubscribe and consent markup.
- Telemetry: analytics snippets, conversion-event call sites, the UTM registry, referrer dashboard config.
- Runbook and channels: `docs/launch/RUNBOOK.md`, `docs/launch/channels.md`, post drafts in launch assets.
- Status page: footer links, status provider config (Instatus, Statuspage, BetterStack) and where it is hosted.
- Conditional sub-surfaces, each declared present or absent with the reason recorded: channel assets (absent by design in Mode E quiet-B2B launches), press kit (optional at every scale), the waitlist funnel (absent when the product signs users up directly; record it and re-normalize).

## Checks

Mirror boundary: A-LAUNCH-1..22 mirror R-LAUNCH-1..22 one to one; A-LAUNCH-23 and up are audit-only. Cross-verified against godplans: R-LAUNCH-1..22 defined.

1. A-LAUNCH-1 Positioning exists and survives the substitution test: the four sentences (who it is for, what it replaces, what it does differently, the differentiator test) are recoverable from a positioning doc or the landing hero, each falsified by swapping in at least two named competitors. In plan-aware mode, diff against the plan's positioning block.
   Look: `docs/launch/POSITIONING.md`, `.launch-ready/POSITIONING.md`, hero headline and sub-headline in the landing source.
   Fail: a hero that stays plausible under a competitor-name swap is High (hero fatigue); no positioning artifact at funded-product scale is Medium.
2. A-LAUNCH-2 Tone and founder voice hold: three adjectives plus three anti-adjectives recorded, the hero in first person with a named founder or a founder-story line, no company-we voice above the fold.
   Look: the positioning doc's tone block; grep `we are thrilled|our team is passionate|our mission` across landing copy.
   Fail: a company-we hero with no named founder is Medium; tone words absent while copy surfaces multiply is Low.
3. A-LAUNCH-3 Launch mode and tier are declared and scope the assets: a mode (A pre-launch through E quiet-B2B) and target tier recorded, channel assets consistent with it, and Mode C or D naming the dominant prior-launch failure cause.
   Look: `.launch-ready/STATE.md`, `docs/launch/`, `retrospectives/`.
   Fail: broad-channel drafts in a declared Mode E repo is Medium; Mode C or D with no named prior failure cause is Medium; no mode recorded anywhere launch assets exist is Low.
4. A-LAUNCH-4 Landing anatomy: five sections in order (hero, social proof, feature grid, pricing if applicable, CTA), exactly one `<h1>`, exactly one primary CTA above the 1366x768 fold.
   Look: the landing route source, section markup, CTA components, hero media.
   Fail: multiple above-the-fold primary CTAs is Medium; multiple `<h1>` elements is Medium; a carousel or autoplay-video hero is Medium.
5. A-LAUNCH-5 Feature grid honesty: 3-6 tiles, each naming a product-specific capability that exists in the codebase; no category-label tiles (Fast, Secure, Scalable) and no tile promising a feature no route or module delivers.
   Look: feature-grid markup diffed against the intake fingerprint's route and module inventory.
   Fail: a tile promising vapor is High (cross-reference F-BUILD when the feature exists as a stub, per the ownership map); a grid over 6 tiles or built of category labels is Medium.
6. A-LAUNCH-6 Banned-word audit: zero hits above the fold from the slop set (seamless, powerful, revolutionary, effortless, intelligent, cutting-edge, game-changing, unlock, supercharge, streamline, empower, elevate, robust, best-in-class, leading, enterprise-grade, world-class).
   Look: case-insensitive grep across landing source, email templates, and channel post drafts.
   Fail: three or more hits above the fold is High (the AI-slop signature); one or two is Medium; hits in email subject lines is Medium.
7. A-LAUNCH-7 Copy voice: active voice, second person, named subjects, and no AI self-reference in the hero unless the product is an AI product whose differentiator is the AI itself.
   Look: hero and sub-hero copy; grep `AI-powered|powered by AI` in the hero block.
   Fail: AI self-reference in a non-AI product's hero is Medium; passive third-person hero copy is Low.
8. A-LAUNCH-8 Brand tokens are real: a named brand color, two grays, one or two typefaces, and a real icon library on the landing surface; no library-default styling shipped as identity, no emoji UI markers, no stock abstract-people illustrations.
   Look: landing CSS and token files, tailwind config overrides, icon imports (lucide, heroicons, phosphor), hero image assets.
   Fail: emoji as UI markers is Medium; an unmodified template palette and typeface on every surface is Medium.
9. A-LAUNCH-9 Launch-page SEO checklist: exactly one `<h1>`, `<title>` under 60 characters, meta description under 160, canonical URL, robots.txt, sitemap.xml, complete OG and Twitter tags, JSON-LD, HTTPS-only references, and no leftover template noindex. CWV code signals cross-reference F-SEO per the ownership map.
   Look: landing head markup, `public/robots.txt`, sitemap config for the marketing surface; grep `noindex` in shipped HTML.
   Fail: a leftover noindex on the shipped landing surface is Critical (silent de-indexing); missing OG or Twitter tags is Medium; an over-length title or description is Low.
10. A-LAUNCH-10 OG card to spec: exactly 1200x630, under 300KB, product name plus a 6-10 word value prop legible at 600x315, brand color present, nothing critical in the outer 40px.
    Look: `public/og*.png`, `opengraph-image.*` route output; image metadata via `identify` or `sips -g pixelWidth -g pixelHeight`.
    Fail: wrong dimensions or over 300KB is Medium; a logo-only card with no product name or value prop is Medium.
11. A-LAUNCH-11 Five-channel preview evidence: the OG card was previewed on X, LinkedIn (Post Inspector), Slack, iMessage, and Discord before any link shipped, with screenshots or a checked runbook row at or before D-1 as evidence.
    Look: `.launch-ready/assets/og-previews/`, runbook rows, the launch log.
    Fail: no preview evidence with a launch date set or passed is Medium (LinkedIn caches a wrong card for 7 days); a preview row scheduled after link-sharing tasks is Low.
12. A-LAUNCH-12 The waitlist is not paper: a capture form of two fields max, double opt-in where the confirmation email precedes list entry, an inline thank-you naming the confirmation email, and a welcome email within 5 minutes of confirmation.
    Look: form markup, `api/subscribe*` handlers, ESP config and send call sites.
    Fail: capture with no double opt-in is High (paper waitlist); no welcome send path is Medium; a form over two fields is Low.
13. A-LAUNCH-13 The email sequence is complete: 2-4 pre-launch emails each with a stated purpose, a launch-day drop, and D+1, D+3, D+7 post-launch emails drafted or templated. Transactional email (resets, receipts) belongs to product surfaces, not this funnel.
    Look: `docs/launch/emails/`, ESP exports, email template directories.
    Fail: no post-launch emails planned is Medium (silent fade); purpose-less drip filler is Low.
14. A-LAUNCH-14 Sending-domain authentication and consent: SPF, DKIM, and DMARC recorded in IaC or documented for the sending domain, a list-level unsubscribe in every template, a GDPR consent checkbox when EU or UK users are in scope.
    Look: DNS IaC and zone files, `docs/launch/dns-email-auth.md`, email footers, form consent markup.
    Fail: scheduled sends with no DMARC evidence is High (a launch-day drop from an unauthenticated domain lands in spam with no retry); a mailto-the-founder unsubscribe is Medium.
15. A-LAUNCH-15 Channel plans follow venue etiquette: each in-scope channel has all seven fields (venue, timing with timezone, title, body, hunter or submitter, amplification plan, response plan); the Show HN title has no "launch" and no all-caps, the PH slot is 12:01 AM PT Tue-Thu with a hunter confirmed more than 48 hours out, Reddit targets have real prior participation at 9:1, LinkedIn is founder voice.
    Look: `docs/launch/channels.md`, post drafts in launch assets.
    Fail: an etiquette-violating title or slot in a committed plan is Medium; channel drafts carrying under half the seven fields is Medium.
16. A-LAUNCH-16 UTM discipline: a utm-registry exists and every shareable link in launch assets (emails, post drafts, press kit) carries registered `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` values.
    Look: `docs/launch/utm-registry.md`, grep `utm_` across email templates and channel drafts, grep bare product URLs in the same files.
    Fail: shared links with no UTM params is High (silent launch; arrived traffic can never be retro-tagged); registry value collisions is Medium.
17. A-LAUNCH-17 The conversion waterfall is instrumented: the five events (visit, CTA click, form submit, confirmation, activation) have call sites in code and a staging test that fires and verifies each one.
    Look: analytics calls (`plausible(`, `posthog.capture`, `gtag(`) around the CTA, form, confirmation, and activation paths; `tests/launch/`.
    Fail: analytics installed with no waterfall events is High (attribution blind); no staging test at funded-product scale is Medium.
18. A-LAUNCH-18 Amplification and response are named: at least 5 named humans or named roles with specific asks sent more than 48 hours ahead, and the founder blocked as primary responder for the 8-hour window after each post.
    Look: the channels doc's amplification and response sections, runbook rows.
    Fail: no amplification list with broad channels in scope is Medium; a delegated-only response plan is Low.
19. A-LAUNCH-19 The runbook is real: D-7 to D+7 as a timezone-aware calendar, every row with a date, owner, and pass criterion, an hour-by-hour launch-day schedule, and a retrospective row with numeric targets set before launch.
    Look: `docs/launch/RUNBOOK.md`, `.launch-ready/launches/`.
    Fail: a set launch date with no runbook is Medium; rows without owners or pass criteria is Low; a retrospective without pre-set targets is Low.
20. A-LAUNCH-20 Sibling coupling holds: the status page is hosted off the app's infrastructure and linked from the footer, the launch date does not land atop an in-progress expand/contract migration, and at-risk SLOs get an SLO-watch runbook row. Migration mechanics and SLO definitions stay with deploy and observe; audit only the coupling and cross-reference F-DEPLOY and F-OBS ids per the ownership map.
    Look: footer links, status provider config and its hosting, the deploy migration schedule, SLO docs.
    Fail: a same-infra status page is High (discovered useless during the first outage, often launch day); a launch date mid-migration is High.
21. A-LAUNCH-21 The cold proof checkpoint exists: the runbook ends with the cold proof test naming all five observations (a stranger describes the product in under 15 seconds, the CTA reaches a working waitlist, confirmation arrives within 5 minutes, the OG preview renders correctly from any of the five channels, the visit lands in analytics under the right UTM source).
    Look: the runbook's final checkpoint row, launch log entries.
    Fail: no cold proof checkpoint on a full-launch (tier 4) plan is Medium; a checkpoint missing observations is Low.
22. A-LAUNCH-22 No fabricated or dead social surfaces: no invented testimonials, no logos of non-customers, no "as seen in" badges for outlets that never covered the product, no placeholder user counts, no lorem ipsum, no dead "Learn more" links.
    Look: social-proof markup, testimonial data files, anchor hrefs on the landing page, grep `lorem`.
    Fail: fabricated proof is High (trust and legal exposure on the most public surface); lorem ipsum or dead links on a shipped landing is Medium.
23. A-LAUNCH-23 (audit-only) Launch state matches reality: state and registry files agree with the repo and the calendar; a passed launch date with status still pre-launch, a UTM campaign slug reused across launches, or a completed launch with no retrospective are drift.
    Look: `.launch-ready/STATE.md` dates against today, utm-registry campaign values, `retrospectives/` against the launch log.
    Fail: reused campaign slugs polluting analytics history is Medium; stale state contradicting a completed launch is Low.

## Scoring

Weighted dimensions, summing to 100. When a conditional dimension is absent, drop it and re-normalize the remaining weights proportionally; never zero-and-keep.

- Positioning discipline (20): A-LAUNCH-1, 2, 3.
- Landing page and copy (20): A-LAUNCH-4, 5, 6, 7, 8, 22.
- SEO and OG cards (15): A-LAUNCH-9, 10, 11.
- Waitlist and email funnel (15, conditional: absent when signup is direct and no capture surface exists): A-LAUNCH-12, 13, 14.
- Channels and etiquette (10, conditional: absent in Mode E quiet-B2B launches): A-LAUNCH-15, 18.
- Telemetry and attribution (10): A-LAUNCH-16, 17.
- Runbook and sibling coupling (10): A-LAUNCH-19, 20, 21, 23.

Floor findings from the ancestor's have-nots list (leftover noindex on the shipped landing, fabricated social proof feeding a live funnel) are Critical or High regardless of arithmetic. Any active Critical finding, including an accepted risk, caps this domain at 69.

## Remediation seeds

At audit time the agent adds the `Fixes:` line with real finding ids; seeds omit it.

- [ ] GA-xxx Rewrite the hero and above-the-fold copy to pass the substitution and banned-word audits
  - Files: site/index.html, docs/launch/POSITIONING.md
  - Acceptance: the hero names the audience and the replacement specifically enough that two named competitor swaps make it false; zero banned-word hits above the fold; first person with a named founder; no AI self-reference unless the AI is the differentiator
  - Verify: `! grep -riE 'seamless|powerful|revolutionary|effortless|cutting-edge|game-changing|supercharge|streamline|empower|elevate|robust|best-in-class|world-class|enterprise-grade' site/index.html`
  - Checks: A-LAUNCH-1, A-LAUNCH-2, A-LAUNCH-6, A-LAUNCH-7
- [ ] GA-xxx Restructure the landing page to the five-section anatomy with one CTA
  - Files: site/index.html, site/styles.css
  - Acceptance: hero, social proof, feature grid, pricing if applicable, CTA in order; exactly one `<h1>`; one primary CTA above the 1366x768 fold; a grid of 3-6 tiles each traced to a shipped capability
  - Verify: `grep -c '<h1' site/index.html | grep -qx 1`
  - Checks: A-LAUNCH-4, A-LAUNCH-5
- [ ] GA-xxx Bring the landing head and OG card to launch-day spec
  - Files: site/index.html, public/og.png, public/robots.txt, public/sitemap.xml
  - Acceptance: title under 60 characters and description under 160; canonical, OG, Twitter, and JSON-LD tags present; no noindex anywhere in shipped HTML; og.png is 1200x630 under 300KB with the product name and value prop legible at half size
  - Verify: `! grep -ri 'noindex' site/ && identify -format '%wx%h' public/og.png | grep -qx '1200x630'`
  - Checks: A-LAUNCH-9, A-LAUNCH-10
- [ ] GA-xxx Convert the paper waitlist into a double opt-in funnel
  - Files: api/subscribe.ts, site/waitlist.html, docs/launch/emails/sequence.md
  - Acceptance: the confirmation email precedes list entry; the welcome email sends within 5 minutes of confirmation; the form has at most two fields plus consent; sequence.md enumerates pre-launch, launch-day, and D+1/D+3/D+7 emails each with a purpose line
  - Verify: `grep -q 'double opt-in' api/subscribe.ts && grep -c '^## Email' docs/launch/emails/sequence.md | grep -qE '^[6-9]$'`
  - Checks: A-LAUNCH-12, A-LAUNCH-13
- [ ] GA-xxx Authenticate the sending domain before any scheduled send
  - Files: docs/launch/dns-email-auth.md, infra/dns.tf
  - Acceptance: SPF, DKIM, and DMARC records present with values; a list-level unsubscribe in every template footer; a GDPR consent checkbox on the form when EU or UK users are in scope
  - Verify: `dig +short TXT _dmarc.example.com | grep -q 'v=DMARC1'`
  - Checks: A-LAUNCH-14
- [ ] GA-xxx Register UTM values and instrument the conversion waterfall
  - Files: docs/launch/utm-registry.md, site/analytics.js, tests/launch/waterfall.test.ts
  - Acceptance: every shared link in emails and post drafts carries registered `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` values; the five waterfall events fire and verify in a staging test
  - Verify: `npm test -- tests/launch/waterfall.test.ts`
  - Checks: A-LAUNCH-16, A-LAUNCH-17
- [ ] GA-xxx Move the status page out-of-band and finish the runbook
  - Files: docs/launch/RUNBOOK.md, site/index.html
  - Acceptance: the status page is hosted off the app's infrastructure and linked in the footer; every runbook row has a date, timezone, owner, and pass criterion; the five-channel OG preview row sits at or before D-1; the cold proof test is the final checkpoint
  - Verify: `grep -q 'cold proof' docs/launch/RUNBOOK.md && grep -c 'pass:' docs/launch/RUNBOOK.md | grep -qE '^[1-9]'`
  - Checks: A-LAUNCH-11, A-LAUNCH-19, A-LAUNCH-20, A-LAUNCH-21

## Anti-patterns hunted

- AI-slop landing: banned words above the fold, gradient hero, stock illustrations of abstract people pointing at charts. Hunt with the case-insensitive grep; three or more hits marks the surface as needing a rewrite, not a polish.
- Hero fatigue: a hero sentence that survives with a competitor's name swapped in. Run the swap against two named competitors before scoring positioning; plausibility under the swap is the finding.
- Spec-sheet positioning: category-label tiles (Fast, Secure, Scalable) or a grid over six. Count the tiles and read each one for a product-specific capability.
- Vapor landing: tiles promising features no route or module delivers. Diff the grid against the fingerprint's route inventory; a stubbed handler behind a tile cross-references F-BUILD per the ownership map.
- Paper waitlist: a capture form with no double opt-in, no welcome email, no sequence. Trace the subscribe handler end to end; a form that only inserts a row is the finding.
- Unrendered OG card: wrong dimensions, over 300KB, illegible at half size, or never previewed. Check the asset bytes, then hunt for preview evidence; LinkedIn's 7-day cache makes a wrong card wrong for the whole window.
- Silent launch: a shareable link without UTM params anywhere in the launch assets. Grep every email template and post draft for bare product URLs.
- Attribution blind: analytics installed but no conversion-waterfall events. An analytics snippet with zero custom event calls is the evidence.
- Channel etiquette violations: a Show HN title containing "launch" or all-caps, a PH slot on Friday through Sunday or without a confirmed hunter, a Reddit target with zero prior participation, a LinkedIn draft in press-release voice. Read the committed drafts, not the intent.
- Silent fade: no D+1 through D+7 follow-up and no retrospective after a completed launch. Check the launch log against the sequence docs and retrospectives dir.
- Same-infra status page: a status link resolving to the app's own domain and deployment. Resolve the footer link's host against the deploy config.
- Auditor discipline: no vague findings ("improve the landing" is banned); no double-billing (CWV code signals belong to seo, stubbed features to build, transactional email to product, SLO definitions to observe, per the ownership map); no severity inflation (one banned word is never Critical); calibration holds (a Mode E repo draws no channel findings, and a weekend project with no runbook gets a note, not a High).
