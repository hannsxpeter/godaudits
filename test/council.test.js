'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applyCouncil,
  checkCitation,
  fingerprint,
  planCouncil,
  renderCouncil,
  sha256Hex,
  triageCouncil,
  validateLedger
} = require('../skills/godaudits/runtime/lib/council');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { validAudit } = require('./helpers');

const fixtures = path.join(__dirname, 'fixtures', 'council');
const schemaDirectory = path.join(__dirname, '..', 'skills', 'godaudits', 'schemas');

// A fresh working copy of the fixture repository and audit per test, so a test
// can add symlinks or change the audit without touching the committed fixture.
function sandbox(t, { council = true, mutate } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'godaudits-council-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'repo');
  fs.cpSync(path.join(fixtures, 'repo'), repo, { recursive: true });
  const audit = JSON.parse(fs.readFileSync(path.join(fixtures, 'audit.json'), 'utf8'));
  if (!council) audit.audit.capabilities = ['static'];
  if (mutate) mutate(audit);
  const bytes = `${JSON.stringify(audit, null, 2)}\n`;
  return { dir, repo, audit, bytes, hash: sha256Hex(bytes) };
}

const GUARD = { path: 'src/repo.js', line: 2, quote: 'return { ...query, tenant };' };
const SEATS = [['claude-code', 'anthropic'], ['codex', 'openai'], ['antigravity', 'google']];

function verdicts(overrides = {}) {
  return ['F-SEC-1', 'F-SEC-9'].map((finding) => overrides[finding] || { finding, outcome: 'no-refutation', guard: null, note: null });
}

function answer(box, harness, provider, extra = {}) {
  return {
    round: 1,
    audit_sha256: box.hash,
    seat: { harness, provider, model: `${harness}-model`, effort: 'high' },
    score: null,
    verdicts: verdicts(),
    objections: [],
    ...extra
  };
}

function trio(box, extras = {}) {
  return SEATS.map(([harness, provider]) => answer(box, harness, provider, extras[harness] || {}));
}

function apply(box, responses, ledger = null, options = {}) {
  return applyCouncil(box.audit, responses, { auditSha256: box.hash, ledger, repoRoot: box.repo, ...options });
}

function refuted(finding = 'F-SEC-1', guard = GUARD) {
  return { finding, outcome: 'refuted', guard, note: 'A repository layer injects the tenant.' };
}

function decide(ledger, status, reason = 'Ruled on by the lead.') {
  return ledger.rounds[ledger.rounds.length - 1].objections
    .filter((objection) => objection.status === 'open')
    .map((objection) => ({ objection: objection.id, status, reason }));
}

function latestOf(ledger) {
  return ledger.rounds[ledger.rounds.length - 1];
}

// ---------------------------------------------------------------------------
// Capability and plan
// ---------------------------------------------------------------------------

test('plan and apply refuse an audit that does not carry the council capability', (t) => {
  const box = sandbox(t, { council: false });
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash }), /does not include "council"/);
  assert.throws(() => apply(box, trio(box)), /does not include "council"/);
});

test('the council capability is accepted by the audit compiler', () => {
  const audit = validAudit();
  audit.audit.capabilities = ['static', 'council'];
  assert.deepEqual(compileAudit(audit).errors, []);
  audit.audit.capabilities = ['static', 'telepathy'];
  assert.ok(compileAudit(audit).errors.some((error) => /invalid audit capability: telepathy/.test(error)));
});

test('plan emits a round 1 packet with briefs, the audit hash, and the response contract', (t) => {
  const box = sandbox(t);
  const packet = planCouncil(box.audit, { auditSha256: box.hash });
  assert.equal(packet.round, 1);
  assert.equal(packet.max_rounds, 3);
  assert.equal(packet.min_seats, 3);
  assert.equal(packet.commit, 'abc1234');
  assert.equal(packet.audit_sha256, box.hash);
  // Reused from planRefutations: open Critical and High findings only.
  assert.deepEqual(packet.required_verdicts, ['F-SEC-1', 'F-SEC-9']);
  assert.deepEqual(packet.briefs.map((brief) => brief.finding), ['F-SEC-1', 'F-SEC-9']);
  assert.equal('impact' in packet.briefs[0], false);
  assert.deepEqual(packet.dismissed_objections, []);
  assert.equal(packet.response_contract.audit_sha256, box.hash);
  assert.match(packet.response_contract.path, /ROUND-<round>-<harness>\.json/);
  const text = packet.instructions.join(' ');
  assert.match(text, /read-only/);
  assert.match(text, /before you read the AUDIT\.mdx narrative/);
  assert.match(text, /grades how good the audit is, not the codebase/);
});

test('plan is bound to the audit bytes: the hash must be supplied', (t) => {
  const box = sandbox(t);
  assert.throws(() => planCouncil(box.audit, {}), /SHA-256/);
});

test('council never mutates the audit object', (t) => {
  const box = sandbox(t);
  const before = JSON.stringify(box.audit);
  planCouncil(box.audit, { auditSha256: box.hash });
  apply(box, trio(box));
  assert.equal(JSON.stringify(box.audit), before);
});

// ---------------------------------------------------------------------------
// Response rejection
// ---------------------------------------------------------------------------

test('a response with a stale audit hash is rejected', (t) => {
  const box = sandbox(t);
  const responses = trio(box);
  responses[1].audit_sha256 = 'f'.repeat(64);
  assert.throws(() => apply(box, responses), /audit_sha256 does not match the AUDIT\.json given/);
});

test('seat harness, provider, and model are required strings', (t) => {
  const box = sandbox(t);
  for (const field of ['harness', 'provider', 'model']) {
    const responses = trio(box);
    responses[0].seat[field] = '';
    assert.throws(() => apply(box, responses), new RegExp(`seat\\.${field} is required`), field);
  }
  const responses = trio(box);
  delete responses[0].seat;
  assert.throws(() => apply(box, responses), /seat must be an object/);
});

test('a malformed score, outcome, or objection kind is rejected', (t) => {
  const box = sandbox(t);
  let responses = trio(box);
  responses[0].score = 101;
  assert.throws(() => apply(box, responses), /score must be an integer from 0 to 100/);
  responses = trio(box);
  responses[0].verdicts[0].outcome = 'agreed';
  assert.throws(() => apply(box, responses), /outcome must be one of/);
  responses = trio(box);
  responses[0].objections = [{ kind: 'nit', target: 'F-SEC-1', claim: 'x', citation: null }];
  assert.throws(() => apply(box, responses), /kind must be one of/);
  responses = trio(box);
  responses[0].verdicts.push({ ...responses[0].verdicts[0] });
  assert.throws(() => apply(box, responses), /repeats a verdict for F-SEC-1/);
});

test('a duplicate harness within a round is rejected, in one call and across calls', (t) => {
  const box = sandbox(t);
  const dupes = [answer(box, 'codex', 'openai'), answer(box, 'Codex ', 'openai')];
  assert.throws(() => apply(box, dupes), /already has a seat in round 1/);
  const ledger = apply(box, [answer(box, 'codex', 'openai')]);
  assert.throws(() => apply(box, [answer(box, 'codex', 'openai')], ledger), /harness codex already has a seat in round 1/);
});

test('an apply with no responses, or no repository, is refused', (t) => {
  const box = sandbox(t);
  assert.throws(() => apply(box, []), /at least one RESPONSE/);
  assert.throws(() => apply(box, trio(box), null, { repoRoot: undefined }), /requires --repo/);
  assert.throws(() => apply(box, trio(box), null, { repoRoot: path.join(box.dir, 'nope') }), /does not exist/);
});

// ---------------------------------------------------------------------------
// Round sequencing
// ---------------------------------------------------------------------------

test('round numbers must be the latest untriaged round or the next one', (t) => {
  const box = sandbox(t);
  // Without a ledger only round 1 exists.
  assert.throws(() => apply(box, trio(box).map((r) => ({ ...r, round: 2 }))), /first round must be 1/);
  assert.throws(() => apply(box, trio(box).map((r) => ({ ...r, round: 4 }))), /exceeds the 3-round cap/);

  // Round 1 with an open objection: its seats can still be added, round 2 cannot start.
  let ledger = apply(box, [answer(box, 'claude-code', 'anthropic', { verdicts: verdicts({ 'F-SEC-1': refuted() }) })]);
  assert.equal(latestOf(ledger).objections.length, 1);
  ledger = apply(box, [answer(box, 'codex', 'openai')], ledger);
  assert.equal(latestOf(ledger).seats.length, 2);
  assert.throws(() => apply(box, [answer(box, 'antigravity', 'google', { round: 2 })], ledger), /untriaged objection; run council triage before round 2/);
  assert.throws(() => apply(box, [answer(box, 'antigravity', 'google', { round: 3 })], ledger), /neither the latest untriaged round/);
  ledger = apply(box, [answer(box, 'antigravity', 'google')], ledger);
  assert.equal(latestOf(ledger).complete, true);

  // After triage round 1 is closed: it takes no more seats, and round 2 opens.
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  assert.throws(() => apply(box, [answer(box, 'cursor', 'unknown')], ledger), /round 1 is already triaged and closed/);
  const second = apply(box, trio(box).map((r) => ({ ...r, round: 2 })), ledger);
  assert.equal(second.rounds.length, 2);
  assert.equal(latestOf(second).round, 2);
});

test('apply takes one round at a time', (t) => {
  const box = sandbox(t);
  const responses = trio(box);
  responses[2].round = 2;
  assert.throws(() => apply(box, responses), /apply one round at a time/);
});

test('seats cannot join an open round after the audit changed', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, [answer(box, 'codex', 'openai')]);
  const changed = sandbox(t, { mutate: (audit) => { audit.audit.commit = 'def5678'; } });
  assert.notEqual(changed.hash, box.hash);
  assert.throws(
    () => applyCouncil(changed.audit, [answer(changed, 'claude-code', 'anthropic')], { auditSha256: changed.hash, ledger, repoRoot: changed.repo }),
    /AUDIT\.json changed since round 1 began/
  );
});

test('plan numbers the next round from the ledger and refuses while objections are untriaged', (t) => {
  const box = sandbox(t);
  let ledger = apply(box, trio(box, { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } }));
  assert.equal(ledger.status, 'needs-triage');
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash, ledger }), /1 untriaged objection\. Run council triage first/);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  assert.equal(ledger.status, 'continue');
  const packet = planCouncil(box.audit, { auditSha256: box.hash, ledger });
  assert.equal(packet.round, 2);
});

test('plan refuses a converged or capped ledger', (t) => {
  const box = sandbox(t);
  const converged = apply(box, trio(box));
  assert.equal(converged.status, 'converged');
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash, ledger: converged }), /has converged/);
  assert.throws(() => apply(box, trio(box).map((r) => ({ ...r, round: 2 })), converged), /the ledger is converged/);
});

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

function citationLedger(box, citation) {
  const ledger = apply(box, trio(box, {
    codex: { objections: [{ kind: 'missed', target: 'A-SEC-4', claim: 'Authorization is skipped.', citation }] }
  }));
  return latestOf(ledger).objections[0];
}

test('a citation that exists passes and records the file hash', (t) => {
  const box = sandbox(t);
  const objection = citationLedger(box, { path: 'src/router.js', line: 5, quote: 'router.use(authorize);' });
  assert.equal(objection.status, 'open');
  assert.equal(objection.citation.verified, true);
  assert.equal(objection.citation.path, 'src/router.js');
  assert.equal(objection.citation.sha256, sha256Hex(fs.readFileSync(path.join(box.repo, 'src/router.js'))));
  assert.equal(objection.fingerprint, 'missed|A-SEC-4|src/router.js:5');
});

test('the quote is whitespace-normalized and may span lines', (t) => {
  const box = sandbox(t);
  const objection = citationLedger(box, { path: 'src/repo.js', line: 1, quote: 'function   scoped(query, tenant) {\n  return { ...query,   tenant };' });
  assert.equal(objection.status, 'open');
});

test('the quote must sit within 3 lines of the cited line', (t) => {
  const box = sandbox(t);
  const repository = { root: fs.realpathSync(box.repo), files: new Map() };
  const quote = 'const l5 = 5;';
  assert.equal(checkCitation({ path: 'src/window.js', line: 2, quote }, repository).ok, true);
  assert.equal(checkCitation({ path: 'src/window.js', line: 8, quote }, repository).ok, true);
  const far = checkCitation({ path: 'src/window.js', line: 1, quote }, repository);
  assert.equal(far.ok, false);
  assert.match(far.error, /not found within 3 lines of src\/window\.js:1/);
  assert.match(far.sha256, /^[a-f0-9]{64}$/);
  assert.equal(checkCitation({ path: 'src/window.js', line: 9, quote }, repository).ok, false);
  assert.match(checkCitation({ path: 'src/window.js', line: 99, quote }, repository).error, /past the end of the file/);
});

test('a failed citation is recorded as citation-failed and can never be accepted', (t) => {
  const box = sandbox(t);
  const objection = citationLedger(box, { path: 'src/router.js', line: 5, quote: 'router.use(somethingElse);' });
  assert.equal(objection.status, 'citation-failed');
  assert.equal(objection.citation.verified, false);
  assert.match(objection.citation_error, /quote not found/);
});

test('absolute paths, .. segments, missing files, and backslashes fail the citation', (t) => {
  const box = sandbox(t);
  const repository = { root: fs.realpathSync(box.repo), files: new Map() };
  const quote = 'x';
  const cases = [
    [path.join(box.repo, 'src/router.js'), /not absolute/],
    ['/etc/hosts', /not absolute/],
    ['C:/Windows/win.ini', /not absolute/],
    ['../outside.txt', /escapes the repository/],
    ['src/../../outside.txt', /escapes the repository/],
    ['src\\router.js', /forward slashes/],
    ['src/nope.js', /does not exist/],
    ['src', /not a regular file/]
  ];
  for (const [cited, pattern] of cases) {
    const result = checkCitation({ path: cited, line: 1, quote }, repository);
    assert.equal(result.ok, false, cited);
    assert.match(result.error, pattern, cited);
  }
  assert.match(checkCitation({ path: 'src/router.js', line: 0, quote }, repository).error, /positive integer/);
  assert.match(checkCitation({ path: 'src/router.js', line: 1, quote: '   ' }, repository).error, /quote is missing/);
  assert.match(checkCitation(null, repository).error, /citation is missing/);
});

test('a symlink that resolves outside the repository fails the citation', (t) => {
  const box = sandbox(t);
  const outside = path.join(box.dir, 'outside.txt');
  fs.writeFileSync(outside, 'router.use(authorize);\n');
  fs.symlinkSync(outside, path.join(box.repo, 'src', 'link.js'));
  fs.symlinkSync(box.dir, path.join(box.repo, 'src', 'dir-link'));
  const repository = { root: fs.realpathSync(box.repo), files: new Map() };
  const direct = checkCitation({ path: 'src/link.js', line: 1, quote: 'router.use(authorize);' }, repository);
  assert.equal(direct.ok, false);
  assert.match(direct.error, /resolves outside the repository/);
  const viaDirectory = checkCitation({ path: 'src/dir-link/outside.txt', line: 1, quote: 'router.use(authorize);' }, repository);
  assert.equal(viaDirectory.ok, false);
  assert.match(viaDirectory.error, /resolves outside the repository/);
  // A symlink that stays inside the repository is fine.
  fs.symlinkSync(path.join(box.repo, 'src', 'router.js'), path.join(box.repo, 'src', 'inside.js'));
  assert.equal(checkCitation({ path: 'src/inside.js', line: 5, quote: 'router.use(authorize);' }, repository).ok, true);
});

test('refute, weaken, and missed need a citation; evidence does not', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: {
      objections: [
        { kind: 'refute', target: 'F-SEC-1', claim: 'No guard cited.', citation: null },
        { kind: 'weaken', target: 'F-SEC-9', claim: 'No guard cited either.', citation: null },
        { kind: 'missed', target: 'A-SEC-4', claim: 'Nothing cited.', citation: null },
        { kind: 'evidence', target: 'F-SEC-1', claim: 'The quote is stale.', citation: null }
      ]
    }
  }));
  const byKind = Object.fromEntries(latestOf(ledger).objections.map((objection) => [objection.kind, objection]));
  assert.equal(byKind.refute.status, 'citation-failed');
  assert.equal(byKind.weaken.status, 'citation-failed');
  assert.equal(byKind.missed.status, 'citation-failed');
  assert.match(byKind.missed.citation_error, /citation is required/);
  assert.equal(byKind.evidence.status, 'open');
  assert.equal(byKind.evidence.fingerprint, 'evidence|F-SEC-1');
});

test('a refuted verdict without a verifiable guard becomes a citation-failed objection', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: { verdicts: verdicts({ 'F-SEC-1': { finding: 'F-SEC-1', outcome: 'refuted', guard: null, note: 'Trust me.' } }) }
  }));
  const [objection] = latestOf(ledger).objections;
  assert.equal(objection.status, 'citation-failed');
  assert.equal(objection.kind, 'refute');
  // An unverified challenge stays visible but does not count (see the regression tests below).
  const entry = latestOf(ledger).tally.find((item) => item.finding === 'F-SEC-1');
  assert.equal(entry.result, 'standing');
  assert.equal(entry.seats.find((seat) => seat.harness === 'codex').guard_verified, false);
});

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

test('quotes, claims, notes, and decision reasons are redacted before they reach the ledger', (t) => {
  const box = sandbox(t);
  const secret = `ghp_${'a1B2c3D4e5'.repeat(3)}`;
  fs.writeFileSync(path.join(box.repo, 'src', 'config.js'), `const token = '${secret}';\n`);
  const ledger = apply(box, trio(box, {
    codex: {
      verdicts: verdicts({
        'F-SEC-1': {
          finding: 'F-SEC-1',
          outcome: 'refuted',
          guard: { path: 'src/config.js', line: 1, quote: `const token = '${secret}';` },
          note: `The token ${secret} is rotated.`
        }
      }),
      objections: [{ kind: 'evidence', target: 'F-SEC-9', claim: `password = hunter2hunter2 and ${secret}`, citation: null }]
    }
  }));
  const text = JSON.stringify(ledger);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes('hunter2hunter2'), false);
  assert.match(text, /<redacted:[a-f0-9]{12}>/);
  // The quote still verified against the raw file before it was redacted.
  const guarded = latestOf(ledger).objections.find((objection) => objection.kind === 'refute');
  assert.equal(guarded.citation.verified, true);
  assert.equal(guarded.status, 'open');
  const triaged = triageCouncil(ledger, decide(ledger, 'dismissed', `Rotated; the old token ${secret} is dead.`));
  assert.equal(JSON.stringify(triaged).includes(secret), false);
});

// ---------------------------------------------------------------------------
// Verdicts, objections, merging
// ---------------------------------------------------------------------------

test('a refuted or weakened verdict becomes a refute or weaken objection with its guard as the citation', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) },
    antigravity: { verdicts: verdicts({ 'F-SEC-9': { finding: 'F-SEC-9', outcome: 'weakened', guard: { path: 'src/router.js', line: 5, quote: 'router.use(authorize);' }, note: 'Holds only for the primary router.' } }) }
  }));
  const objections = latestOf(ledger).objections;
  assert.equal(objections.length, 2);
  const refute = objections.find((objection) => objection.kind === 'refute');
  assert.equal(refute.target, 'F-SEC-1');
  assert.equal(refute.status, 'open');
  assert.deepEqual(refute.raised_by, ['codex']);
  assert.equal(refute.citation.path, 'src/repo.js');
  assert.equal(refute.citation.line, 2);
  assert.equal(refute.claim, 'A repository layer injects the tenant.');
  const weaken = objections.find((objection) => objection.kind === 'weaken');
  assert.equal(weaken.target, 'F-SEC-9');
  assert.deepEqual(weaken.raised_by, ['antigravity']);
});

test('the same fingerprint from several seats in one round merges into one objection', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    'claude-code': { verdicts: verdicts({ 'F-SEC-1': refuted() }) },
    codex: {
      verdicts: verdicts({ 'F-SEC-1': refuted() }),
      objections: [{ kind: 'refute', target: 'F-SEC-1', claim: 'Same guard again.', citation: GUARD }]
    },
    antigravity: { verdicts: verdicts({ 'F-SEC-1': refuted('F-SEC-1', { path: 'src/repo.js', line: 1, quote: 'function scoped(query, tenant) {' }) }) }
  }));
  const objections = latestOf(ledger).objections;
  // Two distinct fingerprints: src/repo.js:2 (two seats) and src/repo.js:1 (one seat).
  assert.equal(objections.length, 2);
  const merged = objections.find((objection) => objection.fingerprint === 'refute|F-SEC-1|src/repo.js:2');
  assert.deepEqual(merged.raised_by, ['claude-code', 'codex']);
  assert.equal(merged.claims.length, 2);
  const single = objections.find((objection) => objection.fingerprint === 'refute|F-SEC-1|src/repo.js:1');
  assert.deepEqual(single.raised_by, ['antigravity']);
});

test('objection ids stay stable when a seat is added to the open round', (t) => {
  const box = sandbox(t);
  let ledger = apply(box, [answer(box, 'codex', 'openai', { verdicts: verdicts({ 'F-SEC-1': refuted() }) })]);
  const before = latestOf(ledger).objections[0].id;
  ledger = apply(box, [answer(box, 'claude-code', 'anthropic', { verdicts: verdicts({ 'F-SEC-9': { finding: 'F-SEC-9', outcome: 'weakened', guard: GUARD, note: 'n' } }) })], ledger);
  const ids = latestOf(ledger).objections.map((objection) => `${objection.id}:${objection.kind}`);
  assert.equal(latestOf(ledger).objections.find((objection) => objection.kind === 'refute').id, before);
  assert.equal(new Set(ids).size, 2);
});

test('targets must exist: unknown ids are rejected-target, check ids come from the ledger or catalog', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: {
      verdicts: [...verdicts(), { finding: 'F-NOPE-1', outcome: 'refuted', guard: GUARD, note: 'Phantom finding.' }],
      objections: [
        { kind: 'missed', target: 'A-SEC-4', claim: 'Known check from the ledger.', citation: GUARD },
        { kind: 'missed', target: 'A-LLM-1', claim: 'Known check only in the catalog.', citation: GUARD },
        { kind: 'missed', target: 'A-NOPE-99', claim: 'Unknown check.', citation: GUARD }
      ]
    }
  }), null, { checkIds: ['A-LLM-1'] });
  const byTarget = Object.fromEntries(latestOf(ledger).objections.map((objection) => [objection.target, objection]));
  assert.equal(byTarget['A-SEC-4'].status, 'open');
  assert.equal(byTarget['A-LLM-1'].status, 'open');
  assert.equal(byTarget['A-NOPE-99'].status, 'rejected-target');
  assert.equal(byTarget['F-NOPE-1'].status, 'rejected-target');
  // Rejected targets never reach the finding tally.
  assert.equal(latestOf(ledger).tally.some((entry) => entry.finding === 'F-NOPE-1'), false);
  // A no-refutation verdict for an unknown finding is ignored with a warning.
  const quiet = apply(box, trio(box, { codex: { verdicts: [...verdicts(), { finding: 'F-NOPE-2', outcome: 'no-refutation', guard: null, note: null }] } }));
  assert.ok(quiet.warnings.some((warning) => warning.code === 'ignored-verdict' && /F-NOPE-2/.test(warning.message)));
  assert.equal(quiet.status, 'converged');
});

test('fingerprint is kind + target + path:line, or kind + target without a citation', () => {
  assert.equal(fingerprint('refute', 'F-1', { path: './src/a.js', line: 4 }), 'refute|F-1|src/a.js:4');
  assert.equal(fingerprint('evidence', 'F-1', null), 'evidence|F-1');
});

// ---------------------------------------------------------------------------
// Completeness, providers, tally
// ---------------------------------------------------------------------------

test('fewer than 3 distinct harnesses leaves the round incomplete and unable to converge', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box).slice(0, 2));
  assert.equal(latestOf(ledger).complete, false);
  assert.equal(ledger.status, 'incomplete');
  assert.match(latestOf(ledger).incomplete_reasons[0], /2 distinct harnesses; 3 are required/);
  // The third seat completes it, and it converges because nothing was raised.
  const done = apply(box, [trio(box)[2]], ledger);
  assert.equal(done.status, 'converged');
});

test('a seat missing a verdict for any brief makes the round incomplete: silence is not agreement', (t) => {
  const box = sandbox(t);
  const responses = trio(box);
  responses[1].verdicts = responses[1].verdicts.slice(0, 1);
  const ledger = apply(box, responses);
  assert.equal(ledger.status, 'incomplete');
  assert.deepEqual(latestOf(ledger).seats.find((seat) => seat.harness === 'codex').missing_verdicts, ['F-SEC-9']);
  assert.match(latestOf(ledger).incomplete_reasons.join(' '), /seat codex has no verdict for F-SEC-9/);
  assert.equal(latestOf(ledger).tally.find((entry) => entry.finding === 'F-SEC-9').unanswered_by[0], 'codex');
});

test('fewer than 3 distinct providers adds a reduced-decorrelation warning; unknown allowed but not counted', (t) => {
  const box = sandbox(t);
  const same = apply(box, [
    answer(box, 'claude-code', 'anthropic'),
    answer(box, 'codex', 'openai'),
    answer(box, 'cursor', 'unknown')
  ]);
  assert.equal(same.status, 'converged');
  assert.deepEqual(same.warnings.map((warning) => warning.code), ['reduced-decorrelation']);
  assert.match(same.warnings[0].message, /2 distinct known providers/);

  const diverse = apply(box, trio(box));
  assert.deepEqual(diverse.warnings, []);

  const doubled = apply(box, [
    answer(box, 'claude-code', 'anthropic'),
    answer(box, 'codex', 'anthropic'),
    answer(box, 'antigravity', 'google')
  ]);
  assert.equal(doubled.warnings[0].code, 'reduced-decorrelation');
});

test('the tally marks standing, contested, and challenged findings and caps confidence at Firm', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    'claude-code': { verdicts: verdicts({ 'F-SEC-1': refuted(), 'F-SEC-9': { finding: 'F-SEC-9', outcome: 'weakened', guard: GUARD, note: 'n' } }) },
    codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) },
    antigravity: { verdicts: verdicts({ 'F-SEC-1': { finding: 'F-SEC-1', outcome: 'weakened', guard: GUARD, note: 'n' } }) }
  }));
  const tally = Object.fromEntries(latestOf(ledger).tally.map((entry) => [entry.finding, entry]));
  assert.equal(tally['F-SEC-1'].result, 'challenged');
  assert.equal(tally['F-SEC-1'].confidence_ceiling, 'Firm');
  assert.equal(tally['F-SEC-9'].result, 'contested');
  assert.equal(tally['F-SEC-9'].confidence_ceiling, 'Firm');

  const calm = apply(box, trio(box));
  for (const entry of latestOf(calm).tally) {
    assert.equal(entry.result, 'standing');
    // Unanimous agreement adds no evidence and changes nothing.
    assert.equal(entry.confidence_ceiling, null);
  }
});

// ---------------------------------------------------------------------------
// Triage, repeat-dismissed, status transitions
// ---------------------------------------------------------------------------

test('triage requires a one-line reason for dismissed and a decision for every open objection', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: {
      verdicts: verdicts({ 'F-SEC-1': refuted() }),
      objections: [{ kind: 'evidence', target: 'F-SEC-9', claim: 'Stale quote.', citation: null }]
    }
  }));
  const [first, second] = latestOf(ledger).objections;
  assert.throws(() => triageCouncil(ledger, [{ objection: first.id, status: 'dismissed', reason: '' }, { objection: second.id, status: 'accepted' }]), /requires a one-line reason/);
  assert.throws(() => triageCouncil(ledger, [{ objection: first.id, status: 'dismissed', reason: 'one\ntwo' }, { objection: second.id, status: 'accepted' }]), /must be one line/);
  assert.throws(() => triageCouncil(ledger, [{ objection: first.id, status: 'accepted' }]), /open objections without a decision: O-1-2/);
  assert.throws(() => triageCouncil(ledger, [{ objection: first.id, status: 'maybe' }, { objection: second.id, status: 'accepted' }]), /status must be accepted or dismissed/);
  assert.throws(() => triageCouncil(ledger, [{ objection: 'O-1-99', status: 'accepted' }]), /not in round 1/);
  assert.throws(() => triageCouncil(ledger, [{ objection: first.id, status: 'accepted' }, { objection: first.id, status: 'accepted' }, { objection: second.id, status: 'accepted' }]), /decided twice/);
  assert.throws(() => triageCouncil(ledger, { nope: true }), /array of/);

  const done = triageCouncil(ledger, [
    { objection: first.id, status: 'accepted' },
    { objection: second.id, status: 'dismissed', reason: 'The quote is current.' }
  ]);
  const closed = latestOf(done);
  assert.equal(closed.triaged, true);
  assert.equal(closed.objections.find((objection) => objection.id === first.id).status, 'accepted');
  assert.deepEqual(closed.objections.find((objection) => objection.id === second.id).decision, { status: 'dismissed', reason: 'The quote is current.' });
  // The input ledger is untouched.
  assert.equal(latestOf(ledger).triaged, false);
  assert.throws(() => triageCouncil(done, []), /already triaged/);
});

test('triage refuses to accept a citation-failed or rejected-target objection, and ignores them otherwise', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: {
      objections: [
        { kind: 'missed', target: 'A-SEC-4', claim: 'Bad quote.', citation: { path: 'src/router.js', line: 5, quote: 'nope nope' } },
        { kind: 'evidence', target: 'F-NOPE-1', claim: 'Unknown finding.', citation: null },
        { kind: 'evidence', target: 'F-SEC-1', claim: 'Real one.', citation: null }
      ]
    }
  }));
  const objections = latestOf(ledger).objections;
  const failed = objections.find((objection) => objection.status === 'citation-failed');
  const rejected = objections.find((objection) => objection.status === 'rejected-target');
  const real = objections.find((objection) => objection.status === 'open');
  assert.throws(() => triageCouncil(ledger, [{ objection: failed.id, status: 'accepted' }, { objection: real.id, status: 'accepted' }]), /is citation-failed and cannot be accepted/);
  assert.throws(() => triageCouncil(ledger, [{ objection: rejected.id, status: 'accepted' }, { objection: real.id, status: 'accepted' }]), /is rejected-target and cannot be accepted/);
  // Only the one open objection needs a decision.
  const done = triageCouncil(ledger, [{ objection: real.id, status: 'dismissed', reason: 'Not a defect.' }]);
  assert.equal(done.status, 'converged');
});

test('triage with nothing open is refused', (t) => {
  const box = sandbox(t);
  assert.throws(() => triageCouncil(apply(box, trio(box)), []), /no open objections/);
});

test('an objection dismissed in an earlier round is repeat-dismissed and does not block convergence', (t) => {
  const box = sandbox(t);
  const raised = { 'claude-code': { verdicts: verdicts({ 'F-SEC-1': refuted() }) } };
  let ledger = apply(box, trio(box, raised));
  ledger = triageCouncil(ledger, decide(ledger, 'dismissed', 'The repository layer scopes the query.'));
  // Dismissing everything in a complete round converges it.
  assert.equal(ledger.status, 'converged');

  // A fresh ledger where round 1 dismissed one thing but accepted another.
  ledger = apply(box, trio(box, {
    'claude-code': { verdicts: verdicts({ 'F-SEC-1': refuted() }) },
    codex: { objections: [{ kind: 'evidence', target: 'F-SEC-9', claim: 'Stale.', citation: null }] }
  }));
  const [refute, evidence] = latestOf(ledger).objections;
  ledger = triageCouncil(ledger, [
    { objection: refute.id, status: 'dismissed', reason: 'Guarded in src/repo.js.' },
    { objection: evidence.id, status: 'accepted' }
  ]);
  assert.equal(ledger.status, 'continue');

  const packet = planCouncil(box.audit, { auditSha256: box.hash, ledger });
  assert.equal(packet.dismissed_objections.length, 1);
  assert.equal(packet.dismissed_objections[0].fingerprint, refute.fingerprint);
  assert.equal(packet.dismissed_objections[0].reason, 'Guarded in src/repo.js.');

  const second = apply(box, trio(box, {
    antigravity: { verdicts: verdicts({ 'F-SEC-1': refuted() }) }
  }).map((r) => ({ ...r, round: 2 })), ledger);
  const repeated = latestOf(second).objections[0];
  assert.equal(repeated.status, 'repeat-dismissed');
  assert.deepEqual(repeated.repeat_of, { round: 1, objection: refute.id, reason: 'Guarded in src/repo.js.' });
  // Nothing open and nothing accepted: round 2 converges.
  assert.equal(second.status, 'converged');
});

test('status moves through needs-triage, continue, converged, incomplete, and round-cap', (t) => {
  const box = sandbox(t);
  const raise = { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } };

  // incomplete
  let ledger = apply(box, trio(box).slice(0, 1));
  assert.equal(ledger.status, 'incomplete');
  assert.deepEqual(ledger.remaining, []);

  // needs-triage
  ledger = apply(box, trio(box, raise).slice(1), ledger);
  assert.equal(ledger.status, 'needs-triage');
  assert.match(ledger.status_detail, /1 open objection/);

  // continue
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  assert.equal(ledger.status, 'continue');
  assert.equal(validateLedger(ledger).length, 0);

  // Round 2 raises something new and it is accepted again: still continue.
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 2 })), ledger);
  assert.equal(ledger.status, 'needs-triage');
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  assert.equal(ledger.status, 'continue');
  assert.equal(ledger.rounds.length, 2);

  // round-cap: the third triaged round without convergence.
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 3 })), ledger);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  assert.equal(ledger.status, 'round-cap');
  assert.equal(ledger.rounds.length, 3);
  assert.equal(ledger.remaining.length, 1);
  assert.equal(ledger.remaining[0].type, 'objection');
  assert.equal(ledger.remaining[0].status, 'accepted');
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash, ledger }), /3-round cap/);
  assert.throws(() => apply(box, trio(box).map((r) => ({ ...r, round: 4 })), ledger), /the ledger is round-cap/);
  assert.match(renderCouncil(ledger), /Remaining at the round cap/);
});

test('a third round that converges is converged, not round-cap', (t) => {
  const box = sandbox(t);
  const raise = { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } };
  let ledger = apply(box, trio(box, raise));
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 2 })), ledger);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box).map((r) => ({ ...r, round: 3 })), ledger);
  assert.equal(ledger.rounds.length, 3);
  assert.equal(ledger.status, 'converged');
});

test('an incomplete third round that is triaged is round-cap with the gap listed', (t) => {
  const box = sandbox(t);
  const raise = { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } };
  let ledger = apply(box, trio(box, raise));
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 2 })), ledger);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box, raise).slice(0, 2).map((r) => ({ ...r, round: 3 })), ledger);
  assert.equal(ledger.status, 'incomplete');
  ledger = triageCouncil(ledger, decide(ledger, 'dismissed'));
  assert.equal(ledger.status, 'round-cap');
  assert.ok(ledger.remaining.some((item) => item.type === 'incomplete'));
});

test('scores are recorded per seat and never feed status', (t) => {
  const box = sandbox(t);
  const low = apply(box, trio(box).map((r) => ({ ...r, score: 0 })));
  const high = apply(box, trio(box).map((r) => ({ ...r, score: 100 })));
  const none = apply(box, trio(box));
  for (const ledger of [low, high, none]) assert.equal(ledger.status, 'converged');
  assert.deepEqual(latestOf(low).seats.map((seat) => seat.score), [0, 0, 0]);
  assert.deepEqual(latestOf(none).seats.map((seat) => seat.score), [null, null, null]);

  // A glowing score does not rescue an incomplete round, and a bad one does not block convergence.
  const partial = trio(box).slice(0, 2).map((r) => ({ ...r, score: 100 }));
  assert.equal(apply(box, partial).status, 'incomplete');
  const raised = apply(box, trio(box, { codex: { score: 100, verdicts: verdicts({ 'F-SEC-1': refuted() }) } }));
  assert.equal(raised.status, 'needs-triage');
});

test('a hand-edited ledger status is detected', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } }));
  const tampered = JSON.parse(JSON.stringify(ledger));
  tampered.status = 'converged';
  assert.match(validateLedger(tampered).join(' '), /edited by hand/);
  assert.throws(() => triageCouncil(tampered, []), /invalid council ledger/);
  assert.throws(() => renderCouncil(tampered), /invalid council ledger/);
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash, ledger: tampered }), /invalid council ledger/);
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

test('render shows rounds, a seat-by-round table with scores or no score, the tally, objections, and the stop status', (t) => {
  const box = sandbox(t);
  let ledger = apply(box, trio(box, {
    'claude-code': { score: 82 },
    codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) }
  }));
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  const mdx = renderCouncil(ledger);
  assert.match(mdx, /^## Council review$/m);
  assert.match(mdx, /^Rounds: 1$/m);
  assert.match(mdx, /\| claude-code \| 82\/100 \|/);
  assert.match(mdx, /\| codex \| no score \|/);
  assert.match(mdx, /Scores grade the audit/);
  assert.match(mdx, /\| 1 \| F-SEC-1 \| contested \|/);
  assert.match(mdx, /\| 1 \| F-SEC-9 \| standing \|/);
  assert.match(mdx, /#### Accepted \(1\)/);
  assert.match(mdx, /raised by codex: A repository layer injects the tenant\./);
  assert.match(mdx, /### Stop status/);
  assert.match(mdx, /Status: continue\./);
  assert.match(mdx, /Firm/);
  assert.equal(/[^\x00-\x7F]/.test(mdx), false);
});

test('render with no scores at all reads no score for every seat and groups objections by status', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: {
      objections: [
        { kind: 'evidence', target: 'F-SEC-1', claim: 'Needs a second path.', citation: null },
        { kind: 'missed', target: 'A-SEC-4', claim: 'Bad quote.', citation: { path: 'src/router.js', line: 5, quote: 'no such text' } }
      ]
    }
  }));
  const mdx = renderCouncil(ledger);
  assert.equal((mdx.match(/no score/g) || []).length, 3);
  assert.equal(/\d+\/100/.test(mdx), false);
  assert.match(mdx, /#### Open \(1\)/);
  assert.match(mdx, /#### Citation failed \(1\)/);
  assert.match(mdx, /Citation: quote not found/);
  assert.match(mdx, /Status: needs-triage\./);

  const clean = renderCouncil(apply(box, trio(box)));
  assert.match(clean, /No objections were raised\./);
  assert.match(clean, /Status: converged\./);
});

test('render lists warnings and escapes MDX-significant characters in seat text', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, [
    answer(box, 'claude-code', 'anthropic'),
    answer(box, 'codex', 'openai', { objections: [{ kind: 'evidence', target: 'F-SEC-1', claim: 'Use <b>{x}</b> | y', citation: null }] }),
    answer(box, 'cursor', 'unknown')
  ]);
  const mdx = renderCouncil(ledger);
  assert.match(mdx, /reduced-decorrelation/);
  assert.match(mdx, /&lt;b&gt;&#123;x&#125;&lt;\/b&gt; &#124; y/);
  assert.equal(/<b>/.test(mdx), false);
});

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

// A small structural validator for the keywords these schemas use, so a drift
// between the hand-written runtime validation and the shipped schemas fails
// here instead of in a seat's strict structured-output call.
function conforms(schema, value, root, where, errors) {
  if (schema.$ref) return conforms(schema.$ref.split('/').slice(1).reduce((node, part) => node[part], root), value, root, where, errors);
  if (schema.anyOf) {
    if (!schema.anyOf.some((branch) => { const inner = []; conforms(branch, value, root, where, inner); return inner.length === 0; })) {
      errors.push(`${where} matches no anyOf branch`);
    }
    return undefined;
  }
  if ('const' in schema && value !== schema.const) errors.push(`${where} must equal ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where} must be one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(value, type))) { errors.push(`${where} must be ${types.join('|')}`); return undefined; }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${where} is too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where} does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${where} is below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${where} is above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${where} has too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${where} has too many items`);
    if (schema.items) value.forEach((item, index) => conforms(schema.items, item, root, `${where}[${index}]`, errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) if (!(required in value)) errors.push(`${where}.${required} is required`);
    for (const [name, child] of Object.entries(schema.properties || {})) if (name in value) conforms(child, value[name], root, `${where}.${name}`, errors);
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) if (!(name in (schema.properties || {}))) errors.push(`${where}.${name} is not allowed`);
    }
  }
  return undefined;
}

function strictShapeErrors(schema, where, errors) {
  if (schema.$ref) return;
  for (const branch of schema.anyOf || []) strictShapeErrors(branch, where, errors);
  if (schema.items) strictShapeErrors(schema.items, `${where}[]`, errors);
  if (schema.type === 'object' || (schema.properties && !schema.type)) {
    const names = Object.keys(schema.properties || {});
    if (schema.additionalProperties !== false) errors.push(`${where} must set additionalProperties false`);
    if (JSON.stringify([...(schema.required || [])].sort()) !== JSON.stringify([...names].sort())) errors.push(`${where} must require every property`);
    for (const name of names) strictShapeErrors(schema.properties[name], `${where}.${name}`, errors);
  }
  for (const keyword of ['minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'format', 'default']) {
    if (keyword in schema) errors.push(`${where} uses ${keyword}, which strict structured-output modes may reject`);
  }
}

test('the response schema is in strict structured-output shape', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, 'council-response.schema.json'), 'utf8'));
  const errors = [];
  strictShapeErrors(schema, '$', errors);
  for (const [name, definition] of Object.entries(schema.$defs)) strictShapeErrors(definition, `$defs.${name}`, errors);
  assert.deepEqual(errors, []);
  assert.equal(schema.type, 'object');
  assert.equal('anyOf' in schema, false);
});

test('responses the runtime accepts conform to the response schema, and the ledger conforms to its schema', (t) => {
  const box = sandbox(t);
  const responseSchema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, 'council-response.schema.json'), 'utf8'));
  const ledgerSchema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, 'council.schema.json'), 'utf8'));
  const responses = trio(box, {
    codex: {
      score: 70,
      verdicts: verdicts({ 'F-SEC-1': refuted() }),
      objections: [
        { kind: 'missed', target: 'A-SEC-4', claim: 'Authorization is skipped.', citation: { path: 'src/router.js', line: 5, quote: 'router.use(authorize);' } },
        { kind: 'evidence', target: 'F-SEC-9', claim: 'Stale.', citation: null }
      ]
    }
  });
  for (const response of responses) {
    const errors = [];
    conforms(responseSchema, response, responseSchema, '$', errors);
    assert.deepEqual(errors, [], response.seat.harness);
  }
  // The schema rejects the shapes strict mode would not produce.
  const bad = JSON.parse(JSON.stringify(responses[0]));
  delete bad.score;
  bad.extra = true;
  const badErrors = [];
  conforms(responseSchema, bad, responseSchema, '$', badErrors);
  assert.ok(badErrors.some((error) => /score is required/.test(error)));
  assert.ok(badErrors.some((error) => /extra is not allowed/.test(error)));

  let ledger = apply(box, responses);
  let errors = [];
  conforms(ledgerSchema, ledger, ledgerSchema, '$', errors);
  assert.deepEqual(errors, []);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  errors = [];
  conforms(ledgerSchema, ledger, ledgerSchema, '$', errors);
  assert.deepEqual(errors, []);
  // Round-cap, with its remaining list, also conforms.
  const raise = { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } };
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 2 })), ledger);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 3 })), ledger);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  assert.equal(ledger.status, 'round-cap');
  errors = [];
  conforms(ledgerSchema, ledger, ledgerSchema, '$', errors);
  assert.deepEqual(errors, []);
});

test('the audit schema lists the council capability', () => {
  const schema = fs.readFileSync(path.join(schemaDirectory, 'audit.schema.json'), 'utf8');
  assert.match(schema, /"static", "sandbox", "connected", "council"/);
});

test('the runtime module stays zero-dependency and offline', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'skills', 'godaudits', 'runtime', 'lib', 'council.js'), 'utf8');
  const requires = [...source.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual(requires.sort(), ['./evidence', './refute', 'node:crypto', 'node:fs', 'node:path']);
  assert.equal(/\b(fetch|http|https|net|child_process|spawn|exec)\b/.test(source.replace(/\/\/.*$/gm, '')), false);
});

// ---------------------------------------------------------------------------
// Review regressions
// ---------------------------------------------------------------------------

test('regression: an unverified challenge neither contests the finding nor sets a confidence ceiling', (t) => {
  const box = sandbox(t);
  const badGuard = { path: 'src/repo.js', line: 2, quote: 'this text is not in the file' };
  const ledger = apply(box, trio(box, {
    codex: { verdicts: verdicts({ 'F-SEC-1': refuted('F-SEC-1', badGuard), 'F-SEC-9': { finding: 'F-SEC-9', outcome: 'weakened', guard: null, note: 'no guard' } }) }
  }));
  for (const entry of latestOf(ledger).tally) {
    assert.equal(entry.result, 'standing', entry.finding);
    assert.equal(entry.confidence_ceiling, null, entry.finding);
    assert.equal(entry.seats.find((seat) => seat.harness === 'codex').guard_verified, false);
    assert.notEqual(entry.seats.find((seat) => seat.harness === 'codex').outcome, 'no-refutation');
  }
  // The objections are citation-failed, so the council converges without lowering anything.
  assert.equal(ledger.status, 'converged');
});

test('regression: a verified challenge sets the ceiling, and a later dismissal does not remove it', (t) => {
  const box = sandbox(t);
  let ledger = apply(box, trio(box, { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } }));
  assert.equal(latestOf(ledger).tally.find((entry) => entry.finding === 'F-SEC-1').result, 'contested');
  ledger = triageCouncil(ledger, decide(ledger, 'dismissed', 'Guard is test-only.'));
  const entry = latestOf(ledger).tally.find((item) => item.finding === 'F-SEC-1');
  assert.equal(entry.result, 'contested');
  assert.equal(entry.confidence_ceiling, 'Firm');
  // All three seats verified-challenging is challenged.
  const all = apply(box, trio(box).map((response) => ({ ...response, verdicts: verdicts({ 'F-SEC-1': refuted() }) })));
  assert.equal(latestOf(all).tally.find((item) => item.finding === 'F-SEC-1').result, 'challenged');
});

test('regression: ledger validation recomputes completeness instead of trusting the stored flag', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box));
  assert.equal(ledger.status, 'converged');

  const fewerSeats = JSON.parse(JSON.stringify(ledger));
  fewerSeats.rounds[0].seats = fewerSeats.rounds[0].seats.slice(0, 1);
  assert.equal(fewerSeats.rounds[0].complete, true);
  assert.match(validateLedger(fewerSeats).join(' '), /complete is true but its seats and verdicts compute to false/);
  assert.throws(() => renderCouncil(fewerSeats), /invalid council ledger/);
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash, ledger: fewerSeats }), /invalid council ledger/);

  const droppedVerdict = JSON.parse(JSON.stringify(ledger));
  droppedVerdict.rounds[0].seats[0].verdicts = droppedVerdict.rounds[0].seats[0].verdicts.slice(1);
  assert.match(validateLedger(droppedVerdict).join(' '), /edited by hand/);

  const lyingSeat = JSON.parse(JSON.stringify(ledger));
  lyingSeat.rounds[0].required_findings = ['F-SEC-1', 'F-SEC-9', 'F-SEC-77'];
  assert.ok(validateLedger(lyingSeat).length > 0);

  // Status is derived from recomputed completeness: with the flag forced true the stored
  // converged status is still rejected once the seats no longer support it.
  const forced = JSON.parse(JSON.stringify(ledger));
  forced.rounds[0].seats.pop();
  forced.rounds[0].complete = false;
  forced.rounds[0].incomplete_reasons = ['2 distinct harnesses; 3 are required'];
  forced.rounds[0].seats.forEach((seat) => { seat.complete = true; });
  assert.match(validateLedger(forced).join(' '), /status is converged but the rounds compute to incomplete/);
});

test('regression: citation errors, paths, and warnings never carry an unredacted seat string', (t) => {
  const box = sandbox(t);
  const secret = `ghp_${'Zy9Xw8Vu7T'.repeat(3)}`;
  const leaky = `src/${secret}.js`;
  fs.writeFileSync(path.join(box.repo, leaky), 'const a = 1;\n');
  const bad = { path: leaky, line: 1, quote: 'text that is not there' };
  const ledger = apply(box, trio(box, {
    codex: {
      verdicts: [...verdicts({ 'F-SEC-1': refuted('F-SEC-1', bad) }), { finding: `F-${secret}`, outcome: 'no-refutation', guard: null, note: null }],
      objections: [{ kind: 'missed', target: 'A-SEC-4', claim: 'x', citation: bad }]
    }
  }));
  const failed = latestOf(ledger).objections.filter((objection) => objection.status === 'citation-failed');
  assert.ok(failed.length >= 1);
  for (const objection of failed) assert.match(objection.citation_error, /quote not found/);
  const text = JSON.stringify(ledger);
  assert.equal(text.includes(secret), false);
  assert.equal(renderCouncil(ledger).includes(secret), false);
  assert.match(text, /<redacted:/);
});

test('regression: an incomplete third round with nothing to triage ends in round-cap, with the gaps listed', (t) => {
  const box = sandbox(t);
  const raise = { codex: { verdicts: verdicts({ 'F-SEC-1': refuted() }) } };
  let ledger = apply(box, trio(box, raise));
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box, raise).map((r) => ({ ...r, round: 2 })), ledger);
  ledger = triageCouncil(ledger, decide(ledger, 'accepted'));
  ledger = apply(box, trio(box).slice(0, 2).map((r) => ({ ...r, round: 3 })), ledger);
  assert.equal(ledger.status, 'round-cap');
  assert.equal(ledger.remaining.length, 1);
  assert.deepEqual(ledger.remaining[0], { type: 'incomplete', detail: '2 distinct harnesses; 3 are required' });
  assert.throws(() => planCouncil(box.audit, { auditSha256: box.hash, ledger }), /3-round cap/);
  // A seat's response is never replaced, and nothing more is accepted once capped.
  assert.throws(() => apply(box, [answer(box, 'antigravity', 'google', { round: 3 })], ledger), /the ledger is round-cap/);
  // Before the cap the same shape stays incomplete: a later seat can still join.
  const early = apply(box, trio(box).slice(0, 2));
  assert.equal(early.status, 'incomplete');
  // A duplicate harness in an open round is still refused: no re-rolling a seat.
  assert.throws(() => apply(box, [answer(box, 'codex', 'openai')], early), /already has a seat in round 1/);
});

test('regression: the guide has the orchestrator write the seat block and forbids replacing a seat', () => {
  const guide = fs.readFileSync(path.join(__dirname, '..', 'skills', 'godaudits', 'guides', 'council.md'), 'utf8');
  assert.match(guide, /overwrites the `seat` block with what it\s+actually invoked/);
  assert.match(guide, /model id exactly as passed on that command line/);
  assert.match(guide, /cannot be trusted/);
  assert.match(guide, /replaced within a round/);
  assert.match(guide, /cherry-pick verdicts/);
  assert.equal(/set seat to your own/i.test(guide), false);
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, 'council-response.schema.json'), 'utf8'));
  assert.deepEqual(schema.properties.seat.required, ['harness', 'provider', 'model', 'effort']);
});

test('regression: a verified refute objection on a non-required finding sets a Firm ceiling that survives dismissal', (t) => {
  const box = sandbox(t);
  const objection = { kind: 'refute', target: 'F-PRD-1', claim: 'The framing is covered by the README.', citation: GUARD };
  let ledger = apply(box, trio(box, { codex: { objections: [objection] } }));
  // F-PRD-1 is Low, so no verdict was required of anyone.
  assert.equal(latestOf(ledger).required_findings.includes('F-PRD-1'), false);
  let entry = latestOf(ledger).tally.find((item) => item.finding === 'F-PRD-1');
  assert.ok(entry, 'the challenged Low finding appears in the tally');
  assert.equal(entry.result, 'challenged');
  assert.equal(entry.confidence_ceiling, 'Firm');
  assert.deepEqual(entry.seats, [{ harness: 'codex', outcome: 'refuted', guard_verified: true }]);
  // Seats that said nothing are unanswered, not agreeing.
  assert.deepEqual(entry.unanswered_by, ['antigravity', 'claude-code']);

  ledger = triageCouncil(ledger, decide(ledger, 'dismissed', 'Out of the audit destination.'));
  assert.equal(ledger.status, 'converged');
  entry = latestOf(ledger).tally.find((item) => item.finding === 'F-PRD-1');
  assert.equal(entry.confidence_ceiling, 'Firm');
});

test('regression: an unverified objection never reaches the tally or the ceiling', (t) => {
  const box = sandbox(t);
  const bad = { path: 'src/repo.js', line: 2, quote: 'not in the file' };
  const ledger = apply(box, trio(box, {
    codex: {
      objections: [
        { kind: 'refute', target: 'F-PRD-1', claim: 'Bad quote.', citation: bad },
        { kind: 'weaken', target: 'F-PRD-1', claim: 'No citation at all.', citation: null },
        { kind: 'evidence', target: 'F-PRD-1', claim: 'Evidence kinds are not challenges.', citation: GUARD },
        { kind: 'refute', target: 'A-SEC-4', claim: 'A check id is not a finding.', citation: GUARD }
      ]
    }
  }));
  assert.equal(latestOf(ledger).tally.some((entry) => entry.finding === 'F-PRD-1'), false);
  for (const entry of latestOf(ledger).tally) assert.equal(entry.confidence_ceiling, null, entry.finding);
});

test('regression: a verified weaken objection against a required finding contests it even beside a no-refutation verdict', (t) => {
  const box = sandbox(t);
  const ledger = apply(box, trio(box, {
    codex: { objections: [{ kind: 'weaken', target: 'F-SEC-9', claim: 'Narrower than stated.', citation: GUARD }] }
  }));
  const entry = latestOf(ledger).tally.find((item) => item.finding === 'F-SEC-9');
  assert.equal(entry.result, 'contested');
  assert.equal(entry.confidence_ceiling, 'Firm');
  assert.equal(entry.seats.find((seat) => seat.harness === 'codex').outcome, 'weakened');
  assert.equal(latestOf(ledger).tally.find((item) => item.finding === 'F-SEC-1').result, 'standing');
});
