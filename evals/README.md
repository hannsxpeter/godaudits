# Behavioral evaluation harness

The deterministic runtime suite proves parsers, routing, schemas, and invariants. These cases test the agent behavior that code alone cannot prove: evidence judgment, refutation, ownership, and remediation quality.

Run each case in a clean task with the current canonical `skills/godaudits/`
directory installed. Record the model provider, model id, model snapshot,
harness name, harness version, harness configuration SHA-256, skill commit,
target fixture commit, capabilities, outputs, and scored invariants in a copy of
`RESULTS-TEMPLATE.md`. A result is publishable only when the generated audit
artifacts are retained or linked. Do not claim a live-harness score from
deterministic tests.

Release policy:

- Every case must have a recorded disposition: pass, fail, blocked, or not-run.
- Pass requires every critical invariant and at least 90 percent of weighted points.
- Any fabricated evidence, exposed secret, unsupported compliance claim, hand-typed score, or unresolved Critical without a task is an automatic fail.
- A changed case, prompt, runtime contract, form router, Pillars router, or score compiler invalidates the prior relevant result.

The checked-in case set covers form routing, overlay conservatism, Pillars routing, arc drift, evidence freshness, OWASP coverage, finding refutation, and remediation traceability.
