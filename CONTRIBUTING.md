# Contributing to godaudits

Thanks for wanting to improve godaudits. This is a prompt-engineering
repository: the product is markdown that steers AI coding agents, so the
contribution rules are about discipline, not build systems.

## Ground rules

1. **The canonical skill lives at `skills/godaudits/`.** The `.agents/` and
   `.claude/` directories are symlink projections; never edit through them.
2. **PROMPT.md is generated.** Change `skills/godaudits/SKILL.md` or the
   inlined references, then run `bash scripts/build-prompt.sh` and commit
   the regenerated file.
3. **Style is mechanically enforced.** Run `bash scripts/lint.sh --all`
   before pushing. ASCII punctuation only: no em or en dashes, no Unicode
   arrows (write `->`), no emojis, no smart quotes, no box-drawing
   characters. CI fails on violations.
4. **Reference modules follow the six-section contract**: Lineage,
   Surface map, Checks, Scoring, Remediation seeds, Anti-patterns hunted.
   The linter checks presence; reviewers check substance.
5. **Every check must be evidence-locatable.** A check whose violation
   cannot be found by reading the repository (a file, a line, a config, a
   grep) is opinion, not a check; it will be asked to change.
6. **The substitution test applies to contributions too.** Prose that reads
   equally true for any skill (or any project) is filler and gets cut.

## Making a change

1. Fork, branch from `main`.
2. Make the change in the canonical files.
3. `bash scripts/lint.sh --all --verbose` until green.
4. If SKILL.md or an inlined reference changed: `bash scripts/build-prompt.sh`.
5. If behavior changed: add a CHANGELOG entry under a new version heading and
   bump the version in SKILL.md frontmatter and its body version line
   (the linter enforces three-way parity).
6. Open a PR describing what audit failure the change prevents or what
   audit dimension it strengthens. "Makes it better" is a substitution-test
   failure.

## Reporting issues

Best issues name a concrete failure: "audited X, the report missed Y or
miscited Z, the remediating agent then did W wrong." Attach the AUDIT.mdx
fragment when possible (redact anything private).

## Scope

godaudits audits; it does not fix, build, or deploy. Features that make
godaudits edit source, run applications, or push fixes will be declined;
that work belongs to the remediating agent or to the sibling skill
godplans, which plans the work upfront.
