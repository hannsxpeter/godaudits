'use strict';

// Cross-harness council review. Three or more independent agents from distinct
// harnesses review a finished audit, read-only, in bounded rounds. This module
// is the deterministic side only: it plans the packet each seat receives,
// validates and folds the seat responses into a ledger, records the lead's
// triage, and renders the result. It never calls a model or the network, never
// executes a seat, and never mutates AUDIT.json.
//
// Three rules shape everything here:
//
//   1. Scores never gate. A seat may grade the audit's quality 0-100; the number
//      is recorded and shown, and nothing in the status, the tally, or the
//      stop rule reads it. After round one a reviewer grades its own
//      suggestions, and pleasing reviewers by dropping findings is the more
//      dangerous error.
//   2. Silence is not agreement. A seat that omits a verdict for any brief is
//      incomplete, and a round that is incomplete can never converge.
//   3. The council can lower a finding's confidence, never raise it. A finding
//      that any seat refuted or weakened records a Firm confidence ceiling for
//      the next re-audit; unanimous agreement adds no evidence and changes
//      nothing.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { redactSecrets } = require('./evidence');
const { planRefutations } = require('./refute');

const SCHEMA_VERSION = '1.0';
const MAX_ROUNDS = 3;
const MIN_SEATS = 3;
const CITATION_WINDOW = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const OUTCOMES = ['refuted', 'weakened', 'no-refutation'];
const KINDS = ['refute', 'weaken', 'missed', 'evidence'];
const CITATION_REQUIRED = new Set(['refute', 'weaken', 'missed']);
const OBJECTION_STATUSES = ['open', 'accepted', 'dismissed', 'repeat-dismissed', 'citation-failed', 'rejected-target'];
const LEDGER_STATUSES = ['needs-triage', 'continue', 'converged', 'round-cap', 'incomplete'];
const RESPONSE_PATH = '.godaudits/council/ROUND-<round>-<harness>.json';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Every free-text field a seat controls passes through the shared redactor
// before it reaches the ledger, so a credential quoted by a reviewer never
// lands in COUNCIL.json. Text is collapsed to one line and bounded.
function clean(value, limit) {
  const text = redactSecrets(String(value === undefined || value === null ? '' : value)).text;
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizeSpace(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function key(value) {
  return String(value).trim().toLowerCase();
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : (noun.endsWith('s') ? 'es' : 's')}`;
}

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

function createRepository(repoRoot) {
  if (!isNonEmptyString(repoRoot)) throw new Error('council apply requires --repo DIR so citations can be checked');
  let real;
  try {
    real = fs.realpathSync(path.resolve(repoRoot));
  } catch {
    throw new Error(`--repo ${repoRoot} does not exist`);
  }
  if (!fs.statSync(real).isDirectory()) throw new Error(`--repo ${repoRoot} is not a directory`);
  return { root: real, files: new Map() };
}

// Error text can embed the seat-controlled path, so it passes through the same
// redactor as every other seat string before it is stored or rendered.
function fail(error, extra) {
  return { ok: false, error: clean(error, 300), ...(extra || {}) };
}

// A citation is checked against the repository, never trusted. The path must be
// repository-relative with no escape (lexically or through a symlink), the file
// must exist and be readable text, and the whitespace-normalized quote must
// appear within CITATION_WINDOW lines of the cited line.
function checkCitation(citation, repository) {
  if (!isObject(citation)) return fail('citation is missing');
  const { path: cited, line, quote } = citation;
  if (!isNonEmptyString(cited)) return fail('citation path is missing');
  if (!Number.isInteger(line) || line < 1) return fail('citation line must be a positive integer');
  if (typeof quote !== 'string' || !normalizeSpace(quote)) return fail('citation quote is missing');
  if (cited.includes('\0') || cited.includes('\\')) return fail('citation path must be repository-relative with forward slashes');
  if (cited.startsWith('/') || cited.startsWith('~') || /^[A-Za-z]:/.test(cited)) return fail('citation path must be repository-relative, not absolute');
  if (cited.split('/').includes('..')) return fail('citation path escapes the repository with ..');
  const relative = path.posix.normalize(cited);
  if (relative === '.' || relative.endsWith('/')) return fail('citation path does not name a file');

  let real;
  try {
    real = fs.realpathSync(path.join(repository.root, ...relative.split('/')));
  } catch {
    return fail('cited file does not exist', { path: relative });
  }
  if (real !== repository.root && !real.startsWith(repository.root + path.sep)) {
    return fail('citation path resolves outside the repository', { path: relative });
  }

  let loaded = repository.files.get(real);
  if (!loaded) {
    loaded = { error: null, buffer: null };
    try {
      const stat = fs.statSync(real);
      if (!stat.isFile()) loaded.error = 'cited path is not a regular file';
      else if (stat.size > MAX_FILE_BYTES) loaded.error = 'cited file is too large to check';
      else {
        loaded.buffer = fs.readFileSync(real);
        if (loaded.buffer.includes(0)) loaded.error = 'cited file is binary';
      }
    } catch {
      loaded.error = 'cited file cannot be read';
    }
    repository.files.set(real, loaded);
  }
  if (loaded.error) return fail(loaded.error, { path: relative });

  const sha256 = sha256Hex(loaded.buffer);
  const lines = loaded.buffer.toString('utf8').split(/\r?\n/);
  if (line > lines.length) return fail(`cited line ${line} is past the end of the file (${lines.length} lines)`, { path: relative, sha256 });
  const window = lines.slice(Math.max(0, line - 1 - CITATION_WINDOW), Math.min(lines.length, line + CITATION_WINDOW)).join(' ');
  if (!normalizeSpace(window).includes(normalizeSpace(quote))) {
    return fail(`quote not found within ${CITATION_WINDOW} lines of ${relative}:${line}`, { path: relative, sha256 });
  }
  return { ok: true, path: relative, line, quote: clean(quote, 300), sha256 };
}

// What the ledger keeps of a citation: the cleaned location, the file hash when
// the file could be read, and whether the check passed.
function citationRecord(citation, checked) {
  if (!isObject(citation) || !isNonEmptyString(citation.path)) return null;
  return {
    path: clean(checked.path || citation.path, 300),
    line: Number.isInteger(citation.line) && citation.line > 0 ? citation.line : null,
    quote: clean(citation.quote, 300),
    sha256: checked.sha256 || null,
    verified: checked.ok === true
  };
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

function citedWhere(citation) {
  if (!isObject(citation) || !isNonEmptyString(citation.path)) return null;
  const cited = citation.path.replace(/^(?:\.\/)+/, '');
  return `${cited}:${citation.line === null || citation.line === undefined ? '' : citation.line}`;
}

// kind + target + citation path:line, or kind + target without a citation. Two
// seats that make the same point at the same place merge into one objection.
function fingerprint(kind, target, citation) {
  const where = citedWhere(citation);
  return where ? `${kind}|${target}|${where}` : `${kind}|${target}`;
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

function validateCitationShape(value, label, errors) {
  if (value === null || value === undefined) return;
  if (!isObject(value)) errors.push(`${label} must be an object or null`);
}

function validateResponse(response, label, expectedHash) {
  const errors = [];
  if (!isObject(response)) return [`${label} must be a JSON object`];
  if (!Number.isInteger(response.round) || response.round < 1) errors.push(`${label}.round must be a positive integer`);
  if (typeof response.audit_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(response.audit_sha256)) {
    errors.push(`${label}.audit_sha256 must be a 64-character lowercase hex SHA-256`);
  } else if (response.audit_sha256 !== expectedHash) {
    errors.push(`${label}.audit_sha256 does not match the AUDIT.json given (the seat reviewed a different audit)`);
  }
  if (!isObject(response.seat)) errors.push(`${label}.seat must be an object`);
  else {
    for (const field of ['harness', 'provider', 'model']) {
      if (!isNonEmptyString(response.seat[field])) errors.push(`${label}.seat.${field} is required and must be a non-empty string`);
    }
    const effort = response.seat.effort;
    if (effort !== undefined && effort !== null && typeof effort !== 'string') errors.push(`${label}.seat.effort must be a string or null`);
  }
  const score = response.score;
  if (score !== undefined && score !== null && !(Number.isInteger(score) && score >= 0 && score <= 100)) {
    errors.push(`${label}.score must be an integer from 0 to 100, or null`);
  }
  if (!Array.isArray(response.verdicts)) errors.push(`${label}.verdicts must be an array`);
  else {
    const seen = new Set();
    response.verdicts.forEach((verdict, index) => {
      const where = `${label}.verdicts[${index}]`;
      if (!isObject(verdict)) { errors.push(`${where} must be an object`); return; }
      if (!isNonEmptyString(verdict.finding)) errors.push(`${where}.finding must be a non-empty string`);
      else if (seen.has(verdict.finding)) errors.push(`${where} repeats a verdict for ${verdict.finding}`);
      else seen.add(verdict.finding);
      if (!OUTCOMES.includes(verdict.outcome)) errors.push(`${where}.outcome must be one of ${OUTCOMES.join(', ')}`);
      validateCitationShape(verdict.guard, `${where}.guard`, errors);
      if (verdict.note !== undefined && verdict.note !== null && typeof verdict.note !== 'string') errors.push(`${where}.note must be a string or null`);
    });
  }
  if (!Array.isArray(response.objections)) errors.push(`${label}.objections must be an array`);
  else {
    response.objections.forEach((objection, index) => {
      const where = `${label}.objections[${index}]`;
      if (!isObject(objection)) { errors.push(`${where} must be an object`); return; }
      if (!KINDS.includes(objection.kind)) errors.push(`${where}.kind must be one of ${KINDS.join(', ')}`);
      if (!isNonEmptyString(objection.target)) errors.push(`${where}.target must be a non-empty string`);
      if (!isNonEmptyString(objection.claim)) errors.push(`${where}.claim must be a non-empty string`);
      validateCitationShape(objection.citation, `${where}.citation`, errors);
    });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Audit context
// ---------------------------------------------------------------------------

function hasCouncilCapability(audit) {
  return Boolean(audit && audit.audit && Array.isArray(audit.audit.capabilities) && audit.audit.capabilities.includes('council'));
}

function requireCapability(audit, command) {
  if (!hasCouncilCapability(audit)) {
    throw new Error(`council ${command} refused: audit.capabilities does not include "council". Council sends the audit and cited code to third-party providers, so it needs the user's explicit authorization naming the seats. Record the council capability only after that authorization.`);
  }
}

function auditContext(audit, options) {
  const findingIds = new Set((audit.findings || []).map((finding) => finding.id));
  const checkIds = new Set(options.checkIds || []);
  for (const domain of audit.domains || []) for (const check of domain.checks || []) checkIds.add(check.id);
  const required = planRefutations(audit).briefs.map((brief) => brief.finding);
  return { findingIds, checkIds, required };
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

function buildSeat(response, context, repository) {
  const seat = {
    harness: clean(response.seat.harness, 80),
    provider: clean(response.seat.provider, 80),
    model: clean(response.seat.model, 120),
    effort: isNonEmptyString(response.seat.effort) ? clean(response.seat.effort, 40) : null,
    score: Number.isInteger(response.score) ? response.score : null,
    response_sha256: sha256Hex(JSON.stringify(response)),
    verdicts: [],
    objections: [],
    warnings: []
  };
  for (const verdict of response.verdicts) {
    const exists = context.findingIds.has(verdict.finding);
    if (!exists && verdict.outcome === 'no-refutation') {
      seat.warnings.push(`verdict for unknown finding ${clean(verdict.finding, 60)} was ignored`);
      continue;
    }
    const entry = {
      finding: clean(verdict.finding, 60),
      outcome: verdict.outcome,
      guard: null,
      guard_error: null,
      note: clean(verdict.note, 600),
      target_known: exists
    };
    if (verdict.outcome !== 'no-refutation') {
      const checked = checkCitation(verdict.guard, repository);
      entry.guard = citationRecord(verdict.guard, checked);
      entry.guard_error = checked.ok ? null : checked.error;
    }
    seat.verdicts.push(entry);
  }
  for (const objection of response.objections) {
    const checked = isObject(objection.citation) ? checkCitation(objection.citation, repository) : null;
    const required = CITATION_REQUIRED.has(objection.kind);
    let citationError = null;
    if (checked && !checked.ok) citationError = checked.error;
    else if (!checked && required) citationError = 'a citation is required for this kind of objection';
    seat.objections.push({
      kind: objection.kind,
      target: clean(objection.target, 60),
      claim: clean(objection.claim, 600),
      citation: checked ? citationRecord(objection.citation, checked) : null,
      citation_error: citationError,
      target_known: context.findingIds.has(objection.target) || context.checkIds.has(objection.target),
      target_type: context.findingIds.has(objection.target) ? 'finding' : (context.checkIds.has(objection.target) ? 'check' : null)
    });
  }
  seat.missing_verdicts = context.required.filter((id) => !seat.verdicts.some((verdict) => verdict.finding === id));
  seat.complete = seat.missing_verdicts.length === 0;
  return seat;
}

// ---------------------------------------------------------------------------
// Round assembly
// ---------------------------------------------------------------------------

function contributionsOf(seat) {
  const items = [];
  for (const verdict of seat.verdicts) {
    if (verdict.outcome === 'no-refutation') continue;
    const kind = verdict.outcome === 'refuted' ? 'refute' : 'weaken';
    items.push({
      harness: seat.harness,
      kind,
      target: verdict.finding,
      claim: verdict.note || `Seat ${seat.harness} ${verdict.outcome} this finding without a written note.`,
      citation: verdict.guard,
      citation_error: verdict.guard_error || (verdict.guard ? null : 'a citation is required for this kind of objection'),
      target_known: verdict.target_known
    });
  }
  for (const objection of seat.objections) items.push({ harness: seat.harness, ...objection });
  return items;
}

function dismissedBefore(ledger, round) {
  const map = new Map();
  for (const prior of ledger.rounds) {
    if (prior.round >= round) continue;
    for (const objection of prior.objections) {
      if (objection.status === 'dismissed' && !map.has(objection.fingerprint)) {
        map.set(objection.fingerprint, { round: prior.round, objection: objection.id, reason: objection.decision ? objection.decision.reason : '' });
      }
    }
  }
  return map;
}

function objectionStatus(item, repeat) {
  if (!item.target_known) return 'rejected-target';
  const required = CITATION_REQUIRED.has(item.kind);
  if (item.citation_error || (required && !(item.citation && item.citation.verified))) return 'citation-failed';
  if (repeat) return 'repeat-dismissed';
  return 'open';
}

function buildObjections(round, seats, repeats, previous) {
  const groups = new Map();
  for (const seat of seats) {
    for (const item of contributionsOf(seat)) {
      const print = fingerprint(item.kind, item.target, item.citation);
      const status = objectionStatus(item, repeats.get(print));
      const groupKey = `${status}\u0000${print}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          fingerprint: print,
          kind: item.kind,
          target: item.target,
          claim: item.claim,
          claims: [],
          citation: item.citation,
          citation_error: status === 'citation-failed' ? (item.citation_error || 'citation did not verify') : null,
          raised_by: [],
          status,
          decision: null,
          repeat_of: status === 'repeat-dismissed' ? repeats.get(print) : null
        });
      }
      const group = groups.get(groupKey);
      if (!group.raised_by.includes(seat.harness)) {
        group.raised_by.push(seat.harness);
        group.claims.push({ harness: seat.harness, claim: item.claim });
      }
    }
  }
  const existing = new Map((previous || []).map((objection) => [`${objection.status}\u0000${objection.fingerprint}`, objection.id]));
  let next = (previous || []).reduce((max, objection) => Math.max(max, Number(objection.id.split('-')[2]) || 0), 0) + 1;
  const ordered = [...groups.entries()].sort((a, b) => a[1].target.localeCompare(b[1].target)
    || a[1].kind.localeCompare(b[1].kind) || a[0].localeCompare(b[0]));
  return ordered.map(([groupKey, group]) => {
    group.raised_by.sort();
    const id = existing.get(groupKey) || `O-${round}-${next++}`;
    return { id, ...group };
  }).sort((a, b) => Number(a.id.split('-')[2]) - Number(b.id.split('-')[2]));
}

// A seat challenges a finding when it returned a refuted or weakened verdict with
// a verified guard, or raised a refute or weaken objection against that finding
// with a verified citation. Unverified challenges never count, and a seat that
// said nothing about a finding is unanswered, not agreeing.
function verifiedObjection(seat, finding) {
  const matches = seat.objections.filter((objection) => (objection.kind === 'refute' || objection.kind === 'weaken')
    && objection.target_type === 'finding' && objection.target === finding
    && objection.citation && objection.citation.verified === true && !objection.citation_error);
  return matches.find((objection) => objection.kind === 'refute') || matches[0] || null;
}

function stanceOf(seat, finding) {
  const verdict = seat.verdicts.find((entry) => entry.finding === finding) || null;
  if (verdict && verdict.outcome !== 'no-refutation' && verdict.guard && verdict.guard.verified) {
    return { outcome: verdict.outcome, guard_verified: true };
  }
  const objection = verifiedObjection(seat, finding);
  if (objection) return { outcome: objection.kind === 'refute' ? 'refuted' : 'weakened', guard_verified: true };
  if (verdict) {
    return { outcome: verdict.outcome, guard_verified: verdict.outcome === 'no-refutation' ? null : Boolean(verdict.guard && verdict.guard.verified) };
  }
  return null;
}

function buildTally(seats, context) {
  const ids = new Set(context.required);
  for (const seat of seats) {
    for (const verdict of seat.verdicts) if (context.findingIds.has(verdict.finding)) ids.add(verdict.finding);
    for (const objection of seat.objections) {
      if (objection.target_type === 'finding' && verifiedObjection(seat, objection.target)) ids.add(objection.target);
    }
  }
  return [...ids].sort().map((finding) => {
    const answered = [];
    const unanswered = [];
    for (const seat of seats) {
      const stance = stanceOf(seat, finding);
      if (stance) answered.push({ harness: seat.harness, ...stance });
      else unanswered.push(seat.harness);
    }
    if (answered.length === 0) return null;
    const challenges = answered.filter((entry) => entry.outcome !== 'no-refutation' && entry.guard_verified === true).length;
    const result = challenges === 0 ? 'standing' : (challenges === answered.length ? 'challenged' : 'contested');
    return {
      finding,
      result,
      seats: answered.sort((a, b) => a.harness.localeCompare(b.harness)),
      unanswered_by: unanswered.sort(),
      confidence_ceiling: result === 'standing' ? null : 'Firm'
    };
  }).filter(Boolean);
}

function roundWarnings(seats) {
  const warnings = [];
  const providers = new Set(seats.map((seat) => key(seat.provider)).filter((provider) => provider && provider !== 'unknown'));
  if (seats.length > 0 && providers.size < MIN_SEATS) {
    warnings.push({
      code: 'reduced-decorrelation',
      message: `Only ${plural(providers.size, 'distinct known provider')} across the seats (need ${MIN_SEATS}; an unknown provider does not count), so the seats may share training lineage and errors.`
    });
  }
  return warnings;
}

// Completeness is always derived from a round's own data: at least MIN_SEATS
// distinct harnesses, and a verdict from every seat for every required finding.
// A stored flag is never trusted.
function completenessOf(round) {
  const seats = Array.isArray(round.seats) ? round.seats : [];
  const required = Array.isArray(round.required_findings) ? round.required_findings : [];
  const harnesses = new Set(seats.map((seat) => key(seat.harness)));
  const reasons = [];
  if (harnesses.size < MIN_SEATS) reasons.push(`${plural(harnesses.size, 'distinct harness')}; ${MIN_SEATS} are required`);
  const missing = new Map();
  for (const seat of seats) {
    const answered = new Set((Array.isArray(seat.verdicts) ? seat.verdicts : []).map((verdict) => verdict.finding));
    const absent = required.filter((id) => !answered.has(id));
    missing.set(seat, absent);
    if (absent.length) reasons.push(`seat ${seat.harness} has no verdict for ${absent.join(', ')}`);
  }
  return { complete: reasons.length === 0, reasons, missing };
}

function assembleRound(round, auditHash, required, seats, ledger, previousObjections) {
  const sorted = [...seats].sort((a, b) => key(a.harness).localeCompare(key(b.harness)));
  const completeness = completenessOf({ seats: sorted, required_findings: required });
  for (const seat of sorted) {
    seat.missing_verdicts = completeness.missing.get(seat);
    seat.complete = seat.missing_verdicts.length === 0;
  }
  const context = { findingIds: new Set(), required };
  for (const seat of sorted) for (const verdict of seat.verdicts) if (verdict.target_known) context.findingIds.add(verdict.finding);
  return {
    round,
    audit_sha256: auditHash,
    required_findings: required,
    triaged: false,
    complete: completeness.complete,
    incomplete_reasons: completeness.reasons,
    seats: sorted,
    tally: buildTally(sorted, context),
    objections: buildObjections(round, sorted, dismissedBefore(ledger, round), previousObjections),
    warnings: [...roundWarnings(sorted), ...sorted.flatMap((seat) => seat.warnings.map((message) => ({ code: 'ignored-verdict', message: `${seat.harness}: ${message}` })))]
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function countStatus(round, status) {
  return round.objections.filter((objection) => objection.status === status).length;
}

// Scores are deliberately absent from this function. Status reads completeness,
// objections, triage, and the round count, and nothing else.
function computeStatus(ledger) {
  const latest = ledger.rounds[ledger.rounds.length - 1];
  const capped = ledger.rounds.length >= MAX_ROUNDS;
  if (!completenessOf(latest).complete) {
    // At the cap there is no later round to repair an incomplete one, and a seat
    // cannot be replaced within a round, so an incomplete round that is triaged
    // or has nothing left to triage ends the council instead of stalling it.
    return capped && (latest.triaged || countStatus(latest, 'open') === 0) ? 'round-cap' : 'incomplete';
  }
  if (countStatus(latest, 'open') > 0) return 'needs-triage';
  if (countStatus(latest, 'accepted') === 0) return 'converged';
  return capped ? 'round-cap' : 'continue';
}

function statusDetail(ledger) {
  const latest = ledger.rounds[ledger.rounds.length - 1];
  const open = countStatus(latest, 'open');
  const accepted = countStatus(latest, 'accepted');
  switch (ledger.status) {
    case 'needs-triage': return `${plural(open, 'open objection')} in round ${latest.round} must be accepted or dismissed.`;
    case 'continue': return `Round ${latest.round} accepted ${plural(accepted, 'objection')}; fix them, then plan round ${latest.round + 1}.`;
    case 'converged': return `Round ${latest.round} was complete and produced no open or accepted objections.`;
    case 'round-cap': return `The ${MAX_ROUNDS}-round cap was reached without convergence.`;
    default: return `Round ${latest.round} is incomplete: ${latest.incomplete_reasons.join('; ') || 'a seat is missing'}.`;
  }
}

function remainingAt(ledger) {
  if (ledger.status !== 'round-cap') return [];
  const latest = ledger.rounds[ledger.rounds.length - 1];
  const remaining = latest.objections
    .filter((objection) => objection.status === 'accepted' || objection.status === 'open')
    .map((objection) => ({ type: 'objection', objection: objection.id, status: objection.status, kind: objection.kind, target: objection.target }));
  for (const reason of latest.incomplete_reasons) remaining.push({ type: 'incomplete', detail: reason });
  return remaining;
}

function recompute(ledger) {
  const latest = ledger.rounds[ledger.rounds.length - 1];
  ledger.audit_sha256 = latest.audit_sha256;
  ledger.status = computeStatus(ledger);
  ledger.status_detail = statusDetail(ledger);
  ledger.remaining = remainingAt(ledger);
  const warnings = [];
  for (const round of ledger.rounds) {
    for (const warning of round.warnings) warnings.push({ round: round.round, code: warning.code, message: warning.message });
  }
  ledger.warnings = warnings;
  return ledger;
}

// ---------------------------------------------------------------------------
// Ledger validation
// ---------------------------------------------------------------------------

function validateLedger(ledger) {
  const errors = [];
  if (!isObject(ledger)) return ['ledger must be a JSON object'];
  if (ledger.schema_version !== SCHEMA_VERSION) errors.push(`ledger.schema_version must be ${SCHEMA_VERSION}`);
  if (!Array.isArray(ledger.rounds) || ledger.rounds.length === 0) return [...errors, 'ledger.rounds must be a non-empty array'];
  if (ledger.rounds.length > MAX_ROUNDS) errors.push(`ledger has more than ${MAX_ROUNDS} rounds`);
  ledger.rounds.forEach((round, index) => {
    const where = `ledger.rounds[${index}]`;
    if (!isObject(round)) { errors.push(`${where} must be an object`); return; }
    if (round.round !== index + 1) errors.push(`${where}.round must be ${index + 1}`);
    if (typeof round.audit_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(round.audit_sha256)) errors.push(`${where}.audit_sha256 is invalid`);
    for (const field of ['seats', 'objections', 'tally', 'warnings', 'incomplete_reasons', 'required_findings']) {
      if (!Array.isArray(round[field])) errors.push(`${where}.${field} must be an array`);
    }
    if (typeof round.triaged !== 'boolean' || typeof round.complete !== 'boolean') errors.push(`${where}.triaged and .complete must be booleans`);
    for (const seat of Array.isArray(round.seats) ? round.seats : []) {
      if (!isObject(seat) || typeof seat.harness !== 'string' || !Array.isArray(seat.verdicts)) errors.push(`${where} has a malformed seat`);
    }
    for (const objection of Array.isArray(round.objections) ? round.objections : []) {
      if (!OBJECTION_STATUSES.includes(objection.status)) errors.push(`${where} objection ${objection.id} has invalid status ${objection.status}`);
    }
  });
  if (errors.length) return errors;
  ledger.rounds.forEach((round, index) => {
    const derived = completenessOf(round);
    if (round.complete !== derived.complete) {
      errors.push(`ledger.rounds[${index}].complete is ${round.complete} but its seats and verdicts compute to ${derived.complete}; the ledger was edited by hand`);
    }
    if (JSON.stringify(round.incomplete_reasons) !== JSON.stringify(derived.reasons)) {
      errors.push(`ledger.rounds[${index}].incomplete_reasons disagree with its seats and verdicts; the ledger was edited by hand`);
    }
    for (const seat of round.seats) {
      const absent = derived.missing.get(seat);
      if (seat.complete !== (absent.length === 0) || JSON.stringify(seat.missing_verdicts) !== JSON.stringify(absent)) {
        errors.push(`ledger.rounds[${index}] seat ${seat.harness} completeness disagrees with its verdicts; the ledger was edited by hand`);
      }
    }
  });
  if (errors.length) return errors;
  const stored = ledger.status;
  const computed = computeStatus(ledger);
  if (stored !== computed) errors.push(`ledger.status is ${stored} but the rounds compute to ${computed}; the ledger was edited by hand`);
  if (!LEDGER_STATUSES.includes(stored)) errors.push(`ledger.status ${stored} is invalid`);
  return errors;
}

function loadLedger(ledger) {
  const errors = validateLedger(ledger);
  if (errors.length) throw new Error(`invalid council ledger:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  return JSON.parse(JSON.stringify(ledger));
}

function openObjections(round) {
  return countStatus(round, 'open');
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function priorDismissals(ledger) {
  const dismissed = [];
  for (const round of ledger ? ledger.rounds : []) {
    for (const objection of round.objections) {
      if (objection.status === 'dismissed') {
        dismissed.push({
          round: round.round,
          objection: objection.id,
          fingerprint: objection.fingerprint,
          kind: objection.kind,
          target: objection.target,
          claim: objection.claim,
          reason: objection.decision ? objection.decision.reason : ''
        });
      }
    }
  }
  return dismissed;
}

function planCouncil(audit, options = {}) {
  requireCapability(audit, 'plan');
  if (!/^[a-f0-9]{64}$/.test(options.auditSha256 || '')) throw new Error('council plan needs the SHA-256 of the AUDIT.json bytes');
  const ledger = options.ledger ? loadLedger(options.ledger) : null;
  if (ledger) {
    if (ledger.status === 'converged') throw new Error('council plan refused: the ledger has converged. Nothing is left to review.');
    if (ledger.status === 'round-cap') throw new Error(`council plan refused: the ${MAX_ROUNDS}-round cap was reached. Present what remains instead of planning another round.`);
    const latest = ledger.rounds[ledger.rounds.length - 1];
    if (openObjections(latest) > 0) throw new Error(`council plan refused: round ${latest.round} has ${plural(openObjections(latest), 'untriaged objection')}. Run council triage first.`);
  }
  const round = ledger ? ledger.rounds.length + 1 : 1;
  if (round > MAX_ROUNDS) throw new Error(`council plan refused: the ${MAX_ROUNDS}-round cap was reached`);
  const refutation = planRefutations(audit);
  return {
    schema_version: SCHEMA_VERSION,
    kind: 'council-packet',
    round,
    max_rounds: MAX_ROUNDS,
    min_seats: MIN_SEATS,
    commit: audit.audit.commit,
    audit_sha256: options.auditSha256,
    required_verdicts: refutation.briefs.map((brief) => brief.finding),
    briefs: refutation.briefs,
    dismissed_objections: priorDismissals(ledger),
    response_contract: {
      schema: 'schemas/council-response.schema.json',
      path: RESPONSE_PATH,
      round,
      audit_sha256: options.auditSha256,
      seat: 'harness, provider, and model are required non-empty strings; effort may be null. The orchestrator overwrites this block with the harness, model id, effort, and provider it actually invoked, so a placeholder is enough',
      verdicts: 'one entry per brief in required_verdicts; outcome is refuted, weakened, or no-refutation; guard is {path, line, quote} for refuted and weakened, otherwise null',
      objections: 'kind is refute, weaken, missed, or evidence; target is a finding id or check id; citation {path, line, quote} is required for refute, weaken, and missed',
      citation: 'repository-relative path, 1-based line, and a verbatim quote that appears within 3 lines of that line; absolute paths, .. segments, and symlinks that leave the repository fail',
      score: 'optional integer 0 to 100 grading the quality of the audit, not the codebase; recorded and shown, never used to gate anything'
    },
    instructions: [
      'You are a read-only seat. Do not edit, create, or delete any file, and do not run the project, its tests, or any network call.',
      'Answer every brief in required_verdicts from the cited code first. Read the code at each citation and decide whether it supports the claim before you read the AUDIT.mdx narrative.',
      'Try to disprove each claim: look for guards, framework defaults, dead code, and compensating controls. A guard you rely on must be cited.',
      'Raise an objection only with evidence you can cite. A missed issue needs a citation to the code that shows it.',
      'Do not re-raise an objection listed in dismissed_objections; the lead already ruled on it with the stated reason.',
      'Score is optional and grades how good the audit is, not the codebase. It will not be used to accept or reject anything.',
      'Silence is not agreement. A response that omits a verdict for any brief makes your seat incomplete for this round.'
    ],
    note: 'Council packet. One agent per seat reviews the whole packet; never one agent per finding. Fold responses back with `godaudits council apply`. This adds no evidence to any finding and never edits AUDIT.json.'
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function applyCouncil(audit, responses, options = {}) {
  requireCapability(audit, 'apply');
  if (!/^[a-f0-9]{64}$/.test(options.auditSha256 || '')) throw new Error('council apply needs the SHA-256 of the AUDIT.json bytes');
  if (!Array.isArray(responses) || responses.length === 0) throw new Error('council apply requires at least one RESPONSE.json');
  const sources = options.sources || [];
  const labels = responses.map((_, index) => sources[index] || `response ${index + 1}`);
  const ledger = options.ledger ? loadLedger(options.ledger) : { schema_version: SCHEMA_VERSION, commit: audit.audit.commit, max_rounds: MAX_ROUNDS, min_seats: MIN_SEATS, rounds: [] };
  if (options.ledger && (ledger.status === 'converged' || ledger.status === 'round-cap')) {
    throw new Error(`council apply refused: the ledger is ${ledger.status}`);
  }
  const repository = createRepository(options.repoRoot);

  const errors = [];
  responses.forEach((response, index) => errors.push(...validateResponse(response, labels[index], options.auditSha256)));
  if (errors.length) throw new Error(`council apply rejected:\n${errors.map((error) => `- ${error}`).join('\n')}`);

  const round = responses[0].round;
  responses.forEach((response, index) => {
    if (response.round !== round) errors.push(`${labels[index]} is for round ${response.round} but ${labels[0]} is for round ${round}; apply one round at a time`);
  });
  const latest = ledger.rounds[ledger.rounds.length - 1] || null;
  let existing = null;
  if (round > MAX_ROUNDS) errors.push(`round ${round} exceeds the ${MAX_ROUNDS}-round cap`);
  else if (!latest) {
    if (round !== 1) errors.push(`no ledger was given, so the first round must be 1 (responses are for round ${round}); pass --ledger to continue a council`);
  } else if (round === latest.round) {
    if (latest.triaged) errors.push(`round ${round} is already triaged and closed; responses must be for round ${round + 1}`);
    else if (latest.audit_sha256 !== options.auditSha256) errors.push(`AUDIT.json changed since round ${round} began; the open round was reviewed at a different audit hash. Start round ${round + 1}`);
    else existing = latest;
  } else if (round === latest.round + 1) {
    if (openObjections(latest) > 0) errors.push(`round ${latest.round} has ${plural(openObjections(latest), 'untriaged objection')}; run council triage before round ${round}`);
  } else {
    errors.push(`round ${round} is neither the latest untriaged round (${latest.triaged ? 'none' : latest.round}) nor the next round (${latest.round + 1})`);
  }
  if (errors.length) throw new Error(`council apply rejected:\n${errors.map((error) => `- ${error}`).join('\n')}`);

  const context = auditContext(audit, options);
  const seats = existing ? [...existing.seats] : [];
  const harnesses = new Set(seats.map((seat) => key(seat.harness)));
  responses.forEach((response, index) => {
    const harness = key(response.seat.harness);
    if (harnesses.has(harness)) errors.push(`${labels[index]}: harness ${response.seat.harness.trim()} already has a seat in round ${round}`);
    harnesses.add(harness);
  });
  if (errors.length) throw new Error(`council apply rejected:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  for (const response of responses) seats.push(buildSeat(response, context, repository));

  const built = assembleRound(round, options.auditSha256, existing ? existing.required_findings : context.required, seats, ledger, existing ? existing.objections : []);
  if (existing) ledger.rounds[ledger.rounds.length - 1] = built;
  else ledger.rounds.push(built);
  ledger.commit = audit.audit.commit;
  return recompute(ledger);
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

function triageCouncil(ledgerInput, decisions) {
  const ledger = loadLedger(ledgerInput);
  const latest = ledger.rounds[ledger.rounds.length - 1];
  if (latest.triaged) throw new Error(`council triage refused: round ${latest.round} is already triaged`);
  const pending = latest.objections.filter((objection) => objection.status === 'open');
  if (pending.length === 0) throw new Error(`council triage refused: round ${latest.round} has no open objections`);
  const list = Array.isArray(decisions) ? decisions : (isObject(decisions) && Array.isArray(decisions.decisions) ? decisions.decisions : null);
  if (!list) throw new Error('council triage requires DECISIONS.json to be an array of {objection, status, reason}');

  const errors = [];
  const decided = new Map();
  list.forEach((decision, index) => {
    const where = `decisions[${index}]`;
    if (!isObject(decision)) { errors.push(`${where} must be an object`); return; }
    const objection = latest.objections.find((item) => item.id === decision.objection);
    if (!objection) { errors.push(`${where}: objection ${decision.objection} is not in round ${latest.round}`); return; }
    if (decided.has(objection.id)) { errors.push(`${where}: objection ${objection.id} is decided twice`); return; }
    if (!['accepted', 'dismissed'].includes(decision.status)) { errors.push(`${where}: status must be accepted or dismissed`); return; }
    if (objection.status === 'citation-failed' || objection.status === 'rejected-target') {
      errors.push(`${where}: objection ${objection.id} is ${objection.status} and cannot be ${decision.status}; it needs no triage and can never be accepted`);
      return;
    }
    if (objection.status !== 'open') { errors.push(`${where}: objection ${objection.id} is ${objection.status}, not open`); return; }
    const reason = typeof decision.reason === 'string' ? decision.reason : '';
    if (decision.status === 'dismissed') {
      if (!reason.trim()) { errors.push(`${where}: dismissing ${objection.id} requires a one-line reason`); return; }
      if (/[\r\n]/.test(reason.trim())) { errors.push(`${where}: the reason for ${objection.id} must be one line`); return; }
    }
    decided.set(objection.id, { status: decision.status, reason: clean(reason, 400) });
  });
  const undecided = pending.filter((objection) => !decided.has(objection.id)).map((objection) => objection.id);
  if (undecided.length) errors.push(`open objections without a decision: ${undecided.join(', ')}`);
  if (errors.length) throw new Error(`council triage rejected:\n${errors.map((error) => `- ${error}`).join('\n')}`);

  for (const objection of latest.objections) {
    const decision = decided.get(objection.id);
    if (!decision) continue;
    objection.status = decision.status;
    objection.decision = decision;
  }
  latest.triaged = true;
  return recompute(ledger);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function mdxText(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, ' ');
}

function seatLabel(seat) {
  return `${seat.harness} (${seat.provider}/${seat.model}${seat.effort ? `, ${seat.effort}` : ''})`;
}

function renderCouncil(ledgerInput) {
  const ledger = loadLedger(ledgerInput);
  const lines = ['## Council review', '', `Rounds: ${ledger.rounds.length}`, `Status: ${ledger.status}. ${mdxText(ledger.status_detail)}`, ''];

  const harnesses = [];
  for (const round of ledger.rounds) for (const seat of round.seats) if (!harnesses.includes(seat.harness)) harnesses.push(seat.harness);
  harnesses.sort((a, b) => a.localeCompare(b));
  lines.push('### Seats and scores', '');
  lines.push(`| Seat | ${ledger.rounds.map((round) => `Round ${round.round}`).join(' | ')} |`);
  lines.push(`|---|${ledger.rounds.map(() => '---').join('|')}|`);
  for (const harness of harnesses) {
    const cells = ledger.rounds.map((round) => {
      const seat = round.seats.find((item) => item.harness === harness);
      if (!seat) return 'absent';
      return seat.score === null ? 'no score' : `${seat.score}/100`;
    });
    lines.push(`| ${mdxText(harness)} | ${cells.join(' | ')} |`);
  }
  lines.push('', 'Scores grade the audit as each seat judged it. They are recorded for the reader and never gate a verdict, a score, or convergence.', '');

  lines.push('### Seat details', '');
  for (const round of ledger.rounds) {
    lines.push(`- Round ${round.round}: ${round.seats.map((seat) => mdxText(seatLabel(seat))).join('; ') || 'no seats'}.`);
  }
  lines.push('');

  lines.push('### Finding tally', '');
  const tallies = ledger.rounds.flatMap((round) => round.tally.map((entry) => ({ round: round.round, ...entry })));
  if (tallies.length === 0) lines.push('No briefs were reviewed.', '');
  else {
    lines.push('| Round | Finding | Result | Seats | Confidence ceiling |', '|---|---|---|---|---|');
    for (const entry of tallies) {
      const seats = entry.seats.map((seat) => `${seat.harness}: ${seat.outcome}`).join('; ');
      lines.push(`| ${entry.round} | ${mdxText(entry.finding)} | ${entry.result} | ${mdxText(seats)} | ${entry.confidence_ceiling || 'none'} |`);
    }
    lines.push('', 'A Firm ceiling lowers the finding on the next re-audit. The council can lower confidence and never raises it.', '');
  }

  lines.push('### Objections', '');
  const labels = {
    open: 'Open',
    accepted: 'Accepted',
    dismissed: 'Dismissed',
    'repeat-dismissed': 'Repeat of a dismissed objection',
    'citation-failed': 'Citation failed',
    'rejected-target': 'Rejected target'
  };
  let any = false;
  for (const status of OBJECTION_STATUSES) {
    const items = ledger.rounds.flatMap((round) => round.objections.filter((objection) => objection.status === status).map((objection) => ({ round: round.round, objection })));
    if (items.length === 0) continue;
    any = true;
    lines.push(`#### ${labels[status]} (${items.length})`, '');
    for (const { round, objection } of items) {
      const where = objection.citation ? ` at ${mdxText(objection.citation.path)}:${objection.citation.line === null ? '?' : objection.citation.line}` : '';
      let text = `- Round ${round}, ${objection.id} [${objection.kind}] ${mdxText(objection.target)}${where}, raised by ${objection.raised_by.map(mdxText).join(', ')}: ${mdxText(objection.claim)}`;
      if (objection.decision && objection.decision.reason) text += ` Reason: ${mdxText(objection.decision.reason)}`;
      if (objection.citation_error) text += ` Citation: ${mdxText(objection.citation_error)}.`;
      if (objection.repeat_of) text += ` Dismissed in round ${objection.repeat_of.round}: ${mdxText(objection.repeat_of.reason)}`;
      lines.push(text);
    }
    lines.push('');
  }
  if (!any) lines.push('No objections were raised.', '');

  lines.push('### Stop status', '', `Status: ${ledger.status}. ${mdxText(ledger.status_detail)}`, '');
  if (ledger.remaining.length) {
    lines.push('Remaining at the round cap:', '');
    for (const item of ledger.remaining) {
      lines.push(item.type === 'objection'
        ? `- ${item.objection} (${item.status}) [${item.kind}] ${mdxText(item.target)}`
        : `- Incomplete: ${mdxText(item.detail)}`);
    }
    lines.push('');
  }
  if (ledger.warnings.length) {
    lines.push('Warnings:', '');
    for (const warning of ledger.warnings) lines.push(`- Round ${warning.round}, ${warning.code}: ${mdxText(warning.message)}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

module.exports = {
  applyCouncil,
  checkCitation,
  computeStatus,
  fingerprint,
  hasCouncilCapability,
  planCouncil,
  renderCouncil,
  sha256Hex,
  triageCouncil,
  validateLedger,
  validateResponse,
  KINDS,
  LEDGER_STATUSES,
  MAX_ROUNDS,
  MIN_SEATS,
  OBJECTION_STATUSES,
  OUTCOMES
};
