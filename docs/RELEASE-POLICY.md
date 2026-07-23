# Release and dogfood policy

Stable version numbers are credibility claims, not a count of merged changes.
Ordinary fixes and features accumulate on main without a version bump. A stable
release is cut no more than once in a 30-day window unless one of these
exceptions applies:

- A security fix protects users or audit evidence.
- A broken install, invalid artifact, or incompatible upstream change blocks
  normal use.
- A material accuracy result or correction changes the public evidence record.

Release candidates may be tested without changing the stable version. The
release owner batches compatible work, writes one changelog entry at release
time, runs `npm run check`, runs the pinned release validators, and publishes
the same checked artifact. Cosmetic volume is not a reason to increment a
version.

## Dogfood publication

`dogfood/index.json` is the only index of published dogfood audits. An entry is
eligible only when all of these are retained in-repo:

- A recognizable public repository URL, immutable commit, license, and audit
  date.
- Exact focused domains and budget. Focused results never read as full-project
  assurance.
- Model provider, model id, model snapshot, harness name, harness version, and
  harness configuration hash.
- EVIDENCE.json, compiled AUDIT.json, generated AUDIT.mdx, and optional SARIF.
- A run manifest, redacted transcript, artifact hashes, and the disclosure
  ground truth used for retrospective adjudication.
- Misses, false positives, open unknowns, and specialist escalation leads.
- A statement that scanner imports are leads and that static evidence does not
  certify vulnerability absence.

The first eligible artifacts should favor security and build completeness, the
two deep-capable domains. Public projects with a documented CVE or postmortem
are stronger retrospective cases when the public record identifies the affected
revision and code-level defect. The disclosure record stays outside the
repository shown to the auditor until the blind run is complete.

Adjudication is claim-specific. A broad missing-control finding is not upgraded
to a hit after disclosure unless it identifies the documented exploit path.
Source-supported findings outside a narrow retrospective ground truth remain
visible and are labeled outside-ground-truth rather than forced into hit or
false-positive buckets.

An empty dogfood index means no qualifying external artifact has been published.
It must never be summarized as a clean record.
