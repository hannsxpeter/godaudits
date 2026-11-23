# About godaudits

AI reviews sound like audits. They are often guesses dressed as certainty.

godaudits closes that gap. An audit is worth acting on only when three things
are true at once:

1. **It is about your repository**, not repositories in general.
2. **Evidence and scores are reproducible.** Someone else can follow a grade
   back to the facts that produced it.
3. **Findings become work.** Each Critical and High finding ships with tasks
   another agent can execute without asking a follow-up.

## Two halves

**Judgment** lives in the Agent Skill and its domain modules: 437 checks across
18 areas. Agents trace paths, refute their own findings, cluster root causes,
and write specific fixes.

**Determinism** lives in the bundled zero-dependency runtime: fingerprinting,
catalog compilation, validation, score arithmetic, MDX and SARIF rendering,
re-audit diffs, wayfinding, and change-safety gates. Anything a fluent model
could fake is computed instead.

Neither half is enough alone. Together you get prose that is judgment and
numbers that are arithmetic, and you can tell which is which.

## Safety defaults

Static mode is the default. It does not run your app, your tests, or the
network. Stronger evidence modes need explicit authority. Secrets are masked
before they enter any artifact. Unknown stays visible and caps the verdict
instead of becoming a quiet pass.

## Closed loop

godaudits mirrors godplans through shared `R-DOM-n` / `A-DOM-n` ids. Plan,
build, audit, repair, re-audit. The audit is a versioned evidence graph that
compiles into work.
