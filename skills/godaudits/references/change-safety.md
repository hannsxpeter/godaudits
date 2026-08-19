# Change safety and blast-radius review

Change safety is a separate artifact lifecycle for one diff. It answers a
different question from AUDIT.json. AUDIT.json records the health of a
repository at a commit. CHANGE-REVIEW.json records what one change could break,
which facts its safety depends on, and how far those facts were actually
proved.

The workflow adapts the proof-first method from the MIT-licensed pstack
`blast-radius` Agent Skill. The complete license and attribution live in the
repository NOTICE.

## Boundary

Planning is static. `blast-radius plan` reads Git commits, names, patches, and
tracked-file references. It never runs application code, tests, migrations,
live systems, network requests, or models. Its impact records are leads, not
confirmed risks.

Proof at level 4 or 5 is imported only after an explicitly authorized external
harness runs in a sandbox or connected read-only environment. `blast-radius
apply` imports and redacts those results. It never executes their commands.

The canonical artifact is `.godaudits/CHANGE-REVIEW.json`, validated by
`schemas/change-review.schema.json`. A proof producer returns the separate
`change-review-results.schema.json` shape. `CHANGE-REVIEW.mdx` is generated and
may be discarded.

## Safety facts

Every review begins with one or two load-bearing safety facts. A safety fact is
the smallest repository-specific claim which, if true, clears a large part of
the suspected blast radius. It names the changed mechanism and the property
that must continue to hold.

Good:

```text
Cache keys remain tenant-scoped after the cache helper signature changes.
```

Bad:

```text
The change is safe and should not cause regressions.
```

The bad version fails the substitution test and cannot produce a focused
proof. The planner requires one or two `--fact` values and refuses an empty or
larger set.

## Proof ladder

Each fact records the proof level supporting its current disposition and where
proof stopped. Confidence and proof level are not interchangeable. Confidence
is an auditor's calibrated judgment. Proof level names the method used to test
the claim.

| Level | Kind | Required evidence | Merge effect |
|---:|---|---|---|
| 1 | assertion | the claim only | unproven |
| 2 | citation | path, line, quote, and SHA-256 | unproven |
| 3 | failure-path | citation plus a step-by-step unreachable bad case | unproven |
| 4 | executable | tool, version, exact command, result, environment, isolation, and authority | eligible to pass |
| 5 | running-app | the same provenance against an authorized running application | eligible to pass |

A fact below level 4 remains visibly unproven even when the source reading is
convincing. Level 4 normally uses a small test or script which imports the same
library and calls the same function the shipped application uses. Level 5 is
reserved for behavior reproduced through the actual running surface.

Executable and running-app proof requires a results-level authorization block:

```json
{
  "capability": "sandbox",
  "authorized_by": "repository owner",
  "environment": "disposable local fixture",
  "isolation": "outbound network disabled and no production credentials"
}
```

## Planning a review

Read the diff and write the safety facts before invoking the deterministic
planner:

```bash
godaudits blast-radius plan . \
  --base BASE_REV \
  --head HEAD_REV \
  --fact "Cache keys remain tenant-scoped after the helper signature changes." \
  --fact "Existing API consumers can still parse every response." \
  --verify "node --test test/change-contract.test.js" \
  --audit .godaudits/AUDIT.json \
  --output .godaudits/CHANGE-REVIEW.json
```

The optional audit joins open findings and accepted risks whose evidence paths
changed. Planning resolves both revisions to immutable commit ids and records a
SHA-256 of the complete patch.

The runtime inventories direct reverse references, then deliberately looks
where symbol search stops:

- Public API, OpenAPI, GraphQL, protobuf, and message contracts.
- Database migrations, schemas, backfills, rollback, and older application
  revisions that may overlap a rollout.
- Manifest, lockfile, and local patch changes whose pinned library behavior can
  change below an unchanged caller.
- Configuration and feature flags selected through string keys.
- JSON and other serialized or wire formats consumed without an import.
- Cross-language readers of a shared contract or the same bytes.
- Queues, microtasks, teardown, cleanup, retries, and lifecycle transitions
  whose execution order matters.
- Cache key, invalidation, TTL, and rolling-version behavior.
- Generated artifacts and their source generators.
- Public routes, exports, tools, and non-primary caller paths.

Each lead names its basis, source paths, downstream paths, symbols, owning
domains, and existing A-checks. A lead never becomes a risk without source
tracing and refutation.

## Applying proof

A proof producer writes a results file. Its `review` block repeats the base,
head, and patch SHA-256 from CHANGE-REVIEW.json so proof from another diff is
rejected. The runtime applies it without running the commands:

```bash
godaudits blast-radius apply \
  .godaudits/CHANGE-REVIEW.json \
  .godaudits/CHANGE-RESULTS.json \
  --output .godaudits/CHANGE-REVIEW.json
```

Each safety-fact result is `proven`, `refuted`, or `unproven` and carries one
proof record. A level 2 or 3 proof carries hashed source. A level 4 or 5 proof
carries exact execution provenance. Commands, results, quotes, environments,
and isolation notes pass through the same credential redactor used by audit
evidence. Executable proof must also name the same environment and isolation
boundary as its authorization block.

Confirmed risks record separate axes:

- `likelihood`: rare, unlikely, possible, likely, or almost-certain.
- `consequence`: Low, Medium, High, or Critical.
- `mechanism`: the repository-specific path by which the change breaks.
- `verify`: the cheapest exact check which confirms or closes the risk.

Cleared risks remain in the artifact. Each names what was checked, why it is
safe, the proof level, and the change that would invalidate the clearance. This
prevents later reviewers from repeating the same search or treating a stale
clearance as permanent.

## Before-merge gate

The planner requires the cheapest test or reproduction which would fail loudly
if the change is unsafe. The applied result marks it passed, failed, or
unproven.

The merge disposition is compiled:

- `blocked`: a safety fact was refuted, the before-merge reproduction failed,
  or an open High or Critical consequence risk remains.
- `unproven`: any safety fact is below proof level 4 or the before-merge
  reproduction has not passed with level 4 or 5 evidence.
- `pass`: every fact and the before-merge reproduction reached level 4 or 5,
  and no open High or Critical consequence risk remains.

Validate and render after every application:

```bash
godaudits blast-radius validate .godaudits/CHANGE-REVIEW.json
godaudits blast-radius render .godaudits/CHANGE-REVIEW.json \
  --output .godaudits/CHANGE-REVIEW.mdx
```

## Audit integration

Change review does not compute repository scores and does not alter AUDIT.json.
Its confirmed risks can become audit candidates only through the normal owning
domain, evidence, refutation, and check-ledger method. Its proof records can be
imported as tool or runtime evidence when their provenance meets the audit
contract.

During re-audit, use a change review to select the checks affected by the diff
and its non-symbol blast radius. Do not treat a passing change review as a
passing repository audit, or a clean repository audit as proof that a new diff
is safe.

Export proof into the audit evidence grammar when the re-audit needs it:

```bash
godaudits blast-radius evidence .godaudits/CHANGE-REVIEW.json \
  --start 1000 \
  --output .godaudits/CHANGE-EVIDENCE.json
```

Level 2 and 3 records become hashed source evidence. Level 4 and 5 records
become runtime evidence with tool, version, command, and result. The export
creates no findings and changes no check outcome or score. The owning domain
must still trace the relevant path, search counterevidence, and merge the lead
under the existing A-check.

The workflow refuses:

- A safety fact invented by the deterministic runtime.
- More than two safety facts or a generic substitution-test failure.
- A merge pass based only on citations or source-path reasoning.
- Executable evidence without recorded authority and isolation.
- Proof results whose base, head, or patch hash differs from the review.
- Impact leads promoted automatically into findings or risks.
- A cleared risk without proof and an invalidation condition.
- A High or Critical consequence risk hidden by a high-confidence narrative.
