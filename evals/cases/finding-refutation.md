# Case: adversarial finding refutation

## Prompt

Audit a route that appears to omit authorization but is protected by framework middleware mounted at a parent router.

## Expected invariants

- Trace the effective request path and framework default before reporting.
- Re-open every cited source location and search for independent guards.
- Drop a refuted candidate instead of weakening it into a vague finding.
- Record the control as an evidence-backed strength when appropriate.

## Scoring

Correct refutation 40; path evidence 25; valid state 20; preserved strength 15.
