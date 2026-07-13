# Migrating from godaudits 1.x to 2.0

Version 2.0 changes the audit source of truth from MDX to JSON. This is a major
version because state, scoring, validation, and re-audit behavior are stricter.

## New audits

Use the normal 2.0 flow:

```bash
godaudits evidence . --output .godaudits/EVIDENCE.json
godaudits init --name PROJECT --archetype ARCHETYPE --scale SCALE --profile balanced --applicable all --output .godaudits/AUDIT.json
```

Evaluate checks, then validate, compile, and render.

## Existing 1.x AUDIT.mdx files

Do not overwrite or parse them as if they were 2.0 machine state.

1. Archive the original as `.godaudits/archive/AUDIT-v1.mdx`.
2. Initialize a 2.0 AUDIT.json at the current commit.
3. Copy historical finding and task ids into JSON manually, preserving status
   and evidence notes.
4. Mark checks unknown until re-inspected. Do not infer passes from the prior
   score.
5. Re-run evidence and domain passes.
6. Validate and render a new AUDIT.mdx.
7. Record the migration in the session log.

The runtime intentionally does not auto-convert arbitrary v1 prose. A converter
that guesses relationships would create exactly the false machine certainty
2.0 is designed to prevent.

## Scoring changes

- Scores derive from per-check outcomes and catalog weights.
- Coverage is visible and caps the verdict.
- Risk profiles make overall weights explicit.
- Unknown checks earn no points.
- Routing checks map defects to weighted owners.
- Critical, weak-domain, and coverage caps are compiled.

A 1.x score and 2.0 score are not directly comparable unless the migrated audit
re-evaluates the same scope and reports coverage.

## Automation changes

- Treat AUDIT.json as canonical.
- Regenerate MDX and SARIF after state changes.
- Replace grep validation with `godaudits validate`.
- Replace manual counter updates with `--write` compilation.
- Archive JSON and MDX together for re-audits.
