# godaudits code audit

Read-only audit completed 2026-07-13. This report is self-contained and records
the pre-remediation state of the 2.0 release candidate.

## Remediation outcome

All eight findings in this report were resolved before release. Verification
after remediation passed 30 Node tests, all four benchmark fixtures, copied
skill diagnostics, installer ownership safety cases, package dry run, catalog
and prompt freshness, schemas, version parity, ASCII policy, and shell syntax.

| Finding | Resolution |
|---|---|
| SEC-001 | Installer ownership marker and refusal tests added. |
| QUAL-001 | Accepted risks now retain severity factors, caps, and counters. |
| ERR-001 | Invalid re-audit transitions and removed history now exit nonzero. |
| QUAL-002 | Final gates require acceptance and reject mixed-purpose fields. |
| SEC-002 | Full SARIF text and commands are redacted before truncation. |
| DOC-001 | MDX now quotes YAML, lists assumptions, and expands all evidence. |
| TEST-001 | Duplicate expectations fail and clean controls use unique ids. |
| OBS-001 | Doctor discovers package-owned tests and ignores unrelated parents. |

Post-remediation assessment: **97/100 - Grade A (release-ready)**. The remaining
three points reflect limits that cannot be eliminated by local code alone:
model judgment still needs external benchmark runs, policy freshness depends on
authorized primary-source verification, and static evidence cannot prove
runtime behavior.

## Snapshot

- Project: godaudits, branch `codex/godaudits-2.0`.
- Languages: CommonJS JavaScript, POSIX shell, Bash, Markdown, JSON, and YAML.
- Size: approximately 40 authored implementation, test, script, schema, and
  package files, plus 18 domain modules and generated artifacts.
- Runtime: zero-dependency Node.js 18+ CLI inside the portable Agent Skill.
- Entry points: `bin/godaudits.js`,
  `skills/godaudits/runtime/godaudits.js`, and `install.sh`.
- Maturity: public 2.0 major-release candidate with security and reproducibility
  claims. The audit therefore uses a public-tool release bar.
- Coverage: exhaustive review of runtime modules, installer, generators,
  package metadata, CI, schemas, tests, and release documentation. Generated
  catalog check bodies and benchmark fixture prose were sampled because their
  generators and source modules are authoritative.
- Exclusions: no external network or live GitHub state was examined in this
  code review.

## Overall score

**84/100 - Grade B (solid, release gaps remain)**

The release candidate has unusually strong deterministic contracts, zero
runtime dependencies, broad tests, and clear trust boundaries. Two High issues
remain: the installer can remove an unowned destination, and accepted risks are
misrepresented by score and cap computation. Re-audit enforcement, evidence
rendering, SARIF redaction order, and evaluator edge cases should also be closed
before tagging 2.0.0.

Calibration: scored as a public audit and security tool, not as an internal
script. Default codeauditor dimension weights were retained.

| Dimension | Score | Grade | Weight | Specific verdict |
|---|---:|---|---:|---|
| Security | 74 | C | 20% | Strong secret handling is weakened by destructive installer replacement and truncation-before-redaction. |
| Architecture and Design | 86 | B | 15% | Clear module ownership and portable runtime boundaries, with a few cross-contract gaps. |
| Code Quality and Maintainability | 84 | B | 15% | Small cohesive modules, but accepted-risk state is not handled consistently across compiler consumers. |
| Testing and Verification | 88 | B | 15% | Good semantic tests and fixtures; evaluator multiplicity and install ownership need direct cases. |
| Error Handling and Resilience | 78 | C | 10% | Validation is extensive, but re-audit identity loss still exits successfully. |
| Performance and Efficiency | 92 | A | 8% | Bounded file reads and dependency-free operations fit the workload. |
| Dependencies and Supply Chain | 96 | A | 7% | Zero dependencies, pinned CI actions, generated freshness checks, and package dry runs. |
| Documentation and Drift | 82 | B | 5% | Docs are detailed, but the generated report does not yet expose every cited evidence record. |
| Observability and Operability | 86 | B | 5% | Doctor and CI are useful, though doctor can mis-detect which test suite exists. |
| Weighted overall | 84 | B | 100% | Strong foundation with two High and six Medium or Low release gaps. |

## What to fix first

1. `[SEC-001] Installer deletes destinations it cannot prove it owns` - High,
   M - installation and uninstallation can destroy a user's custom skill.
2. `[QUAL-001] Accepted risks disappear from caps and receive the wrong score`
   - High, S - risk acceptance can improve or distort the audit result.
3. `[ERR-001] Re-audit identity loss is reported but not enforced` - Medium, S
   - automation receives success after historical ids are removed.
4. `[DOC-001] Generated MDX omits the complete evidence ledger` - Medium, M -
   pass and not-applicable evidence cannot be checked from the report.
5. `[SEC-002] SARIF messages are truncated before secret masking` - Medium, S -
   a secret crossing the truncation boundary can be partially retained.

## Strengths (preserve these)

- Catalog compilation fails on missing Look or Fail guidance, unexpected
  routing checks, invalid risk profiles, and scoring parser drift
  (`skills/godaudits/runtime/lib/catalog.js:164`).
- Audit validation covers catalog completeness, typed evidence, reciprocal
  links, task ordering, cycles, risk expiry, compliance ownership, and stale
  derived state (`skills/godaudits/runtime/lib/audit.js:57`).
- Static fingerprinting is deterministic, excludes dependency and generated
  trees, bounds content reads at 1 MiB, hashes files, and masks credential-shaped
  values (`skills/godaudits/runtime/lib/evidence.js:7`).
- The release gate combines tests, corpus benchmarks, catalog freshness, schema
  parsing, prompt freshness, style, version parity, installer smoke, and package
  smoke (`scripts/lint.sh:1`, `.github/workflows/lint.yml:1`).
- The runtime is copied with the skill rather than depending on repository-only
  paths (`skills/godaudits/runtime/godaudits.js:17`).

## Systemic patterns (root causes)

### Boundary state is validated locally but not always across consumers

Members: QUAL-001, ERR-001, QUAL-002, TEST-001, OBS-001.

Root fix: define active-risk, final-gate, re-audit, benchmark-expectation, and
package-root invariants once, then make every compiler, exporter, evaluator,
and diagnostic consume those shared definitions.

### Claims outrun the final serialization boundary

Members: SEC-002 and DOC-001.

Root fix: apply secret safety and provenance completeness before truncation or
rendering, then test the actual serialized artifacts with adversarial values.

## Findings

### [SEC-001] Installer deletes destinations it cannot prove it owns

- Severity: High | Confidence: Confirmed | Effort: M | Dimension: Security
- Location: `install.sh:64`, `install.sh:68`, `install.sh:76`
- Evidence: `place` runs `rm -rf "$dest"` for install and uninstall whenever a
  directory or symlink exists. No marker, source check, or ownership record
  distinguishes an installer-managed copy from a user's custom
  `godaudits` skill. This contradicts the line 9 promise and SECURITY.md claim
  that only entries created by the installer are removed.
- Impact: installing an update or running uninstall can irreversibly delete
  user-authored files at a conventional skill destination.
- Recommendation: ship an installer ownership marker inside the canonical
  skill, refuse to replace or remove destinations without that marker, validate
  `--tools` values, and add smoke tests for protected unowned destinations.
- Verify the fix: create an unmarked destination with a sentinel file, run both
  install and uninstall, and assert nonzero exit plus an intact sentinel; repeat
  with a marked copy and assert successful replacement and removal.
- Related: boundary-state systemic pattern.

### [QUAL-001] Accepted risks disappear from caps and receive the wrong score

- Severity: High | Confidence: Confirmed | Effort: S | Dimension: Code Quality
  and Maintainability
- Location: `skills/godaudits/runtime/lib/audit.js:447`,
  `skills/godaudits/runtime/lib/audit.js:456`,
  `skills/godaudits/runtime/lib/audit.js:474`,
  `skills/godaudits/runtime/lib/audit.js:499`
- Evidence: failure severities, Critical caps, and severity counters filter only
  `status === 'open'`. Validation permits `accepted-risk` findings to remain
  attached to failed checks. With no open severity, the failed check falls back
  to factor 0, so an accepted Low risk scores like Critical while an accepted
  Critical risk avoids Critical caps and counters.
- Impact: accepting a risk can make the score less accurate in either direction
  and can hide a known Critical from the verdict and report counters.
- Recommendation: define active risk as open or accepted-risk and use it for
  failure factors, caps, and severity counts. Preserve accepted-risk status only
  as governance metadata and SARIF suppression.
- Verify the fix: add table-driven tests for accepted Low, High, and Critical
  findings, asserting severity factors, caps, and counts.
- Related: boundary-state systemic pattern.

### [ERR-001] Re-audit identity loss is reported but not enforced

- Severity: Medium | Confidence: Confirmed | Effort: S | Dimension: Error
  Handling and Resilience
- Location: `skills/godaudits/runtime/lib/diff.js:95`,
  `skills/godaudits/runtime/godaudits.js:161`
- Evidence: the diff includes removed finding and task ids, but the CLI always
  returns 0 after printing it. It also does not verify matching project names,
  a higher audit version, or `re-audit` mode.
- Impact: CI can treat a history-destroying or incorrectly paired re-audit as a
  successful gate.
- Recommendation: return explicit invariant violations from the diff and exit
  nonzero for removed historical ids, project mismatch, non-incremented audit
  version, or a current audit not in re-audit mode.
- Verify the fix: spawn the CLI against paired temporary audits for each invalid
  transition and assert exit 1; assert exit 0 for a valid transition.
- Related: boundary-state systemic pattern.

### [QUAL-002] Final-gate validation allows an empty or mixed-purpose gate

- Severity: Medium | Confidence: Confirmed | Effort: S | Dimension: Code Quality
  and Maintainability
- Location: `skills/godaudits/runtime/lib/audit.js:242`,
  `skills/godaudits/runtime/lib/audit.js:244`,
  `skills/godaudits/runtime/lib/audit.js:276`
- Evidence: the 2-to-4 acceptance rule applies only to non-final tasks. A final
  gate can therefore have no acceptance conditions. It can also carry files,
  finding fixes, and check ids even though the contract defines it as a pure
  re-audit gate.
- Impact: a structurally valid remediation plan can end in a non-verifiable task
  or use the final gate to bypass normal remediation-task constraints.
- Recommendation: require 1-to-4 final-gate acceptance conditions and require
  its `files`, `fixes`, and `checks` arrays to be empty.
- Verify the fix: add negative tests for empty acceptance and non-empty final
  gate files, fixes, and checks.
- Related: boundary-state systemic pattern.

### [SEC-002] SARIF messages are truncated before secret masking

- Severity: Medium | Confidence: Confirmed | Effort: S | Dimension: Security
- Location: `skills/godaudits/runtime/lib/sarif-import.js:26`
- Evidence: the importer slices the scanner message to 1,000 characters and
  then applies credential masking. A credential value beginning near the slice
  boundary can leave fewer than the detector's eight required characters and
  remain as a partial secret fragment.
- Impact: imported evidence can retain part of a credential despite the
  secret-safe import guarantee.
- Recommendation: redact the complete message first and truncate the redacted
  result. Prefer SARIF invocation `commandLine` as command provenance when
  available.
- Verify the fix: import a message whose credential begins at character 995 and
  assert that no value fragment appears in output.
- Related: serialization-boundary systemic pattern.

### [DOC-001] Generated MDX omits the complete evidence ledger

- Severity: Medium | Confidence: Confirmed | Effort: M | Dimension:
  Documentation and Drift
- Location: `skills/godaudits/runtime/lib/render.js:103`,
  `skills/godaudits/runtime/lib/render.js:110`,
  `skills/godaudits/runtime/lib/render.js:118`
- Evidence: the check ledger prints evidence ids only. Full evidence text is
  rendered for findings and strengths, but not for pass or not-applicable
  checks. Scope assumptions are also omitted, and the arbitrary archetype value
  is emitted into YAML without quoting at line 72.
- Impact: the supposedly standalone MDX cannot substantiate clean checks or
  exclusions, and an archetype containing YAML punctuation can invalidate the
  frontmatter.
- Recommendation: render a complete evidence ledger with type, location,
  provenance, quote, hash, and redaction state; render assumptions; quote the
  archetype using the existing YAML string helper.
- Verify the fix: render an audit with pass and absence evidence plus an
  archetype containing `:` and assert valid quoted frontmatter and full evidence
  rows.
- Related: serialization-boundary systemic pattern.

### [TEST-001] Evaluator can over-penalize clean controls and over-credit duplicates

- Severity: Medium | Confidence: Confirmed | Effort: S | Dimension: Testing and
  Verification
- Location: `skills/godaudits/runtime/lib/evaluate.js:20`,
  `skills/godaudits/runtime/lib/evaluate.js:39`,
  `skills/godaudits/runtime/lib/evaluate.js:46`
- Evidence: multiple expected rows can match the same finding, inflating recall.
  Conversely, two findings on one clean check produce two violations, allowing
  clean-control rate to go below zero instead of counting the unique violated
  control once.
- Impact: benchmark pass or failure can depend on duplicate manifest or finding
  rows rather than auditor quality.
- Recommendation: reject duplicate expected check-path pairs and compute clean
  violations as a set of violated clean check ids.
- Verify the fix: add one test for duplicate required expectations and one for
  two findings sharing one clean check; assert rejection and a bounded 0-to-1
  rate.
- Related: boundary-state systemic pattern.

### [OBS-001] Doctor can run a stale or unrelated hardcoded test set

- Severity: Low | Confidence: Confirmed | Effort: S | Dimension: Observability
  and Operability
- Location: `skills/godaudits/runtime/godaudits.js:182`,
  `skills/godaudits/runtime/godaudits.js:183`
- Evidence: doctor hardcodes six test filenames and marks tests available when
  any `test` directory exists two levels above the skill. A newly added test is
  omitted, while an unrelated parent `test` directory can trigger missing-file
  failures in a copied installation.
- Impact: installation diagnostics can report a false pass or false failure.
- Recommendation: recognize the package root by package name, discover all
  `*.test.js` files there, and report tests unavailable for standalone skill
  copies.
- Verify the fix: add a temporary extra test in a package-root smoke fixture and
  an unrelated parent test directory around a copied skill; assert correct
  discovery in both cases.
- Related: boundary-state systemic pattern.

## Dimension notes

### Security

Secret redaction and static-mode boundaries are strong, but SEC-001 and SEC-002
cross destructive and confidentiality boundaries, holding this dimension at
74.

### Architecture and Design

Runtime modules have clear responsibilities and the skill is self-contained.
The remaining problems are consumer consistency rather than structural
coupling, supporting 86.

### Code Quality and Maintainability

Small modules and deterministic data structures are good. QUAL-001 and
QUAL-002 show active-state concepts are still duplicated across code paths,
supporting 84.

### Testing and Verification

The 22 semantic tests and four-language corpus are substantial. TEST-001 and
the missing install-ownership cases keep the score at 88.

### Error Handling and Resilience

Most invalid audit states fail closed. ERR-001 lets the primary historical
integrity failure pass automation, limiting the score to 78.

### Performance and Efficiency

The runtime is bounded, synchronous, and appropriate for an offline CLI. No
confirmed hot-path defect was found, supporting 92.

### Dependencies and Supply Chain

The product has no runtime dependencies, checks generated artifacts, tests its
package, and pins major CI actions. This supports 96.

### Documentation and Drift

Release, engine, migration, evaluation, threat, and skill contracts are
specific. DOC-001 is a meaningful standalone-report mismatch, supporting 82.

### Observability and Operability

Doctor, CI, benchmarks, and explicit exit statuses provide useful diagnostics.
OBS-001 and ERR-001 leave some automation ambiguity, supporting 86.

## Remediation plan

### Quick wins

- QUAL-001
- ERR-001
- QUAL-002
- SEC-002
- TEST-001
- OBS-001

### Plan now

- SEC-001
- DOC-001

### Verify first

- None. Every finding is Confirmed from the cited code.

### Backlog

- None.

## Scope and limitations

The audit inspected the complete release implementation and its verification
surfaces. It did not run network operations, query GitHub, inspect unpublished
package registries, or benchmark model judgment. Performance conclusions are
based on bounded code paths rather than profiling. Generated prompt and catalog
content was checked through source generators, hashes, and representative
sampling rather than line-by-line duplication of canonical sources.

## How to use this report (for the acting agent)

1. Triage by severity and confidence. Confirmed Critical and High are safe to
   act on now, in the order in "What to fix first". Re-verify any Suspected
   finding against the cited code before changing anything.
2. Fix root causes first; prefer systemic patterns over individual leaves.
3. Preserve the strengths; do not refactor them away while fixing other issues.
4. Confirm the stated assumption on Likely findings before acting.
5. One finding, one change, verified: after each fix run its "Verify the fix"
   step; keep changes atomic and traceable to the finding ID.
6. Do not widen scope silently; note adjacent issues rather than sprawling into
   a rewrite.
7. Re-run the audit to measure progress; confirm findings are resolved, not
   relocated, and watch for regressions in the strengths.
