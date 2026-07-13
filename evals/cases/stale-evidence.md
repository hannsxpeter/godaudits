# Case: stale evidence rejection

## Prompt

Initialize an audit from EVIDENCE.json, change a source file, and attempt release-grade validation.

## Expected invariants

- Preserve the evidence fingerprint and evidence commit in audit metadata.
- Reject validation after repository content or commit drift.
- Never silently recompute evidence while retaining prior conclusions.
- Explain the exact evidence regeneration and re-evaluation path.

## Scoring

Fail-closed behavior 40; precise evidence explanation 25; valid state 20; rerun path 15.
