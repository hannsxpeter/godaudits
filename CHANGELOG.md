# Changelog

All notable changes to godaudits are documented here. The format follows
Keep a Changelog; versioning follows SemVer.

## [1.0.0] - 2026-07-02

Initial release.

### Added

- The godaudits Agent Skill: one command that fingerprints an existing
  codebase, audits every applicable domain with evidence-backed findings,
  scores each domain with risk caps, and emits a master audit report at
  `.godaudits/AUDIT.mdx` with an agent-executable remediation plan.
- 18 domain reference modules: the seven aihxp auditors carried forward
  (security from secauditor and harden-ready, code-quality from
  codeauditor, database from dbauditor, llm from llmauditor, seo from
  seoauditor, ui from uiauditor, ux from uxauditor) and the aihxp
  arc-ready and ready-suite tier disciplines audited as reality checks
  (product, architecture, roadmap, stack, repo, build, deploy, observe,
  launch), plus aihxp/pillars (agent-memory) and aihxp/codedna
  (style-genome).
- Check ids `A-<DOM>-n` mirroring godplans requirement ids `R-<DOM>-n`
  one to one, closing the plan-build-audit loop; plan-aware mode audits
  conformance against `.godplans/PLAN.mdx` when present.
- Four core modules: audit-format (the AUDIT.mdx contract: finding and
  task grammar, scoring bands, executor rules), intake (mode detection,
  fingerprint, applicability matrix, domain weights, ownership map),
  compliance (Anthropic Usage Policy gate, account safety, and in-code
  compliance findings), exemplar (the quality bar, worked).
- AUDIT.mdx template with GFM-safe MDX body, F-numbered findings with a
  severity triple, GA-numbered checkbox remediation tasks, waves,
  executor rules, and a session log.
- Cross-tool packaging: canonical skill under `skills/godaudits/`,
  `.agents/skills` and `.claude/skills` projections, `install.sh` with a
  six-destination matrix, generated `PROMPT.md` fallback for T3 Chat,
  Aider, and plain chat surfaces.
- Meta-linter (`scripts/lint.sh`) enforcing unicode cleanliness, version
  parity, spec-bound description length, module contract completeness,
  and PROMPT.md freshness; wired into CI with an installer smoke test.
