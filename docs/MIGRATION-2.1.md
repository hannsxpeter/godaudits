# Migrating from godaudits 2.0 to 2.1

Version 2.1 is backward compatible with canonical AUDIT.json schema 2.0. Existing
2.0 audit files continue to validate when their pack and engine versions match
the catalog used for validation. New fields are optional for old files and are
emitted by the 2.1 initializer.

## Regenerate evidence

EVIDENCE.json moves from schema 1.0 to 1.1 and now includes project context,
arc-ready artifacts, and Pillars state. Regenerate it instead of copying a 2.0
fingerprint:

```bash
godaudits evidence . --output .godaudits/EVIDENCE.json
```

The compatibility `archetype` remains. New routing uses one primary
`project_form`, optional `secondary_forms`, and structured `domain_overlays`.
Regulatory overlays are candidates requiring verification.

## Reinitialize or add metadata

For a new audit, let evidence supply the compatibility archetype and new context:

```bash
godaudits init --name PROJECT --scale SCALE --profile PROFILE --applicable all --evidence .godaudits/EVIDENCE.json --output .godaudits/AUDIT.json
```

For an active 2.0 audit, preserve all ids and history. Add the evidence
fingerprint, evidence commit, context fields, and standards ledger from a newly
initialized temporary file, then re-evaluate affected applicability and checks.
Do not replace the existing audit or reset finding sequences.

## Standards coverage

New audits contain ten `owasp-web-2025` category records. `unknown` may begin
without evidence; pass, fail, and not-applicable require evidence, and fail
requires a finding. Standards records route to existing checks and do not add
score weight. A-SEC-28 is a zero-weight completeness router.

## Freshness gate

Release and re-audit validation should use:

```bash
godaudits validate .godaudits/AUDIT.json --repo . --require-fresh-evidence --write
```

Any repository content or commit drift requires evidence regeneration and
re-evaluation. The validator never refreshes evidence conclusions silently.

## Pillars and arc-ready

Use `godaudits pillars` to inspect the effective Pillars 1.1 load for a task and
target. The evidence collector also inventories Pillars automatically when a
scope exists.

`.arc-ready/PROGRESS.md` is the canonical arc ledger. The 2.1 parser supports
the current table schema and the older bullet form. `.kickoff-ready/PROGRESS.md`
is a legacy alias. Disk wins over ledger claims. Public activation evidence
must remain bound to current hardening content through either its SHA-256 or a
Git revision containing the same artifact. Clean tracked artifact freshness
uses Git history; modified, untracked, and non-Git files use an explicit mtime
fallback. An unresolvable revision invalidates the prepublication record.

## Release verification

Install the pinned official validator in an isolated environment, then run:

```bash
python3 -m venv .venv-skills-ref
.venv-skills-ref/bin/pip install -r requirements/skills-ref.txt -r requirements/schema-validator.txt
SKILLS_REF_BIN="$PWD/.venv-skills-ref/bin/skills-ref" npm run release:check
```

The gate includes tests, benchmarks, deterministic evaluations, generated-file
freshness, schemas, version parity, ASCII style, action pins, the official
Agent Skills validator, JSON Schema 2020-12 validation of emitted evidence,
package inspection, and doctor diagnostics.
