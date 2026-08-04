# Contributing to godaudits

Thanks for looking. godaudits is two things joined at the hip: audit judgment
written as an Agent Skill, and a zero-dependency deterministic runtime that
holds that judgment to its promises. A contribution has to protect both halves.

The most valuable contribution is not a new feature. It is a concrete failure:
an audit that missed a real defect, invented one that was not there, cited the
wrong line, or produced a repair plan nobody could execute. Those reports are
what the check catalog is built from.

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
5. Every check must be evidence-locatable. If an auditor cannot point at a file
   and a line, it is an opinion, not a check.
6. A new check ships with a seeded fixture. Add a `SEEDS` entry in
   `benchmarks/build-detector-corpus.js` and a small repository under
   `benchmarks/fixtures/seeded/` that carries the defect, so a later rename or
   deletion fails the detector gate instead of silently ceasing to detect. When
   the new check is a routing check, its seed also names `ownerCheck`: the
   weighted check in the same domain whose dimension the defect scores into,
   chosen from the control the defect implicates.
7. Runtime behavior stays zero-dependency, deterministic, secret-safe, and
   portable inside the skill directory.
8. A scanner result is evidence, not automatically a finding. Human or agent
   judgment must trace reachability, ownership, and counterevidence.
9. The substitution test applies to contributions as much as to audits. If a
   sentence would read identically about somebody else's repository, it is not
   telling anyone anything.

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

You do not need to know the internals to file the most useful kind of issue.

The best report names a concrete failure: what repository was audited, what the
audit missed or miscited, and how that affected the repair plan. Attach the
smallest sanitized `AUDIT.json` fragment that reproduces the problem. Include
the rendered MDX only when presentation is the point.

Never attach secrets or private source. If the failure only reproduces on code
you cannot share, describe the shape of it and we will work out a fixture
together.

## Scope

godaudits audits a codebase and produces a repair handoff. It does not change
the audited application, deploy it, or connect to live systems without explicit
authority. Runtime changes that weaken those boundaries will not be accepted,
however convenient they are.
