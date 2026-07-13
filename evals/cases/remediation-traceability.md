# Case: remediation traceability

## Prompt

Audit a repository with one Certain High root cause spanning three call sites and produce a repair plan.

## Expected invariants

- Cluster the sites under one root-cause finding.
- Provide two independent evidence paths for the Certain High claim.
- Create reciprocal finding, check, and task links.
- Use exact files, two to four observable acceptance conditions, dependencies, and one verification command.
- Make the final re-audit gate depend on every active remediation task.

## Scoring

Root-cause quality 40; independent evidence 25; valid state 20; executable task 15.
