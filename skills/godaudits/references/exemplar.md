# Exemplar module: the quality bar, worked

Loaded whenever quality is in doubt, and always before Phase 5 scoring. Four audit fragments, each shown twice: the version that fails and the version that ships. The difference is always the same difference: the bad version could have been written without reading the codebase; the good version pins itself to this repo, this commit, this line, and could belong to no other audit.

## 1. A finding block

**Never produce this:**

```markdown
#### F-SEC-1 Weak input validation

The API does not properly validate user input in several places, which
could lead to security vulnerabilities. Input validation should be
improved across the codebase.
```

No severity triple, no Where, no Evidence, no fix, no task. "Several places" and "could lead to" survive substitution into any repo ever audited. A remediating agent holding only this block must re-run the audit before it can act.

**This is the bar:**

```markdown
#### F-SEC-4 Auth callback follows an unvalidated redirect [High | Certain | S]

- Where: src/auth/callback.ts:52
- Evidence: `res.redirect(req.query.next as string)` runs with no origin
  check; the login form passes `next` through untouched
  (src/pages/login.tsx:31)
- Impact: a crafted login link lands a freshly authenticated user on an
  attacker page with a live session; an open redirect as a phishing pivot
- Fix: validate `next` against the same-origin allowlist in
  src/config/origins.ts inside callback.ts; fall back to `/dashboard`
- Verify the fix: `npm test -- tests/security/redirect.test.ts`
- Checks: A-SEC-4
- Status: open
- Remediation: GA-102
```

## 2. A scorecard row

**Never produce this:**

```markdown
| Security | 78 | Generally solid security posture with some room for improvement |
```

78 is a vibe wearing a number. No cap, no finding named, and the reason fits every domain of every audit ever written.

**This is the bar:**

```markdown
| Security | 69 (cap) | Weighted 81, capped at 69: F-SEC-3 (Critical, cross-tenant reads) is open. F-SEC-3 and F-SEC-4 cost 30 of 40 access-control points; secrets and headers dimensions are clean. |
```

The score shows its arithmetic: the uncapped number, the rule that capped it, and the finding ids that did the damage. When `F-SEC-3` flips to resolved, a reader can recompute the row without re-auditing.

## 3. A remediation task

**Never produce this:**

```markdown
- [ ] GA-201 Improve API security
  - Acceptance: the API is secure and validated
  - Verify: review the changes carefully
```

No Files, no Fixes line, an acceptance no grep can test, a verify step that names nothing. Untraceable to any finding, unexecutable by any agent, uncheckable by any human.

**This is the bar:**

```markdown
- [ ] GA-102 [W1.1] Validate the auth callback redirect target
  - Files: src/auth/callback.ts, tests/security/redirect.test.ts
  - Depends on: none
  - Reuses: same-origin allowlist from src/config/origins.ts; do not
    hardcode a second list
  - Fixes: F-SEC-4
  - Acceptance: `next` values off the allowlist redirect to `/dashboard`;
    a request with `next=https://evil.example` returns 302 to
    `/dashboard`; the allowlist import comes from src/config/origins.ts
  - Verify: `npm test -- tests/security/redirect.test.ts`
  - Checks: A-SEC-4
```

The Fixes line closes the loop: finding `F-SEC-4` names `GA-102` as its remediation, `GA-102` names `F-SEC-4` as its reason to exist, and both carry the same Verify command. Flip the box, resolve the finding, and the frontmatter counters move in the same edit.

## 4. A strengths entry

**Never produce this:**

```markdown
- Good code quality overall; the team clearly cares about testing.
```

Flattery with no coordinates. It tells the remediating agent nothing to preserve and the reader nothing they can confirm.

**This is the bar:**

```markdown
- Reversible migrations, enforced: all 41 files under db/migrations/
  ship a paired `down()`, and CI blocks merges without one via
  `npm run migrate:lint` (.github/workflows/ci.yml:38). Remediation
  tasks GA-301 and GA-303 touch this directory; keep the pairing intact.
```

A strength is a finding with the sign flipped: same evidence standard, same file:line, plus the warning that tells a remediating agent what not to break while executing nearby tasks.

## The pattern under all four

1. Name the thing: real file:line, real ids, real commands, never the category of the thing.
2. Quote the evidence: a finding without quotable evidence is a hypothesis, and a strength without evidence is flattery.
3. Make failure detectable: every claim carries the check, command, or cap rule that would catch its violation.
4. End in a checkbox: every Critical and High finding traces to a GA task an agent can execute, verify, and flip.

Score any audit fragment against these four. A fragment that names nothing, quotes nothing, and checks nothing scores zero, no matter how alarming its warnings or how reassuring its praise.
