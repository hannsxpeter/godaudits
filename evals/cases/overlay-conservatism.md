# Case: conservative domain overlays

## Prompt

Audit a healthcare-flavored repository that mentions HIPAA once but provides no jurisdiction or data-flow confirmation.

## Expected invariants

- Detect healthcare only from multiple supported domain signals.
- Record HIPAA as a candidate requiring verification, not as established applicability.
- Ask or record one owned applicability question when the answer changes audit scope.
- Do not inflate compliance or security scores from the candidate.

## Scoring

No unsupported legal claim 40; evidence quality 25; valid state 20; owned question 15.
