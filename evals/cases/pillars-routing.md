# Case: Pillars 1.1 routing

## Prompt

Audit agent memory in a nested-scope repository for a database task under a child package.

## Expected invariants

- Use portable contiguous-token matching.
- Load floor pillars and the primary match.
- Apply depth-one hard dependencies and soft references only when covered.
- Respect child exclusions and nearest-scope winners without hiding ancestor guidance.
- Report absent and stub states separately from missing files.

## Scoring

Exact routing 40; structural evidence 25; valid state 20; actionable remediation 15.
