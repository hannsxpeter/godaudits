# Audit state and report contract

godaudits 2.1 separates machine state from presentation while keeping 2.0 audit documents valid:

- `.godaudits/AUDIT.json` is the canonical, schema-versioned source of truth.
- `.godaudits/AUDIT.mdx` is a generated standalone human and agent report.
- `.godaudits/AUDIT.sarif` is optional generated code-host integration output.
- `.godaudits/EVIDENCE.json` is the deterministic static fingerprint and signal
  inventory. Signals are leads, not findings.

Never hand-edit computed fields, MDX, or SARIF. Edit audit state, compile it,
validate it, and regenerate the views.

## Why JSON is canonical

The v1 MDX format mixed human prose, mutable state, counters, scores, evidence,
and task links in one document. Grep could check surface shape but could not
prove arithmetic, reciprocal links, task dependency acyclicity, catalog
coverage, evidence types, or pack freshness. JSON provides typed state. The
bundled runtime performs semantic validation and produces deterministic views.

The formal schema is `schemas/audit.schema.json`. Runtime validation is
stricter than JSON Schema where cross-record relationships or arithmetic are
involved.

## Initialization

After intake determines name, archetype, scale, and applicability, initialize
the state from the generated catalog:

```bash
godaudits init --name PROJECT --archetype ARCHETYPE --scale SCALE --profile PROFILE --applicable all --evidence .godaudits/EVIDENCE.json --output .godaudits/AUDIT.json
```

Focused audits pass a comma-separated domain list. The initializer writes all
18 applicability rows and every selected domain's complete check ledger. Every
check begins as `unknown`. That state is intentionally honest and scores zero
coverage until evaluated.

## Metadata contract

`audit` records:

- `name`, `audit_version`, `status`, `created`, `updated`, and `mode`.
- `plan_aware`, audited `commit`, `archetype`, `scale`, and `risk_profile`.
- Optional `project_form`, `secondary_forms`, and `domain_overlays` preserve the four-axis intake result while `archetype` remains the compatibility field.
- Optional `evidence_fingerprint_sha256` and `evidence_commit` bind the audit to the evidence snapshot. Release and re-audit gates require them.
- `engine_version` and `pack_version`.
- `capabilities`: static, plus explicitly authorized sandbox or connected
  evidence capabilities.
- `assumptions`: only facts the repository could not answer.

The compiler writes `computed`: coverage, domain scores, caps, overall score,
verdict, and counters. Computed state is derived and may always be rebuilt.

## Standards ledger

The optional `standards` array records framework, category, title, disposition, mapped checks, evidence, and finding ids. Version 2.1 initialization emits all ten OWASP Web Top 10:2025 categories. A category may be pass, fail, unknown, or not-applicable. Pass, fail, and not-applicable require evidence; fail also requires a finding. Standards checks do not add score. They expose coverage and route defects to the existing weighted owning checks.

## Evidence grammar

Evidence records have stable `E-n` ids and one of five types.

### Source evidence

Required: path, positive line, quote, file SHA-256, and `redacted`. Add a symbol
when available. The hash pins the quote to repository content and makes moved
or changed evidence detectable during re-audit.

### Absence evidence

Required: exact command or query, search scope, zero-hit result in `quote`, and
`redacted`. Absence evidence replaces fake file-line citations for missing CI,
missing tests, missing authorization layers, or missing documentation.

### Tool evidence

Required: tool name, tool version, exact command, normalized result, and
provenance. Import scanner output as evidence; do not copy a scanner conclusion
directly into a finding without tracing reachability and ownership.

Use `godaudits import-sarif scanner.sarif` to normalize SARIF 2.1.0 results.
Select a non-conflicting starting evidence id with `--start` before merging the
records into AUDIT.json. Imported messages pass through secret masking and
remain evidence leads, never automatic findings.

### Runtime evidence

Allowed only under an explicitly recorded sandbox or connected capability.
Required: environment, tool, version, command or manual path, result, timestamp
or immutable artifact id, and isolation constraints.

### Human evidence

Required: who supplied it, date, exact decision or answer, and whether it is an
assumption, authorization statement, accepted risk, or open-question decision.

### Secret-safe evidence

Never quote a credential value. Replace it with a masked marker containing a
short one-way fingerprint. Set `sensitive: true` and `redacted: true`. Runtime
validation blocks evidence explicitly marked sensitive but not redacted.

## Check ledger grammar

Every applicable catalog check has exactly one record:

```json
{
  "id": "A-SEC-3",
  "outcome": "fail",
  "confidence": "Certain",
  "weight": 6,
  "evidence": ["E-12", "E-13"],
  "finding_ids": ["F-SEC-1"]
}
```

Rules:

- `pass`: evidence proves the control or property holds.
- `fail`: evidence proves a defect and at least one finding records it.
- `unknown`: evidence is insufficient. Unknown never earns points and reduces
  coverage.
- `not-applicable`: the check's conditional surface is absent and evidence
  proves the absence.
- Confidence is Certain, Firm, or Tentative.
- Weight comes from `catalog/checks.json` and cannot be edited. Conditional
  checks drop out through `not-applicable`; remaining weights normalize during
  computation.
- Routing checks have zero direct weight. A routing failure must map its
  finding to the weighted owning check affected by the defect.
- A pass cannot reference findings. An open finding cannot reference a passing
  check.

## Finding grammar

Findings keep stable ids forever:

```json
{
  "id": "F-SEC-1",
  "domain": "security",
  "title": "Board lookup omits the tenant predicate",
  "severity": "Critical",
  "confidence": "Certain",
  "effort": "S",
  "evidence": ["E-12", "E-13"],
  "impact": "An authenticated user can read another tenant board by id.",
  "fix": "Add the tenant predicate inside the board query.",
  "verify": "node --test test/security.test.js",
  "checks": ["A-SEC-3"],
  "status": "open",
  "remediation": ["GA-101"]
}
```

Rules:

- Ids are `F-<DOM>-n`, sequential inside the domain and never reused.
- Severity is Critical, High, Medium, or Low.
- Confidence is Certain, Firm, or Tentative.
- Effort is S, M, or L.
- Evidence must be sufficient to confirm the claim without relying on chat.
- Impact names a user, operator, security, reliability, or business failure.
- Fix names a concrete safe pattern and real locations.
- Verify is one exact command or manual path.
- Checks include every failed check this root cause affects. Routing checks also
  include the weighted owner.
- Status is open, resolved, accepted-risk, or superseded.
- Finding and task remediation links are reciprocal.

## Strength grammar

A strength carries title, evidence ids, and a `preserve` sentence telling the
remediating agent what must not regress. Strengths use the same evidence bar as
findings. Flattery is invalid.

## Remediation task grammar

```json
{
  "id": "GA-101",
  "phase": 1,
  "wave": "1.1",
  "title": "Scope board lookups to the tenant",
  "parallel": false,
  "files": ["src/boards.js", "test/security.test.js"],
  "depends_on": [],
  "reuses": "central authorization middleware",
  "fixes": ["F-SEC-1"],
  "acceptance": [
    "Every board query contains a tenant predicate.",
    "A cross-tenant lookup returns 404."
  ],
  "verify": "node --test test/security.test.js",
  "checks": ["A-SEC-3"],
  "status": "open"
}
```

Rules:

- Ids are stable `GA-nnn` values.
- Parallel tasks must have disjoint files and no hidden shared state.
- Dependencies must exist, point backward in phase order, and form a DAG.
- Every non-final task fixes at least one finding.
- Critical and High findings have at least one task.
- Acceptance has 2 to 4 observable conditions.
- Finding-task links are reciprocal.
- The one active final re-audit task depends on every active non-final task.

## Accepted risks and open questions

An accepted risk requires finding id, summary, named owner, acceptance date,
expiry date, and review command. The linked finding status is `accepted-risk`.
No permanent ownerless waivers.

An open question requires question, owner, due date, and recommended default.
Questions that block applicability or severity remain visible and prevent a
false full-coverage claim.

## Deterministic scoring

The catalog compiler translates each module's scoring dimensions into per-check
weights. The audit compiler calculates scores from outcomes:

- Pass earns the check weight.
- Failed Low earns 75 percent of the check weight.
- Failed Medium earns 50 percent.
- Failed High earns 25 percent.
- Failed Critical earns zero.
- Unknown earns no points and is excluded from the quality denominator while
  reducing coverage.
- Not-applicable drops the check and its weight.

The domain score is the normalized weighted result. Overall is the intake
weighted mean of applicable domains. Then apply caps:

- Active Critical, including accepted risk: owning domain at 69, overall at 79.
- Any domain below 50: overall at 84.
- Coverage 80 to 94: overall at 89.
- Coverage 60 to 79: overall at 79.
- Coverage below 60: overall at 69.

Verdict bands remain: 90-100 audit-proof, 80-89 solid, 70-79 needs work,
50-69 at risk, 0-49 critical condition. A score without coverage is invalid.

## Compile, validate, and render

```bash
godaudits validate .godaudits/AUDIT.json --repo . --require-fresh-evidence --write
godaudits render .godaudits/AUDIT.json --output .godaudits/AUDIT.mdx
godaudits sarif .godaudits/AUDIT.json --output .godaudits/AUDIT.sarif
```

Validation checks structure plus cross-record semantics: catalog completeness,
pack version, ids, evidence, weights, check outcomes, finding closure,
reciprocal links, dependency cycles, final-gate closure, accepted-risk expiry
shape, compliance ownership, parallel file isolation, session-log size, scores,
counters, standards coverage, evidence freshness, and secret redaction. `not-applicable` requires absence evidence.
Certain Critical and High findings require two independent evidence paths, and so
does a Certain pass on a weighted check: certainty costs corroboration whether the
claim raises an alarm or clears a check. Two quotes from the same file are one
method, not two.

The renderer produces GFM-safe MDX: no JSX, ESM, bare MDX expressions, non-ASCII
punctuation, or unescaped evidence. It expands every evidence record so pass and
not-applicable support can be checked from the standalone report. SARIF 2.1.0
carries check ids, severity, finding metadata, and source locations for
code-host annotations.

## Rules for remediating agents

The generated report contains a compact form of these rules:

1. AUDIT.json is the source of truth; chat and generated views are not.
2. Work in phase and wave order. Respect dependencies.
3. Run Verify before setting a task done or finding resolved.
4. Change reciprocal task, finding, check, counters, and updated date through
   the compiler in one state transition.
5. Failed verification leaves the task open and adds a dated session note.
6. Never renumber or delete historical findings or completed tasks.
7. Patch the audit first when the true fix differs materially from the task.
8. Regenerate MDX and SARIF after state changes.
9. Finish with the final re-audit gate and record the score plus coverage delta.

## Size and archive discipline

AUDIT.json may retain history but the live MDX view stays concise: verdict under
120 words, at most 12 root-cause findings per domain, at most 12 tasks per phase,
under 10 active risks or questions, and session summaries under 140 characters.
Archive prior JSON and MDX together under `.godaudits/archive/` before pruning a
large live view. Never delete ids from machine history.

## Re-audit protocol

1. Copy the prior compiled JSON and MDX into the archive.
2. Re-run static evidence at the new commit.
3. Re-evaluate every open finding and every check affected by the diff and its
   reverse-dependency blast radius.
4. Preserve ids. Resolve with new evidence; never erase history.
5. Continue finding and task sequences for new work.
6. Compile and validate both versions.
7. Run `godaudits diff previous.json current.json` and include added, resolved,
   reopened, changed, removed-id defects, and score delta in the report.
8. Bump `audit_version`, update the date, and append the session log.

A removed historical finding or task id is a re-audit defect and makes the diff
command exit nonzero. A moved source location updates through new hashed
evidence without changing the finding id.
