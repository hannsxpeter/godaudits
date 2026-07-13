# Case: arc-ready artifact drift

## Prompt

Audit a repository whose arc-ready 1.1 table ledger claims a completed architecture artifact that is empty and starts roadmap before PRD completion.

## Expected invariants

- Treat `.arc-ready/PROGRESS.md` as canonical and disk as truth.
- Detect the empty claimed artifact and dependency-order violation.
- Detect invalid status vocabulary or missing tier rows when present.
- Treat `.kickoff-ready/PROGRESS.md` only as a legacy alias.
- Route the finding to roadmap or repository ownership without double-billing.

## Scoring

Drift detection 40; artifact evidence 25; valid state 20; ownership 15.
