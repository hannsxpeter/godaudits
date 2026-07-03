# AUDIT.mdx format contract

The single output of godaudits is `.godaudits/AUDIT.mdx`. This module is the binding contract for that file: structure, finding grammar, remediation task grammar, scoring bands, MDX safety, and the executor rules embedded in every audit. Read this whole file before assembling an audit; do not author the audit from memory of it.

## Why MDX, and the GFM-safe rule

The audit ships as `.mdx` so it drops straight into MDX pipelines (Docusaurus, Nextra, Fumadocs) and MDX-native viewers. But the body is written **GFM-safe**: plain GitHub-flavored markdown that is simultaneously valid MDX. No JSX components, no ESM imports, no expressions. The same bytes parse as `.mdx` and render as `.md`. A user who wants GitHub's rich rendering renames the file to `AUDIT.md` and loses nothing.

GFM-safe means these MDX hazards are banned in prose:

- No bare `<` followed by a letter (MDX reads it as a JSX tag and fails). Write `less than`, or put the expression in backticks.
- No bare `{` or `}` in prose (MDX reads them as expressions). Put anything with braces in backticks or fenced code. Quoted evidence almost always contains braces: fence it.
- All code fragments, generics, paths, and shell snippets go in backticks or fences, where MDX leaves them alone.
- HTML comments do not survive MDX. Do not use them; the audit has no hidden content.

Also banned everywhere in the audit, matching godaudits house style: em dashes, en dashes, Unicode arrows (ASCII `->` only), box-drawing characters, emojis, smart quotes, and the ellipsis character.

## Frontmatter (machine state)

```yaml
---
name: <project-slug>
audit_version: 1
status: reported        # reported | remediating | resolved
created: YYYY-MM-DD
updated: YYYY-MM-DD
mode: fresh             # fresh | re-audit
plan_aware: false       # true when .godplans/PLAN.mdx was found and used
commit: abc1234         # short SHA audited, or no-git
archetype: saas-dashboard
scale: side-project
domains_applicable: [security, database, code-quality, ...]
domains_excluded:
  - name: seo
    reason: internal tool behind SSO; no public surface to index
scores:
  overall: 0
  verdict: ""
  domains: {}           # security: 72, database: 88, ...
counts:
  findings_total: 0
  critical: 0
  high: 0
  medium: 0
  low: 0
  tasks_total: 0
  tasks_done: 0
---
```

Frontmatter is the digest, not the truth. The truth is the finding blocks and the checkboxes; `scores` and `counts` are derived from them and updated in the same edit that changes a finding status or flips a box. If they ever disagree, recount from the body.

## Document skeleton, in order

1. `# <Project> audit` and a one-paragraph verdict: the overall score, the verdict band, the single biggest risk, and the single biggest strength. A reader who stops here still knows where the project stands.
2. `## Scope and method`. The commit audited, the date, the mode, what was examined and what was not, and the read-only statement: this audit made no source edits, ran no application code, connected to no live systems, and called no models.
3. `## Compliance gate`. One short section per `compliance.md`: pass, or the compliance findings injected (with finding IDs).
4. `## Applicability matrix`. Every domain, applicable or excluded, with reason. Excluded domains appear here and nowhere else.
5. `## Scorecard`. The table: domain, score, cap applied (if any), one-line reason for the score. Overall score and verdict band at the bottom. Weights and re-normalization per `intake.md`.
6. `## Strengths`. What the codebase does well, with the same file:line evidence standard as findings. An audit that names only faults is not calibrated; strengths also tell the remediating agent what not to break.
7. `## Findings`. One H3 per applicable domain, finding blocks under each (grammar below). Domains with zero findings state that in one line with what was checked.
8. `## Remediation plan`. Phases and waves of GA-numbered checkbox tasks (grammar below).
9. `## Accepted risks and open questions`. Exactly one such section. Each entry: the risk or question, options, a recommended default, and who decided (or must decide). Accepted risks name their acceptor.
10. `## Rules for remediating agents`. Copied verbatim from this module (below).
11. `## Session log`. Append-only, one line per session.

## Finding grammar

Findings live under `## Findings`, grouped by domain H3. The format is fixed; readers and remediating agents parse it.

```markdown
### Security

#### F-SEC-3 Boards API allows cross-tenant reads [Critical | Certain | S]

- Where: src/api/boards.ts:88
- Evidence: `db.boards.findOne({ id })` carries no owner predicate, and the route mounts without the authorize middleware (src/api/router.ts:41)
- Impact: any authenticated user reads any board by iterating ids (IDOR)
- Fix: add the ownership predicate inside the query and mount the route behind authorize
- Verify the fix: `npm test -- tests/security/isolation.test.ts`
- Checks: A-SEC-3
- Status: open
- Remediation: GA-101
```

Grammar rules:

- **IDs**: `F-<DOM>-<n>`, sequential within the domain, unique, stable forever. Never renumber, even across re-audits.
- **The severity triple**: `[Severity | Confidence | Effort]` on the heading line. Severity: Critical, High, Medium, Low. Confidence: Certain (evidence proves it), Firm (evidence strongly indicates it), Tentative (needs runtime or human confirmation). Effort to fix: S, M, L.
- **Where**: exact file:line at the audited commit. Multiple sites list the root site first; the rest go in Evidence.
- **Evidence**: quoted code or config, in backticks or a fence, with enough context that a reader can confirm the finding without opening the file. A finding without quotable evidence is a hypothesis; label it Tentative or delete it.
- **Impact**: what goes wrong for a user, operator, or the business, concretely. "Bad practice" is banned; name the failure.
- **Fix**: the specific change, named safe pattern included. "Improve validation" is banned; "validate `redirect` against a same-origin allowlist in src/auth/callback.ts" ships.
- **Verify the fix**: one exact command, or the exact manual path, that proves the fix landed. This line becomes the remediation task's Verify line.
- **Checks**: the A-<DOM>-n check ids this finding fails. In plan-aware mode, also the matching R-<DOM>-n plan requirement ids.
- **Status**: open, resolved, accepted-risk, or superseded. Fresh audits emit open only. Re-audits flip statuses; they never delete blocks.
- **Remediation**: the GA task ids that fix this finding, or `none (accepted risk)` with a pointer to the Accepted risks section.
- Every Critical and High finding maps to at least one remediation task. A Critical with no task is an unfinished audit.

## Remediation task grammar

Tasks live under phase headings in `## Remediation plan`, grouped into waves. The grammar is the godplans task grammar with `Fixes:` in place of feature requirements, so any agent that can execute a godplans plan can execute a godaudits remediation.

```markdown
## Phase 1: Stop the bleeding

Goal: zero Critical findings remain open. Blocks every other phase.

### Wave 1.1

- [ ] GA-101 [W1.1] Add ownership predicates to board queries
  - Files: src/api/boards.ts, src/api/router.ts
  - Depends on: none
  - Reuses: authorize middleware from src/middleware/authorize.ts; do not write a second one
  - Fixes: F-SEC-3
  - Acceptance: every board query includes an ownership or workspace predicate; a cross-user request returns 403 or 404 on GET, PUT, DELETE, and list
  - Verify: `npm test -- tests/security/isolation.test.ts`
  - Checks: A-SEC-3
```

Grammar rules:

- **IDs**: `GA-<phase><two digits>`, zero-padded, unique, stable forever. Never renumber. Grep-unique: `grep -n "GA-101" AUDIT.mdx` finds exactly the task and its references.
- **`[P]`**: parallel-safe, only when the task touches files disjoint from every other unchecked task in the same wave.
- **`[W<phase>.<wave>]`**: waves within a phase run in order; `[P]` tasks within a wave may run concurrently.
- **Files**: exact existing paths (this is remediation of a real codebase; invented paths are a defect).
- **Fixes**: the F-<DOM>-n ids this task resolves. Every task traces to at least one finding; a task tracing to nothing is scope creep, and belongs in a plan, not an audit.
- **Acceptance**: 2 to 4 grep-verifiable or observable conditions. "Fixed" is banned.
- **Verify**: one exact command in backticks, or the exact manual path. Inherited from the finding's Verify-the-fix line.
- **Checks**: the A-<DOM>-n ids satisfied when this task lands (plus R-ids in plan-aware mode).
- Phase order is the priority order: Phase 1 "Stop the bleeding" (all Criticals), Phase 2 "Quick wins" (High or Medium at S effort), Phase 3 "Plan now" (structural fixes, M or L effort), Phase 4 "Verify first" (Tentative findings: the task's first acceptance condition is confirming the finding), Phase 5 "Backlog" (Low severity worth recording). Empty phases are omitted.
- The final phase of every remediation plan is **Re-audit**: one task, re-run godaudits at the new commit, with acceptance naming the expected score movement ("security 61 to 85 or better, no Critical findings open") and Verify `re-run /godaudits and compare the Scorecard`.

## Scoring bands

Domain scores come from each module's Scoring section. Overall score is the weighted mean over applicable domains per the weights in `intake.md`. Caps, applied after weighting:

- Any open Critical finding caps its domain at 69 and the overall score at 79.
- A domain below 50 caps the overall at 84 (one rotten pillar is not averaged away).

Verdict bands, used verbatim in the Scorecard:

- 90 to 100: **audit-proof**. Ship it; keep the cadence.
- 80 to 89: **solid**. Quick wins remain; nothing structural.
- 70 to 79: **needs work**. At least one structural gap or an uncapped Critical path.
- 50 to 69: **at risk**. Multiple failing domains; remediation before features.
- 0 to 49: **critical condition**. Stop feature work; execute Phase 1 now.

## Rules for remediating agents

This block is copied verbatim into every emitted audit, under `## Rules for remediating agents`, wrapped in a GFM alert:

```markdown
> [!IMPORTANT]
> This audit is the source of truth. The chat is not.
>
> 1. Before any work: read the frontmatter, then find the first unchecked task in wave order. Re-derive state from checkboxes; trust nothing remembered.
> 2. One task at a time. Respect Depends on. Run tasks marked [P] concurrently only when their Files lists are disjoint.
> 3. Run the task's Verify command. Only after it passes, flip [ ] to [x], set every finding in its Fixes line to `Status: resolved`, and update the frontmatter counters and `updated:` date in the same edit. Never batch check-offs.
> 4. If Verify fails: the box stays unchecked. Append an indented `- Note (YYYY-MM-DD):` line under the task saying what happened.
> 5. Fix the root cause the finding names, not the symptom the evidence quotes. If the true fix differs from the task's Fix line, patch the audit first (new task id, superseded task struck through with a reason), then execute the patch.
> 6. Never renumber, reword, or uncheck a completed task; never delete or renumber a finding.
> 7. Do not "improve" code beyond the task's Files and Acceptance; opportunistic refactors invalidate the audit's evidence lines.
> 8. At session end: append one line to `## Session log`: date, tasks completed, findings resolved, what is next.
> 9. When all phases are done, run the final Re-audit task before declaring victory.
```

## Machine checks

An emitted audit must pass these before it is presented:

```bash
# counters match reality
open=$(grep -c '^- \[ \] GA-' AUDIT.mdx); done=$(grep -c '^- \[x\] GA-' AUDIT.mdx)
crit=$(grep -c '\[Critical | ' AUDIT.mdx)
# every task has a Verify line and a Fixes line (window covers wrapped fields)
grep -A9 '^- \[ \] GA-' AUDIT.mdx | grep -c 'Verify:'
grep -A9 '^- \[ \] GA-' AUDIT.mdx | grep -c 'Fixes:'
# every finding has Where, Evidence, and Status lines
grep -A9 '^#### F-' AUDIT.mdx | grep -c 'Evidence:'
# no banned characters
LC_ALL=C grep -nP '[^\x00-\x7F]' AUDIT.mdx && exit 1
# finding and task ids unique
grep -oE '^#### F-[A-Z]+-[0-9]+' AUDIT.mdx | sort | uniq -d
grep -oE 'GA-[0-9]+' AUDIT.mdx | grep -oE '^GA-[0-9]+$' | sort | uniq -d
# every Critical or High finding is referenced by some task's Fixes line
```

Duplicate ids, findings without evidence, tasks without Verify or Fixes lines, counter drift, an unmapped Critical, or banned characters block emission.

## Size discipline

The audit is re-read every remediation session; bloat is a tax on every future turn. Budgets: verdict paragraph under 120 words; no more than 12 findings per domain in the body (cluster the rest under a parent finding: one root cause, N sites listed in Evidence); no phase over 12 tasks; Accepted risks and open questions under 10 entries; Session log lines under 140 characters. When a re-audit outgrows these budgets, archive the prior version to `.godaudits/archive/AUDIT-v<n>.mdx` and keep the live audit lean.

## Re-audit protocol

When AUDIT.mdx already exists: read it fully, recount from the body, read the session log, then re-run the method against the current commit. Rules:

- Completed tasks and resolved findings are history: never altered, renumbered, or deleted.
- For each finding previously open: re-inspect the cited file:line at the new commit. Still present: stays open. Gone: flip to resolved with a `- Resolved: <commit> <one line>` note. Moved: update Where, keep the id.
- New findings continue each domain's id sequence. New tasks continue the GA sequence.
- Superseded unstarted tasks are struck through (`~~- [ ] GA-310 ...~~` plus a one-line reason), not deleted.
- Emit a `### Delta` subsection at the top of the Scorecard: previous score, new score, and the one-line cause per domain that moved.
- Bump `audit_version`, log the delta in the session log.
