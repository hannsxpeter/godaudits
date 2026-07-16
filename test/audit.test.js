'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { compileAudit, evidenceBasis, validateAudit } = require('../skills/godaudits/runtime/lib/audit');
const { renderAudit } = require('../skills/godaudits/runtime/lib/render');
const { auditToSarif } = require('../skills/godaudits/runtime/lib/sarif');
const { validAudit } = require('./helpers');

test('valid audit compiles deterministic scores and coverage', () => {
  const result = compileAudit(validAudit());
  assert.deepEqual(result.errors, []);
  assert.equal(result.audit.computed.coverage.percent, 100);
  assert.equal(result.audit.computed.domains.security.raw_score, 40);
  assert.equal(result.audit.computed.domains.security.score, 40);
  assert.equal(result.audit.computed.overall.score, 40);
  assert.equal(result.audit.computed.overall.verdict, 'critical condition');
});

test('unknown checks reduce coverage and cap the verdict', () => {
  const audit = validAudit();
  audit.domains[0].checks[1].outcome = 'unknown';
  const result = compileAudit(audit);
  assert.deepEqual(result.errors, []);
  assert.equal(result.audit.computed.coverage.percent, 50);
  assert.equal(result.audit.computed.overall.coverage_cap, 69);
});

test('validator rejects broken traceability and score weights', () => {
  const audit = validAudit();
  audit.tasks[0].fixes = [];
  audit.domains[0].checks[0].weight = 70;
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('F-SEC-1 has no remediation task')));
  assert.ok(errors.some((error) => error.includes('check weights must sum to 100')));
});

test('validator enforces typed evidence provenance', () => {
  const audit = validAudit();
  delete audit.evidence[0].sha256;
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('source evidence requires path, positive line, quote, and sha256')));
});

test('Certain Critical and High findings require independent evidence paths', () => {
  const audit = validAudit();
  audit.findings[0].evidence = ['E-1'];
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('requires two independent evidence paths')));
});

test('a Certain weighted pass costs the same corroboration as a Certain alarm', () => {
  const audit = validAudit();
  audit.domains[0].checks[1].confidence = 'Certain';
  audit.domains[0].checks[1].evidence = ['E-2'];
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('A-SEC-4 is a Certain weighted pass and requires two independent evidence paths')));
});

test('a corroborated Certain pass validates', () => {
  const audit = validAudit();
  audit.domains[0].checks[1].confidence = 'Certain';
  audit.domains[0].checks[1].evidence = ['E-1', 'E-2'];
  const errors = validateAudit(audit);
  assert.deepStrictEqual(errors.filter((error) => error.includes('Certain weighted pass')), []);
});

test('two quotes from one file are one evidence method, not two', () => {
  const audit = validAudit();
  audit.evidence.push({
    id: 'E-3',
    type: 'source',
    path: 'src/router.js',
    line: 9,
    quote: 'router.use(rateLimit)',
    sha256: 'c'.repeat(64),
    redacted: false
  });
  audit.domains[0].checks[1].confidence = 'Certain';
  audit.domains[0].checks[1].evidence = ['E-2', 'E-3'];
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('A-SEC-4 is a Certain weighted pass and requires two independent evidence paths')));
});

test('routing checks carry no weight and stay exempt from the pass corroboration bar', () => {
  const audit = validAudit();
  audit.domains[0].checks[1].confidence = 'Certain';
  audit.domains[0].checks[1].weight = 0;
  audit.domains[0].checks[1].evidence = ['E-2'];
  const errors = validateAudit(audit);
  assert.deepStrictEqual(errors.filter((error) => error.includes('Certain weighted pass')), []);
});

test('not-applicable outcomes require evidence and calendar dates are real', () => {
  const audit = validAudit();
  audit.domains[0].checks[1].outcome = 'not-applicable';
  audit.domains[0].checks[1].evidence = [];
  audit.audit.updated = '2026-02-30';
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('not-applicable outcome requires evidence')));
  assert.ok(errors.some((error) => error.includes('must be YYYY-MM-DD')));
});

test('expired risk acceptances and unknown compliance without an owner fail', () => {
  const audit = validAudit();
  audit.findings[0].status = 'accepted-risk';
  audit.compliance.result = 'unknown';
  audit.accepted_risks.push({
    finding: 'F-SEC-1',
    summary: 'Temporary acceptance for migration.',
    owner: 'security-owner',
    accepted_on: '2026-06-01',
    expires: '2026-07-01',
    review: 'node --test test/security.test.js'
  });
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('expired on 2026-07-01')));
  assert.ok(errors.some((error) => error.includes('unknown compliance requires an owned open question')));
});

test('accepted risks keep severity scoring, caps, and counts', () => {
  const accepted = (severity) => {
    const audit = validAudit();
    audit.findings[0].status = 'accepted-risk';
    audit.findings[0].severity = severity;
    audit.accepted_risks.push({
      finding: 'F-SEC-1',
      summary: 'Accepted during a bounded migration.',
      owner: 'security-owner',
      accepted_on: '2026-07-13',
      expires: '2026-08-13',
      review: 'node --test test/security.test.js'
    });
    return compileAudit(audit).audit;
  };
  const low = accepted('Low');
  assert.equal(low.computed.domains.security.score, 85);
  assert.equal(low.computed.counts.low, 1);
  const critical = accepted('Critical');
  assert.equal(critical.computed.overall.critical_cap, 79);
  assert.equal(critical.computed.counts.critical, 1);
});

test('final re-audit gate must remain a pure verifiable gate', () => {
  const audit = validAudit();
  audit.tasks[1].acceptance = [];
  audit.tasks[1].files = ['src/boards.js'];
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('final gate requires 1 to 4')));
  assert.ok(errors.some((error) => error.includes('final gate files, fixes, and checks must be empty')));
});

test('superseded tasks do not close active Critical or High findings', () => {
  const audit = validAudit();
  audit.tasks[0].status = 'superseded';
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('F-SEC-1 has no remediation task')));
});

test('parallel tasks cannot share files in the same wave', () => {
  const audit = validAudit();
  audit.tasks[0].parallel = true;
  audit.tasks.splice(1, 0, {
    ...audit.tasks[0],
    id: 'GA-102',
    title: 'Add tenant isolation regression coverage'
  });
  audit.findings[0].remediation.push('GA-102');
  audit.tasks[2].depends_on.push('GA-102');
  const errors = validateAudit(audit);
  assert.ok(errors.some((error) => error.includes('are parallel but share')));
});

test('renderer produces a standalone audit with computed state', () => {
  const compiled = compileAudit(validAudit()).audit;
  const mdx = renderAudit(compiled);
  assert.match(mdx, /^---\n/);
  assert.match(mdx, /overall: 40/);
  assert.match(mdx, /Coverage: 2 of 2 applicable checks evaluated \(100%\)/);
  assert.match(mdx, /#### F-SEC-1 Board lookup omits the tenant predicate/);
  assert.match(mdx, /- \[ \] GA-101 \[W1\.1\]/);
});

test('the grade never appears without its method scope on any consumer surface', () => {
  const compiled = compileAudit(validAudit()).audit;
  const mdx = renderAudit(compiled);
  const frontmatter = mdx.split('---')[1];

  // The prose headline leads with the method, not a bare number.
  assert.match(mdx, /Static-read grade 40\/100 \(critical condition\): an arithmetic roll-up of model-assigned pass\/fail from a source read, not a test result, scan, or certification\./);
  assert.doesNotMatch(mdx, /^Score 40\/100/m);

  // A consumer handed only the frontmatter cannot lift the grade or the
  // verdict word without the scope token sitting beside it.
  assert.match(frontmatter, /grade_method: "static-read"/);
  assert.match(frontmatter, /grade_scope: "an arithmetic roll-up of model-assigned/);
  assert.ok(frontmatter.includes('verdict:') && frontmatter.includes('grade_method:'));

  // The basis is a coarse ordinal word, never a count that would launder
  // self-assigned labels into a hard-looking statistic.
  assert.match(frontmatter, /evidence_basis: "mostly Certain"/);
  assert.doesNotMatch(mdx, /\d+ of \d+ Certain/);
});

test('SARIF scopes its run as a static read rather than a measured detection rate', () => {
  const compiled = compileAudit(validAudit()).audit;
  const properties = auditToSarif(compiled).runs[0].properties;
  assert.strictEqual(properties.grade_method, 'static-read');
  assert.match(properties.grade_scope, /not a test result, scan, or certification/);
  assert.match(properties.confidence_basis, /not a measured detection rate/);
});

test('standards coverage reports control-evidence readiness and never certification', () => {
  const audit = validAudit();
  audit.standards = [{
    framework: 'gdpr',
    category: 'art-32',
    title: 'Security of processing',
    status: 'fail',
    checks: ['A-SEC-3'],
    evidence: ['E-1'],
    finding_ids: ['F-SEC-1']
  }];
  const { audit: compiled, errors } = compileAudit(audit);
  assert.deepStrictEqual(errors, []);
  const mdx = renderAudit(compiled);
  assert.match(mdx, /Control-evidence readiness, not certification\./);
  assert.match(mdx, /They do not evidence the organizational and process controls/);
  assert.match(mdx, /\| Framework \| Category \| Control-evidence readiness \|/);
  assert.doesNotMatch(mdx, /\| Framework \| Category \| Disposition \|/);
  // The framework name must never render next to a bare certification word.
  assert.doesNotMatch(mdx, /gdpr[^|]*\| *(certified|compliant)\b/i);
});

test('the compliance gate reads as a policy screen, not a legal determination', () => {
  const mdx = renderAudit(compileAudit(validAudit()).audit);
  assert.match(mdx, /This is a policy-allowability screen, not a legal-compliance determination\./);
});

test('the overall evidence basis is pooled on the same weighting as the grade', () => {
  // A light domain must not outvote a heavy one on what the grade rests on.
  // security carries weight 15 and is entirely Tentative; seo carries 3 and is
  // Certain. Pooling raw check weights would report "mostly Certain" over a
  // grade resting mostly on Tentative reads.
  const audit = validAudit();
  audit.domains[0].checks.forEach((check) => { check.confidence = 'Tentative'; });
  audit.domains[0].checks[1].evidence = ['E-2'];
  const seo = audit.domains.find((domain) => domain.id === 'seo');
  seo.status = 'applicable';
  seo.reason = 'public crawlable surface';
  seo.checks = [{ id: 'A-SEO-1', outcome: 'pass', confidence: 'Certain', weight: 100, evidence: ['E-1', 'E-2'], finding_ids: [] }];

  const { audit: compiled, errors } = compileAudit(audit);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(compiled.computed.domains.security.evidence_basis, 'mostly Tentative');
  assert.strictEqual(compiled.computed.domains.seo.evidence_basis, 'mostly Certain');
  assert.strictEqual(compiled.computed.overall.evidence_basis, 'mostly Tentative');
});

test('evidence basis is a coarse ordinal driven by a plain majority, not a tuned coefficient', () => {
  assert.strictEqual(evidenceBasis({}), 'none');
  assert.strictEqual(evidenceBasis({ Certain: 60, Firm: 40 }), 'mostly Certain');
  assert.strictEqual(evidenceBasis({ Tentative: 80, Certain: 20 }), 'mostly Tentative');
  // Exactly half is not a majority, so it reports mixed rather than rounding up.
  assert.strictEqual(evidenceBasis({ Certain: 50, Firm: 50 }), 'mixed');
  assert.strictEqual(evidenceBasis({ Certain: 34, Firm: 33, Tentative: 33 }), 'mixed');
});

test('renderer escapes MDX expressions and JSX from authored fields', () => {
  const audit = validAudit();
  audit.findings[0].title = 'Unsafe {expression} <Component />';
  audit.tasks[0].title = 'Fix [link] <Widget />';
  const mdx = renderAudit(compileAudit(audit).audit);
  assert.doesNotMatch(mdx, /Unsafe \{expression\} <Component/);
  assert.doesNotMatch(mdx, /Fix \[link\] <Widget/);
  assert.match(mdx, /Unsafe &#123;expression&#125; &lt;Component \/&gt;/);
});

test('renderer quotes YAML and includes assumptions plus complete evidence', () => {
  const audit = validAudit();
  audit.audit.archetype = 'API: service';
  audit.audit.assumptions = ['The fixture represents a multi-tenant service.'];
  const mdx = renderAudit(compileAudit(audit).audit);
  assert.match(mdx, /archetype: "API: service"/);
  assert.match(mdx, /Assumptions: The fixture represents a multi-tenant service\./);
  assert.match(mdx, /## Evidence ledger/);
  assert.match(mdx, /\| E-2 \| source \| src\/router\.js:4 \|/);
  assert.match(mdx, /bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
});

test('compiler rejects stale hand-authored computed state unless rewrite is explicit', () => {
  const initial = compileAudit(validAudit()).audit;
  initial.computed.overall.score = 99;
  const rejected = compileAudit(initial);
  assert.ok(rejected.errors.some((error) => error.includes('computed state is stale')));
  const rewritten = compileAudit(initial, { allowDerivedRewrite: true });
  assert.deepEqual(rewritten.errors, []);
  assert.equal(rewritten.audit.computed.overall.score, 40);
});
