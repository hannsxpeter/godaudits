# About godaudits

The long-form writeup: what godaudits is, why it exists, and the design decisions behind it.

## The problem: audits that end in prose end in nothing

The AI coding ecosystem grew a family of single-dimension auditors: one for code quality, one for security, one for the database layer, one for LLM integration, one for SEO, one for UI, one for UX. Each is good at its slice. Run them all against a real project and three problems appear.

First, seven audits means seven fingerprint passes over the same repo, seven vocabularies, and seven reports that each score the same root cause. A missing authorization layer shows up as a security Critical, a code-quality complexity finding, a database access-pattern smell, and a UX error-state gap: one defect, four bills.

Second, whole territories go unaudited. The single-dimension auditors never ask whether the product does what its own README promises, whether the architecture matches the diagram in the docs, whether the roadmap is fiction, whether the deploy pipeline can roll back, whether the repo would survive a new contributor, or whether half the handlers are stubs returning fake JSON. The disciplines that arc-tier tools enforce while building (PRD, architecture, roadmap, stack, repo, build, deploy, observability, launch) are exactly the ones nobody re-checks after building.

Third, and worst: the reports end in prose. "Consider adding rate limiting" is not work an agent can execute. The gap between a finding and a fixed codebase is a plan, and the auditors never wrote one.

godaudits closes all three gaps. One command, one fingerprint pass, one ownership map so each root cause is billed exactly once, eighteen domains covering both the auditor family and the arc tiers, and one output whose second half is not prose but a remediation plan: phases and waves of checkbox tasks with exact files, grep-verifiable acceptance criteria, and one verify command each, in a grammar any coding agent can execute.

## The mirror: how godaudits relates to godplans

godplans, the sibling skill, took every check the auditors run and inverted each into a plan-time requirement, so a project planned with godplans passes its audits by design. godaudits is the same corpus run in the forward direction, against code that already exists.

The two skills share one numbering system. Plan requirement `R-SEC-3` demands ownership predicates inside every tenant query; audit check `A-SEC-3` verifies that exact property in the code. The mapping is one to one by construction, which buys three things. Plan-aware auditing: when godaudits finds `.godplans/PLAN.mdx` in the repo, every finding also cites the plan requirement it violates, and plan drift (checked tasks whose acceptance conditions no longer hold) is audited as a first-class concern. A closed loop: plan, build, audit, remediate, re-audit, with the same ids traveling the whole circuit. And a shared task grammar: a godaudits remediation plan is executable by anything that can execute a godplans plan, including a bare agent reading the embedded executor rules.

## The shape: one command, one file

godaudits has no sub-commands. One invocation runs an eight-phase method: orient (fresh audit, re-audit, plan-aware), compliance gate, intake and fingerprint, eighteen domain passes, adversarial verification, scoring, remediation planning, and emission.

The output is one file, `.godaudits/AUDIT.mdx`. Its body is GFM-safe MDX (plain GitHub-flavored markdown that parses as MDX), with YAML frontmatter carrying machine state: scores, counts, mode, the commit audited. The verdict paragraph comes first, because most readers stop there. Findings carry stable ids, a severity triple (Severity | Confidence | Effort), quoted evidence at file:line, concrete impact, a specific fix, and the command that verifies the fix. The remediation plan orders phases by triage priority (Stop the bleeding, Quick wins, Plan now, Verify first, Backlog) and always ends with a Re-audit phase, so remediation ends with a score delta, not a feeling.

## Design decisions worth recording

**Evidence or it did not happen.** Every finding must quote code the auditor re-opened and confirmed during the adversarial verification phase. Findings that survive only as vibes are labeled Tentative and routed to a Verify-first phase whose tasks begin with confirmation. This is the difference between an audit and an opinion with a scorecard.

**One owner per concern.** The intake module carries an ownership map: secrets belong to security, indexes to database, prompt injection to security even though llm found it, visual accessibility to ui, flow accessibility to ux. Other domains cross-reference the owning finding id. Without this, multi-domain audits double- and triple-bill every root cause and the overall score becomes noise.

**Caps, not averages.** A single open Critical caps its domain at 69 and the overall at 79; a domain below 50 caps the overall at 84. Averaging would let twelve polished domains launder one exploitable IDOR into a comfortable 88. The caps encode the reality that audit scores are load-bearing only if the worst thing dominates.

**Strengths are findings too.** Every audit names what the codebase does well, at the same evidence standard. This is not politeness: the remediating agent needs to know which patterns are intentional and working so it extends them instead of breaking them.

**Read-only is absolute.** godaudits never edits source, never runs the app or its test suite, never connects to a live database, never calls a model, and writes only under `.godaudits/`. An auditor that mutates while measuring invalidates its own evidence; an auditor that must run your production stack to have an opinion is a liability. Everything godaudits knows, it learned by reading.

**The audit is the memory.** Re-audit mode re-derives state from the file: findings are never renumbered or deleted, statuses flip with evidence notes, new findings continue the sequence, and the scorecard opens with a delta. The chat is treated as untrusted cache, which is what lets remediation span weeks, tool switches, and different agents.

**Policy compliance as a first-class module.** godaudits screens the audited product against the Anthropic Usage Policy before auditing it, because improving a prohibited product is facilitating it. It also hunts policy risk inside the code: undisclosed AI chatbots, subscription OAuth tokens wired into unattended automation (the number one real-world ban vector), scrapers without robots.txt respect. Those land as compliance findings with mandatory remediation tasks. A carve-out list prevents over-blocking legitimate work.

**Mechanical enforcement of style.** The repository holds itself to the discipline it demands: a meta-linter enforces pure-ASCII punctuation, three-way version parity, the six-section module contract, and PROMPT.md freshness, and CI fails on violations.

## How it was built

godaudits was designed and written by AI agents under human direction, in one session, using the discipline it teaches: the source skills (the seven auditors, arc-ready, ready-suite, pillars, codedna, and godplans) were read first; the binding contracts (audit format, intake, compliance, the orchestrator) were written second; then eighteen domain-module authors ran in parallel against a fixed authoring spec, each paired with an adversarial verifier, followed by a cross-file consistency reviewer and the mechanical linter.

## Composing with siblings

- Plan with godplans, build with any agent, then audit with godaudits: the shared numbering turns the audit into a conformance report.
- Inherit a codebase you did not build: run godaudits first; its fingerprint, scorecard, and remediation plan are the onboarding document.
- Run godaudits before a launch, an acquisition review, or a security review: the evidence lines and the commit pin make the report reproducible by a third party.
- Keep the cadence: the final task of every remediation is a re-audit, and re-audit mode keeps score history in one file.
