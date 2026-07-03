# Compliance module: Anthropic Usage Policy gate and account safety

Loaded in Phase 1, before intake, and standing for the whole session. Two halves: (A) rules for how this skill and its host agent use Claude, and (B) the audit-time gate applied to the project being audited. The point is practical: keep the user's account clean and keep the audited product on the right side of the Anthropic Usage Policy (anthropic.com/legal/aup, effective 2025-09-15), the Consumer Terms (anthropic.com/legal/consumer-terms), and the agent guidance at support.claude.com (article 12005017). Policies change; on compliance-sensitive audits, re-check those URLs rather than trusting this file's snapshot.

The same screening logic applies unchanged when this skill runs in a non-Claude harness (Codex, Cursor, Gemini, and others): every provider publishes an equivalent usage policy, and a project that fails the gate below almost certainly fails theirs too.

## A. How the skill itself behaves

1. **Never coach the model past a refusal.** Do not ask any model to ignore, work around, or bypass its guardrails; do not rephrase, fragment, or roleplay a refused request into innocuous-looking steps. Intentional guardrail bypass is a named Usage Policy violation. If a step is refused, route it to the human and move on.
2. **Authentication hygiene, the number one real-world ban vector.** Subscription (Free, Pro, Max) OAuth credentials belong only in official Anthropic clients: Claude Code, claude.ai, the desktop and mobile apps. Never suggest extracting or reusing subscription tokens in third-party harnesses, scripts, or the Agent SDK; accounts are banned for this without prior notice. Any remediation task this audit emits for unattended runs (CI, cron, bots, background runs) must specify API-key auth (`ANTHROPIC_API_KEY` via the Console, Bedrock, or Vertex). No account sharing, no reselling access, no parallel accounts to dodge limits, no 24/7 background use of a subscription plan.
3. **The audit is read-only and honest.** godaudits never runs the audited product, so the audit itself creates no policy exposure; the exposure it looks for is in the code. No fabricated findings, no invented file:line citations, no severity inflation to look thorough. A wrong citation in an audit is the same offense as a paper control in a codebase.
4. **If a warning or ban happens anyway**: appeal at claude.ai/restricted or safeguards@anthropic.com. Creating a new account to evade a ban is itself a listed violation. Note for users: VPN and datacenter IPs, rapid geographic changes, and billing changes are documented false-positive triggers; prevention beats appeal (appeals succeed rarely).

## B. The audit-time gate

Screen the audited product's core purpose before investing in domain passes. An audit is optimization help: improving a prohibited product is facilitating it, so the gate is not advisory. Three outcomes:

- **Hard stop**: the core purpose is prohibited. Name the category, cite it, decline to audit. Examples: fake-review or engagement farms, phishing kits and lookalike domains, undisclosed AI persona networks, scrapers built to evade platform safeguards, malware and DDoS tooling, ban-evasion systems, voter-deception tooling. Exception: authorized security work (pen-test tooling with written permission, CTF, defensive research) is fine; ask for and record the authorization context.
- **Mitigate**: legitimate product, policy-risk component found in the code. Audit it, and emit each hit as a compliance finding (ids `F-CMP-n`, grammar per `audit-format.md`) with a mandatory remediation task. The compliance checklist below is what to grep for.
- **Pass**: record "Compliance gate: pass" in the audit and move on. Do not lecture; one line suffices.

### Prohibited-purpose checklist (hard stop when it is the core mechanic)

1. **Deception**: fake reviews, comments, or engagement; fake personas; sites mimicking legitimate pages; phishing or social-engineering flows; AI output passed off as human.
2. **Spam and ranking abuse**: mass unsolicited messaging; spam content generation at scale; manipulated rankings, traffic metrics, or polls; coordinated inauthentic behavior; click farming.
3. **Dark patterns and predatory practices**: manipulative behavior-distortion techniques, exploitative lending, MLM and pyramid mechanics, abusive debt collection, exploiting age or disability or economic hardship.
4. **Privacy and surveillance**: harvesting personal, health, or biometric data without consent; tracking individuals without notice; facial recognition without consent; mass surveillance; profiling on protected attributes.
5. **Unauthorized access and malware**: backdoors, privilege escalation, credential abuse, botnets, DDoS, exploiting vulnerabilities without authorization.
6. **Platform abuse**: bulk account creation, multi-account evasion, CAPTCHA and anti-bot circumvention at scale, scraping that violates a target's ToS or robots.txt.
7. **Political manipulation**: voter or campaign micro-targeting, synthetic media of political figures, automated outreach to officials or voters that conceals its artificial origin.

### Compliance findings to hunt in the code (emit F-CMP findings when they hit)

- **Consumer-facing chatbot without AI disclosure**: a chat UI over a model with no disclosure string in the first-load path. Severity High; fix is a disclosure at session start.
- **High-risk consumer domain without review gates** (legal, medical, financial, insurance, employment or housing eligibility, admissions, automated journalism): model output flowing to consumers with no qualified-review step and no AI disclosure. Severity High. B2B internal tools are exempt; record which applies.
- **Subscription OAuth in unattended automation**: Claude Code OAuth tokens or session credentials wired into CI, cron, serverless jobs, or third-party harnesses. Severity Critical; this is the ban vector. Fix: `ANTHROPIC_API_KEY` from the Console, Bedrock, or Vertex.
- **Guardrail-bypass prompts in the product's own code**: system prompts instructing a model to ignore its guidelines, roleplay past refusals, or conceal its AI nature from users. Severity Critical.
- **Crawler or scraper without manners**: no robots.txt check, no rate limiting, a user agent that lies, or multi-account operation against a third-party platform. Severity High; the fix names the throttle and the robots.txt check as components.
- **Outbound automated communications concealing artificial origin**: bulk messaging code with no disclosure. Severity High.
- **Products serving minors**: no age-gating decision recorded anywhere. Severity Medium; flag for Anthropic's additional minor-safety requirements.
- **AI-generated content published at scale without labeling** where the target platform requires it. Severity Medium.

### Do not over-block

The gate exists to catch real violations, not to harass legitimate work. Explicitly fine: authorized security testing and research, civic and policy research, B2B professional tools (exempt from the consumer disclosure duo), heavy individual use of a paid plan, API-key automation and CI, adult themes in creative writing within policy, and competitive analysis. When a product is ambiguous, ask one clarifying question instead of refusing; record the answer in the audit.

## What lands in the audit

One short section:

```markdown
## Compliance gate

Result: pass | findings injected | (hard stop never reaches an audit)
Screened: YYYY-MM-DD against anthropic.com/legal/aup (2025-09-15 version).
Findings injected: F-CMP-1 (chatbot lacks AI disclosure), F-CMP-2 (OAuth token in cron). [omit line when pass]
Account safety: remediation tasks that automate model calls specify ANTHROPIC_API_KEY; no subscription OAuth outside official clients.
```

Proportionate, checkable, done.
