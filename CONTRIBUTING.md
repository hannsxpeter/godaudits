# Contributing to godaudits

godaudits combines audit judgment in an Agent Skill with a zero-dependency
deterministic runtime. Contributions must protect both halves of that contract.

## Ground rules

1. The canonical skill lives at `skills/godaudits/`. Do not edit through an
   installed projection.
2. Generated files are not hand-edited. Run `npm run catalog` for
   `skills/godaudits/catalog/checks.json` and `npm run build:prompt` for
   `PROMPT.md` and `PROMPT.full.md`.
3. ASCII style is mechanically enforced. Do not add em dashes, en dashes,
   Unicode arrows, emojis, smart quotes, or box-drawing characters.
4. Domain modules follow the six-section contract: Lineage, Surface map,
   Checks, Scoring, Remediation seeds, and Anti-patterns hunted.
5. Every check must be evidence-locatable. An unobservable opinion is not a
   check.
6. Runtime behavior stays zero-dependency, deterministic, secret-safe, and
   portable inside the skill directory.
7. A scanner result is evidence, not automatically a finding. Human or agent
   judgment must trace reachability, ownership, and counterevidence.
8. The substitution test applies to contributions. Generic advice that fits
   any repository does not belong in the product.

## Making a change

1. Branch from `main`.
2. Change canonical source files.
3. Add or update Node test fixtures for behavior changes.
4. Add or update a deterministic evaluation and behavioral case when routing,
   artifact truth, standards, freshness, or remediation behavior changes.
5. Regenerate the catalog and prompts when their sources change.
6. Accumulate ordinary changes without a version bump. Follow
   `docs/RELEASE-POLICY.md`; add one CHANGELOG entry and update version surfaces
   only when cutting the batched stable release.
7. Run `npm run check` until it passes.
8. Install both pinned validator requirement files, then run
   `npm run release:check` before a release.
9. Open a pull request explaining the missed defect, false positive, unsafe
   behavior, or workflow gap the change prevents.

Useful focused commands:

```sh
npm test
npm run benchmark
npm run eval:suites
npm run catalog:check
npm run prompt:check
npm run lint
npm run release:check
```

## Reporting audit quality issues

The best report names a concrete failure: what repository was audited, what
the audit missed or miscited, and how that affected remediation. Attach the
smallest sanitized `AUDIT.json` fragment that reproduces the problem. Include
the rendered MDX only when presentation is relevant. Never attach secrets or
private source.

## Scope

godaudits audits and creates a remediation handoff. It does not change the
audited application, deploy it, or connect to live systems without explicit
authority. Runtime changes that weaken those boundaries will not be accepted.
