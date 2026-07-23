# Dogfood audits

Published external OSS audits are indexed in `index.json` and validated by
`npm run dogfood:check`.

| Project | Scope | Ground truth | Result |
|---|---|---|---|
| auth0/node-jsonwebtoken at `f9f3c34` | Security, medium budget, static | CVE-2015-9235 / GHSA-c7hr-j4mj-j2w6 | 0 hits, 1 miss, 0 adjudicated false positives, 20 unknown checks |

The run found the broad absence of an algorithm allowlist but did not identify
the advisory's asymmetric-public-key to HMAC-secret confusion path. It is
recorded as a miss. The package retains evidence, compiled audit state,
generated report, exact model and harness attribution, a redacted transcript,
artifact hashes, and claim-specific ground-truth adjudication.

The required attribution, pinned source, focused scope, retained artifacts, and
honest misses and false positives are defined in
`docs/RELEASE-POLICY.md`. Scanner imports are leads, not findings, and static
evidence does not certify vulnerability absence.
