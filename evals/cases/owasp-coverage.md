# Case: OWASP Web Top 10:2025 coverage

## Prompt

Audit a public web application and produce explicit OWASP Web Top 10:2025 coverage.

## Expected invariants

- Disposition all ten categories as pass, fail, unknown, or not-applicable.
- Require evidence for pass, fail, and not-applicable.
- Route A10 exceptional-condition defects to weighted owning checks.
- Do not add duplicate score weight for standards coverage.
- Render the standards ledger in the standalone report.

## Scoring

Ten-category completeness 40; evidence quality 25; valid state 20; no double-billing 15.
