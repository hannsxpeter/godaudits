# About godaudits

## The problem with asking an AI to audit your code

Ask any capable model to review a codebase and you will get something that
reads like an audit. It will be articulate, plausible, and organized under
confident headings. What you cannot tell, from the document alone, is which
parts it actually checked.

That is the gap godaudits closes. An audit is only worth acting on when three
things are true at the same time:

1. **The judgment is about your repository**, not about repositories in
   general. Advice that would fit any project has told you nothing about
   yours.
2. **The evidence and the arithmetic are reproducible.** Someone else should be
   able to follow a score back to the facts that produced it, and get the same
   number.
3. **The result turns into work.** A finding that does not become a task
   somebody can execute is a complaint.

Version 1 established the judgment discipline: evidence at file and line,
adversarial refutation, root-cause clustering, one owning domain per finding,
calibrated severity, risk caps, recorded strengths, and executable remediation
tasks.

Version 2 made that discipline enforceable rather than aspirational. Version
2.1 added context and artifact truth: the auditor works out how a project is
actually delivered, which domain overlays are only candidates, which agent
memory files really load, and whether the upstream planning and hardening
evidence has gone stale.

The system has two halves, and the boundary between them is the design.

## Judgment layer

The Agent Skill and its 18 reference modules define 437 checks across product,
architecture, stack, database, security, LLM integration, UX, UI, SEO, code
quality, style genome, agent memory, repository, build completeness, roadmap,
deployment, observability, and launch readiness.

This is the half that requires reading comprehension. Agents trace execution
paths, compare what the code claims against what it does, separate root causes
from symptoms, argue against their own candidate findings, and write fixes
specific enough for a different agent to carry out without asking a follow-up
question.

## Deterministic layer

The bundled runtime performs the operations where discretion is a liability:

- Compile the authored modules into a versioned check catalog.
- Fingerprint repository files, hashes, manifests, languages, signals, and
  absences without executing product code.
- Narrow reader-facing prose review with high-confidence copy candidates while
  leaving authorship, specificity, and support judgments to the domain pass.
- Detect six project forms, secondary surfaces, 37 arc-ready profile
  candidates, and regulatory candidates without asserting that any law applies.
- Validate Pillars 1.1 routing and arc-ready 1.1 artifact state.
- Initialize every selected check as unknown, so nothing starts out assumed
  fine.
- Validate outcomes, evidence, ids, weights, reciprocal links, task graphs,
  risk expiry, and final-gate closure.
- Compute scores, coverage, caps, counters, and verdicts.
- Render the MDX report and SARIF output from canonical JSON state.
- Diff re-audits without losing historical ids.
- Plan diff-scoped impact beyond direct callers, validate proof provenance,
  and compile a separate change-safety merge gate.
- Measure audit output against expected findings and clean controls.

It is a zero-dependency program that ships inside the skill, so a skill-only
install still has validation and rendering.

## Why the split matters

A model is good at interpreting code in context. It should not be trusted to
hold 437 checks in working memory, maintain counters by hand, reproduce score
arithmetic, notice every broken cross-reference, or keep generated views in
sync with the state they were generated from. Those are exactly the tasks where
a fluent answer and a correct answer look identical from the outside.

A deterministic program is good at those invariants and useless at the rest. It
cannot decide whether an authorization middleware truly binds, whether a
product promise is honest, or whether twelve symptoms share one cause.

Neither half is trustworthy alone. Together they produce a document where the
prose is judgment and the numbers are arithmetic, and you can tell which is
which.

## Safety boundary

Static mode is the default. It makes no product execution and no network
requests. Runtime and connected evidence require explicit authority and keep
their provenance attached. Secret values are masked before they enter any audit
artifact.

Unknown stays visible. It caps the verdict instead of being quietly converted
into a convenient pass, because the alternative is an audit whose grade
improves every time it looks away.

Evidence is also time-bound. Release-grade validation compares both the
repository fingerprint and the commit, and the arc-ready launch gate compares
its recorded hardening revision against current content. An audit that was true
last month cannot silently survive the repository moving underneath it.

## The closed loop

godaudits mirrors [godplans](https://github.com/hannsxpeter/godplans) through
shared `R-DOM-n` and `A-DOM-n` ids. Planning states the requirement,
implementation builds it, auditing evaluates it, remediation fixes it, and the
re-audit proves the movement with a score and coverage delta.

The audit is not an opinion with a scorecard attached. It is a versioned
evidence graph that compiles into work.
