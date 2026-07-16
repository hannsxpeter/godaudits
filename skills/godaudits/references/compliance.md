# Compliance gate and policy-pack contract

Loaded before intake and standing for the whole session. Compliance is a
versioned evidence exercise. It is not a timeless checklist and not legal
advice. Start with `policies/provider-neutral.md`, then add only the provider,
platform, jurisdiction, or regulated-domain packs that the repository and user
context make applicable.

## A. How the auditor behaves

1. Do not coach any model or service past a refusal, safeguard, rate limit,
   account restriction, or supported authentication boundary.
2. Never copy a live credential into audit evidence. Mask the value and retain
   only a one-way fingerprint, location, provider shape, and rotation status.
3. Static mode makes no product network requests and calls no product models.
   Policy lookup uses current primary sources only when the user has authorized
   network research; otherwise record the versioned snapshot and lower
   confidence.
4. Dual-use code is not prohibited by appearance. Ask one question when
   authorization, defensive purpose, or deployment context changes the result.
5. Findings cite the applicable policy text, version or checked date, code
   evidence, concrete exposure, and remediation. Policy vibes do not ship.

## B. Gate outcomes

- **Hard stop**: the clearly established core purpose is prohibited under an
  applicable current policy and no authorized exception applies. Name the
  category, policy pack and version, evidence, and why the exception does not
  apply. Stop before optimization guidance.
- **Findings injected**: the product is legitimate but a component creates a
  policy, account, disclosure, privacy, or platform risk. Continue and emit
  `F-CMP-n` findings with mandatory tasks.
- **Pass**: record the packs used, versions or checked dates, authorization
  context if relevant, and one-line result.
- **Unknown**: policy text or context could not be verified and the answer would
  change the gate. Ask one clarifying question or record an owned blocking open
  question. Never silently convert unknown to pass.

## C. In-code risks to inspect

- Consumer-facing automated interaction without required disclosure.
- High-impact medical, legal, financial, employment, housing, education, or
  insurance decisions without qualified review, appeal, and provenance.
- Unsupported subscription or session credentials used in CI, cron, servers,
  third-party harnesses, or shared accounts.
- Product prompts or code whose purpose is safeguard or refusal bypass.
- Scrapers without an authorization basis, honest user agent, robots handling,
  rate limits, and deletion or retention policy.
- Automated outbound communication without consent, disclosure, unsubscribe,
  and rate control.
- Sensitive data sent to a provider without minimization, retention controls,
  and required agreements.
- Products involving minors without an age, consent, and safety decision.

## D. Do not over-block

Authorized security work, CTFs, defensive research, accessibility tooling,
interoperability, competitive analysis, public-interest research, individual
use of supported products, and API-key automation are not violations merely
because similar primitives can be abused. Record the facts that distinguish the
legitimate case.

## E. Framework conformance (standards ledger)

The gate above screens usage, platform, and provider policy: is the product
allowed. That is distinct from framework CONFORMANCE: does the code evidence a
regulatory framework's controls. Conformance is tracked in the standards ledger,
not this gate, and never as a separate scored domain.

The catalog defines conformance frameworks as `standards` alongside OWASP Web Top
10:2025: privacy and sovereignty (GDPR, CCPA/CPRA, PIPEDA), accessibility (WCAG
2.2 AA, AODA, ADA/Section 508), security frameworks (SOC 2 Trust Services
Criteria, ISO/IEC 27001:2022 Annex A), and industry standards (PCI DSS v4.0,
HIPAA Security Rule). Each framework maps its categories to the existing checks
that provide code evidence, so a framework is dispositioned from the checks it
references, never double-scored.

Disposition each framework per APPLICABILITY, governed by where the product's
users are and what data it handles, not only where the business sits. A framework
whose regulated surface is absent is `not-applicable` with absence evidence
(HIPAA with no PHI, PCI DSS with no card data, GDPR with no EU-resident data
path). A framework whose owning checks pass is `pass` with their evidence; a
failing owning check makes its category `fail`.

Technical-readiness, not certification. These frameworks evidence the technical
controls a code audit can see (encryption, access control, consent code, DSAR
paths, audit logging, accessible markup). They do not evidence the organizational
and process controls (policies, training, vendor management, incident response,
physical security) that SOC 2, ISO/IEC 27001, or PCI certification require. Report
conformance as control-evidence readiness and never claim certification.

## What lands in AUDIT.json

The `compliance` object records `result` (`pass`, `findings-injected`, or
`unknown`), `screened`, and `policy_pack`. Unknown requires an owned open
question. `findings-injected` requires at least one `F-CMP-n` finding with a
reciprocal task. Supporting policy citations and authorization context are
evidence records. A hard stop does not produce a scored audit because scoring a
prohibited product would misrepresent the gate as advisory.
