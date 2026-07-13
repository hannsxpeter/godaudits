'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const catalog = require('../../catalog/project-context.json');

const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const EXCLUDED_DIRECTORIES = new Set([
  '.git', '.godaudits', 'build', 'coverage', 'dist', 'node_modules', 'target', 'vendor'
]);
const EXCLUDED_CONTEXT_PATH = /^(?:(?:test|tests|benchmarks)\/fixtures\/|evals\/|PROMPT(?:\.full)?\.md$)|\/catalog\/project-context\.json$/;
const COMPLETED_LEDGER_STATUSES = new Set(['done', 'imported']);
const COMPLETE_FOR_DEPENDENCY = new Set(['done', 'imported', 'skipped']);
const LEDGER_STATUSES = new Set(['pending', 'in-flight', 'done', 'skipped', 'imported', 'failed', 're-invoked']);
const TIER_ORDER = [
  'prd-ready', 'architecture-ready', 'roadmap-ready', 'stack-ready', 'repo-ready',
  'production-ready', 'deploy-ready', 'observe-ready', 'launch-ready', 'harden-ready'
];
const TIER_IDS = {
  'prd-ready': '1.1',
  'architecture-ready': '1.2',
  'roadmap-ready': '1.3',
  'stack-ready': '1.4',
  'repo-ready': '2.1',
  'production-ready': '2.2',
  'deploy-ready': '3.1',
  'observe-ready': '3.2',
  'launch-ready': '3.3',
  'harden-ready': '3.4'
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeRelativePath(value) {
  if (typeof value !== 'string' || value.includes('\0')) return null;
  const portable = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!portable || portable.startsWith('/') || /^[A-Za-z]:\//.test(portable)) return null;
  const normalized = path.posix.normalize(portable);
  if (normalized === '..' || normalized.startsWith('../')) return null;
  return normalized;
}

function walkFiles(root, current = root, result = []) {
  let entries;
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return result;
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) walkFiles(root, absolute, result);
    else if (entry.isFile()) result.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return result;
}

function normalizeContents(contentsByPath) {
  const result = new Map();
  const entries = contentsByPath instanceof Map
    ? [...contentsByPath.entries()]
    : Object.entries(contentsByPath || {});
  for (const [rawPath, value] of entries) {
    const relative = normalizeRelativePath(rawPath);
    if (!relative || isExcludedContextPath(relative) || value === undefined || value === null) continue;
    result.set(relative, Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(String(value), 'utf8'));
  }
  return result;
}

function createRepositoryView(root, suppliedPaths, contentsByPath) {
  const absoluteRoot = path.resolve(root || '.');
  const suppliedContents = normalizeContents(contentsByPath);
  const discovered = suppliedPaths === undefined || suppliedPaths === null
    ? walkFiles(absoluteRoot)
    : suppliedPaths;
  const pathSet = new Set();
  for (const rawPath of [...discovered, ...suppliedContents.keys()]) {
    const relative = normalizeRelativePath(rawPath);
    if (relative && !isExcludedContextPath(relative)) pathSet.add(relative);
  }
  const paths = [...pathSet].sort((left, right) => left.localeCompare(right));
  const cache = new Map(suppliedContents);
  const changedAtCache = new Map();
  const revisionCache = new Map();

  function read(relative, force = false) {
    if (cache.has(relative)) {
      const value = cache.get(relative);
      return force || value.length <= MAX_SCAN_BYTES ? value : null;
    }
    const absolute = path.resolve(absoluteRoot, relative);
    const prefix = `${absoluteRoot}${path.sep}`;
    if (absolute !== absoluteRoot && !absolute.startsWith(prefix)) return null;
    try {
      const stat = fs.lstatSync(absolute);
      if (!stat.isFile() || (!force && stat.size > MAX_SCAN_BYTES)) return null;
      const value = fs.readFileSync(absolute);
      cache.set(relative, value);
      return value;
    } catch {
      return null;
    }
  }

  function mtimeMs(relative) {
    if (suppliedContents.has(relative)) return null;
    try {
      const absolute = path.resolve(absoluteRoot, relative);
      const prefix = `${absoluteRoot}${path.sep}`;
      if (absolute !== absoluteRoot && !absolute.startsWith(prefix)) return null;
      const stat = fs.statSync(absolute);
      return stat.isFile() ? Math.floor(stat.mtimeMs) : null;
    } catch {
      return null;
    }
  }

  function changedAt(relative) {
    if (changedAtCache.has(relative)) return changedAtCache.get(relative);
    let value = null;
    if (!suppliedContents.has(relative)) {
      try {
        const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', relative], {
          cwd: absoluteRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        if (!dirty) {
          const output = execFileSync('git', ['log', '-1', '--format=%ct', '--', relative], {
            cwd: absoluteRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
          }).trim();
          if (/^\d+$/.test(output)) value = { ms: Number(output) * 1000, source: 'git-last-change' };
        }
      } catch {
        value = null;
      }
    }
    if (!value) {
      const fallback = mtimeMs(relative);
      if (fallback !== null) value = { ms: fallback, source: 'filesystem-mtime-fallback' };
    }
    changedAtCache.set(relative, value);
    return value;
  }

  function readAtRevision(relative, revision) {
    const key = `${revision}:${relative}`;
    if (revisionCache.has(key)) return revisionCache.get(key);
    let value = null;
    if (!suppliedContents.has(relative) && /^[a-f0-9]{7,40}$/i.test(revision)) {
      try {
        value = execFileSync('git', ['show', `${revision}:${relative}`], {
          cwd: absoluteRoot,
          encoding: null,
          maxBuffer: MAX_SCAN_BYTES + 1,
          stdio: ['ignore', 'pipe', 'ignore']
        });
        if (value.length > MAX_SCAN_BYTES) value = null;
      } catch {
        value = null;
      }
    }
    revisionCache.set(key, value);
    return value;
  }

  const textEntries = [];
  for (const relative of paths) {
    const raw = read(relative);
    if (!raw || raw.includes(0)) continue;
    textEntries.push({ path: relative, text: raw.toString('utf8') });
  }

  return { absoluteRoot, paths, pathSet, read, mtimeMs, changedAt, readAtRevision, textEntries };
}

function isExcludedContextPath(relative) {
  return EXCLUDED_CONTEXT_PATH.test(String(relative || '').replace(/\\/g, '/'));
}

function confidenceForForm(score, evidence) {
  const signalCount = new Set(evidence.map((entry) => entry.signal_id)).size;
  const pathCount = new Set(evidence.map((entry) => entry.path)).size;
  if (score >= 10 && signalCount >= 3 && pathCount >= 2) return 'Certain';
  if (score >= 6 && signalCount >= 2) return 'Firm';
  return 'Tentative';
}

function matchForms(view) {
  const candidates = [];
  for (const form of catalog.forms) {
    const evidence = [];
    let score = 0;
    for (const signal of form.signals) {
      const pattern = new RegExp(signal.pattern, 'i');
      const matches = signal.kind === 'path'
        ? view.paths.filter((relative) => pattern.test(relative)).slice(0, 2)
        : view.textEntries.filter((entry) => pattern.test(entry.text)).map((entry) => entry.path).slice(0, 2);
      for (const relative of matches) {
        evidence.push({
          signal_id: signal.id,
          kind: signal.kind,
          path: relative,
          weight: signal.weight,
          reason: signal.reason
        });
        score += signal.weight;
      }
    }
    evidence.sort((left, right) => left.path.localeCompare(right.path) || left.signal_id.localeCompare(right.signal_id));
    if (score > 0) {
      candidates.push({
        id: form.id,
        label: form.label,
        score,
        confidence: confidenceForForm(score, evidence),
        evidence
      });
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const primary = candidates[0] || {
    id: 'unknown',
    label: 'Unknown project form',
    score: 0,
    confidence: 'Tentative',
    evidence: []
  };
  const secondary = candidates.slice(1).filter((candidate) => {
    const signals = new Set(candidate.evidence.map((entry) => entry.signal_id));
    return candidate.score >= 5 && signals.size >= 2;
  });
  return { primary, secondary, candidates };
}

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function phrasePattern(value) {
  const escaped = escapedPattern(value);
  if (/^[A-Za-z0-9]+$/.test(value)) return new RegExp(`\\b${escaped}\\b`, 'i');
  return new RegExp(escaped, 'i');
}

function matchProfile(profile, textEntries) {
  const evidence = [];
  for (const signal of profile.signals) {
    const pattern = phrasePattern(signal);
    const paths = textEntries.filter((entry) => pattern.test(entry.text)).map((entry) => entry.path).slice(0, 2);
    for (const relative of paths) {
      evidence.push({
        kind: 'content',
        path: relative,
        signal,
        reason: `Matched domain signal "${signal}" in ${relative}`
      });
    }
  }
  evidence.sort((left, right) => left.path.localeCompare(right.path) || left.signal.localeCompare(right.signal));
  const signalCount = new Set(evidence.map((entry) => entry.signal.toLowerCase())).size;
  if (signalCount < 2) return null;
  if (!evidence.some((entry) => isProfileAuthorityPath(entry.path))) return null;
  const pathCount = new Set(evidence.map((entry) => entry.path)).size;
  return {
    profile_id: profile.id,
    slug: profile.slug,
    name: profile.name,
    stack_profile: profile.stack_profile,
    common_forms: profile.common_forms,
    status: 'candidate',
    confidence: signalCount >= 4 && pathCount >= 2 ? 'Firm' : 'Tentative',
    score: evidence.length,
    reasons: evidence.slice(0, 8).map((entry) => entry.reason),
    evidence: evidence.slice(0, 8)
  };
}

function matchProfiles(view) {
  const productCandidates = [];
  const industryCandidates = [];
  const entries = view.textEntries.filter((entry) => isProfileEvidencePath(entry.path));
  for (const profile of catalog.profiles) {
    const candidate = matchProfile(profile, entries);
    if (!candidate) continue;
    if (profile.roles.includes('product-archetype')) productCandidates.push(candidate);
    if (profile.roles.includes('industry-overlay')) industryCandidates.push(candidate);
  }
  const compare = (left, right) => right.score - left.score || left.profile_id - right.profile_id;
  productCandidates.sort(compare);
  industryCandidates.sort(compare);
  return {
    product_archetype: {
      primary: productCandidates[0] || null,
      candidates: productCandidates
    },
    industry_overlays: industryCandidates
  };
}

function matchRegulations(view) {
  const candidates = [];
  const entries = view.textEntries.filter((entry) => isProfileEvidencePath(entry.path));
  for (const regulation of catalog.regulations) {
    const evidence = [];
    for (const sourcePattern of regulation.patterns) {
      const pattern = new RegExp(sourcePattern, 'i');
      const matches = entries.filter((entry) => pattern.test(entry.text) && isProfileAuthorityPath(entry.path)).slice(0, 3);
      for (const match of matches) {
        evidence.push({
          kind: 'content',
          path: match.path,
          signal: sourcePattern,
          reason: `Explicit ${regulation.label} reference in ${match.path}`
        });
      }
    }
    evidence.sort((left, right) => left.path.localeCompare(right.path) || left.signal.localeCompare(right.signal));
    if (evidence.length === 0) continue;
    const pathCount = new Set(evidence.map((entry) => entry.path)).size;
    candidates.push({
      id: regulation.id,
      label: regulation.label,
      status: 'candidate',
      confidence: pathCount >= 2 ? 'Firm' : 'Tentative',
      reasons: evidence.slice(0, 8).map((entry) => entry.reason),
      evidence: evidence.slice(0, 8)
    });
  }
  candidates.sort((left, right) => left.id.localeCompare(right.id));
  return candidates;
}

function isProfileEvidencePath(relative) {
  return !/^(?:test|tests|benchmarks|evals)\//.test(relative)
    && !/(^|\/)(?:references|catalog)\//.test(relative)
    && !/^(?:CHANGELOG|SECURITY|codeaudit)\.md$/i.test(relative)
    && !/^PROMPT(?:\.full)?\.md$/.test(relative);
}

function isProfileAuthorityPath(relative) {
  const base = path.basename(relative).toLowerCase();
  if (base === 'readme.md') return true;
  if (/(^|\/)(?:compliance|policies|policy)\//i.test(relative)) return true;
  return !/\.(?:md|mdx|txt|rst)$/i.test(relative);
}

function inventoryEntry(definition, view, source) {
  const present = view.pathSet.has(definition.path);
  const raw = present ? view.read(definition.path, true) : null;
  const changedAt = present ? view.changedAt(definition.path) : null;
  return {
    id: definition.id,
    tier: definition.tier,
    path: definition.path,
    source,
    present,
    bytes: raw !== null ? raw.length : null,
    sha256: raw !== null ? sha256(raw) : null,
    mtime_ms: present ? view.mtimeMs(definition.path) : null,
    changed_at_ms: changedAt ? changedAt.ms : null,
    timestamp_source: changedAt ? changedAt.source : null,
    empty: present && raw !== null ? raw.length === 0 : null,
    unreadable: present && raw === null
  };
}

function extractArtifactPaths(value) {
  const matches = String(value || '').match(/\.[A-Za-z0-9][A-Za-z0-9._/-]*\.[A-Za-z0-9]+/g) || [];
  return [...new Set(matches.map((entry) => entry.replace(/[>,;.)]+$/, '')))].sort((left, right) => left.localeCompare(right));
}

function parseLedger(view) {
  const progressPath = view.pathSet.has('.arc-ready/PROGRESS.md')
    ? '.arc-ready/PROGRESS.md'
    : view.pathSet.has('.kickoff-ready/PROGRESS.md')
      ? '.kickoff-ready/PROGRESS.md'
      : null;
  if (!progressPath) return { source: null, format: null, statuses: [], issues: [] };
  const raw = view.read(progressPath, true);
  if (raw === null) {
    return {
      source: progressPath,
      format: null,
      statuses: [],
      issues: [{ tier: '0', status: 'unknown', path: progressPath, kind: 'unreadable-artifact' }]
    };
  }
  const lines = raw.toString('utf8').split(/\r?\n/);
  const statuses = parseTableLedger(lines);
  const format = statuses.length ? 'arc-ready-1.1-table' : 'legacy-bullets';
  if (!statuses.length) statuses.push(...parseBulletLedger(lines));
  const issues = validateLedgerRecords(statuses, view, format);
  statuses.sort((left, right) => Number(left.step || 0) - Number(right.step || 0)
    || left.tier.localeCompare(right.tier, undefined, { numeric: true }));
  issues.sort((left, right) => String(left.tier).localeCompare(String(right.tier), undefined, { numeric: true })
    || String(left.path || '').localeCompare(String(right.path || ''))
    || left.kind.localeCompare(right.kind));
  return { source: progressPath, format, statuses, issues };
}

function parseTableLedger(lines) {
  const statuses = [];
  let inLedger = false;
  for (const line of lines) {
    const cells = markdownCells(line);
    if (!cells) continue;
    const normalized = cells.map((cell) => cell.toLowerCase());
    if (normalized[0] === 'step' && normalized[1] === 'tier' && normalized[2] === 'status') {
      inLedger = true;
      continue;
    }
    if (!inLedger || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (!/^\d+$/.test(cells[0] || '') || cells.length < 4) {
      if (statuses.length) break;
      continue;
    }
    const tierName = cells[1].replace(/`/g, '').trim().toLowerCase();
    statuses.push({
      step: Number(cells[0]),
      tier: TIER_IDS[tierName] || tierName,
      tier_name: tierName,
      label: null,
      status: cells[2].trim().toLowerCase(),
      declared_artifacts: extractArtifactPaths(cells[3]),
      invocation_ts: (cells[4] || '').trim() || null,
      verification_ts: (cells[5] || '').trim() || null,
      disk_state_hash: (cells[6] || '').trim() || null,
      notes: (cells[7] || '').trim() || null
    });
  }
  return statuses;
}

function markdownCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function parseBulletLedger(lines) {
  const statuses = [];
  for (const line of lines) {
    const row = line.match(/^\s*-\s*([0-9]+(?:\.[0-9]+)?)(?:\s+\(([^)]+)\))?\s*:\s*([^|]+)(.*)$/);
    if (!row) continue;
    const artifactSegment = row[4].split('|').find((segment) => /artifact\s*:/i.test(segment));
    statuses.push({
      tier: row[1],
      label: row[2] || null,
      status: row[3].trim().toLowerCase().split(/\s+/)[0],
      declared_artifacts: artifactSegment
        ? extractArtifactPaths(artifactSegment.replace(/^.*?artifact\s*:/i, ''))
        : []
    });
  }
  return statuses;
}

function validateLedgerRecords(statuses, view, format) {
  const issues = [];
  for (const record of statuses) {
    if (!LEDGER_STATUSES.has(record.status)) {
      issues.push({ tier: record.tier, status: record.status, path: '', kind: 'invalid-status' });
      continue;
    }
    if (format === 'arc-ready-1.1-table') {
      if (record.status === 'skipped' && !record.notes) issues.push({ tier: record.tier, status: record.status, path: '', kind: 'skip-without-reason' });
      if (['in-flight', 'done', 'failed', 're-invoked'].includes(record.status) && !record.invocation_ts) {
        issues.push({ tier: record.tier, status: record.status, path: '', kind: 'missing-invocation-timestamp' });
      }
      if (COMPLETED_LEDGER_STATUSES.has(record.status) && (!record.verification_ts || !record.disk_state_hash)) {
        issues.push({ tier: record.tier, status: record.status, path: '', kind: 'incomplete-verification-record' });
      }
    }
    if (!COMPLETED_LEDGER_STATUSES.has(record.status)) continue;
    if (!record.declared_artifacts.length) issues.push({ tier: record.tier, status: record.status, path: '', kind: 'missing-artifact-path' });
    for (const artifactPath of record.declared_artifacts) {
      if (!view.pathSet.has(artifactPath)) {
        issues.push({ tier: record.tier, status: record.status, path: artifactPath, kind: 'missing-artifact' });
        continue;
      }
      const artifact = view.read(artifactPath, true);
      if (artifact === null) issues.push({ tier: record.tier, status: record.status, path: artifactPath, kind: 'unreadable-artifact' });
      else if (artifact.length === 0) issues.push({ tier: record.tier, status: record.status, path: artifactPath, kind: 'empty-artifact' });
    }
  }
  if (format === 'arc-ready-1.1-table') validateTableCompleteness(statuses, issues);
  return issues;
}

function validateTableCompleteness(statuses, issues) {
  const byTier = new Map();
  for (const record of statuses) {
    const existing = byTier.get(record.tier_name);
    if (existing && existing.status !== 're-invoked' && record.status !== 're-invoked') {
      issues.push({ tier: record.tier, status: record.status, path: '', kind: 'duplicate-ledger-tier' });
    }
    byTier.set(record.tier_name, record);
  }
  for (const tierName of TIER_ORDER) {
    if (!byTier.has(tierName)) issues.push({ tier: TIER_IDS[tierName], status: 'unknown', path: '', kind: 'missing-ledger-tier' });
  }
  for (let index = 0; index < TIER_ORDER.length; index += 1) {
    const tierName = TIER_ORDER[index];
    const current = byTier.get(tierName);
    if (!current || ['pending', 'skipped'].includes(current.status)) continue;
    const dependencies = index < 8 ? TIER_ORDER.slice(0, index) : TIER_ORDER.slice(0, 8);
    const incomplete = dependencies.find((dependency) => {
      const record = byTier.get(dependency);
      return !record || !COMPLETE_FOR_DEPENDENCY.has(record.status);
    });
    if (incomplete) issues.push({
      tier: current.tier,
      status: current.status,
      path: '',
      kind: 'dependency-order-violation',
      depends_on: incomplete
    });
  }
}

function inventoryArtifacts(view) {
  const canonical = catalog.artifacts.canonical.map((entry) => inventoryEntry(entry, view, 'arc-ready'));
  const legacy = catalog.artifacts.legacy.map((entry) => ({
    ...inventoryEntry(entry, view, 'ready-suite-legacy'),
    replaced_by: entry.replaced_by
  }));
  const known = new Set([...canonical, ...legacy].map((entry) => entry.path));
  const discovered = view.paths
    .filter((relative) => /^\.(arc|prd|architecture|roadmap|stack|repo|production|deploy|observe|launch|harden)-ready\//.test(relative))
    .filter((relative) => !known.has(relative))
    .map((relative) => inventoryEntry({ id: 'companion', tier: null, path: relative }, view, 'arc-ready-companion'));
  const ledger = parseLedger(view);
  if (ledger.format === 'arc-ready-1.1-table') {
    const declared = new Set(ledger.statuses.flatMap((record) => record.declared_artifacts));
    for (const artifact of canonical) {
      if (['arc-progress', 'launch-prepublication'].includes(artifact.id)) continue;
      if (artifact.present && artifact.bytes > 0 && !declared.has(artifact.path)) {
        ledger.issues.push({ tier: artifact.tier, status: 'unknown', path: artifact.path, kind: 'unrecorded-artifact' });
      }
    }
  }
  const freshness = computeArtifactFreshness(canonical);
  const prepublication = inspectPrepublicationGate(view, canonical);
  return { canonical, legacy, discovered, ledger, freshness, prepublication };
}

function computeArtifactFreshness(canonical) {
  const byTier = new Map(canonical.filter((entry) => entry.id !== 'launch-prepublication').map((entry) => [entry.tier, entry]));
  const orderedTiers = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '3.1', '3.2'];
  const issues = [];
  for (let index = 1; index < orderedTiers.length; index += 1) {
    const upstream = byTier.get(orderedTiers[index - 1]);
    const downstream = byTier.get(orderedTiers[index]);
    if (!upstream || !downstream || upstream.changed_at_ms === null || downstream.changed_at_ms === null) continue;
    if (upstream.changed_at_ms > downstream.changed_at_ms + 1000) {
      issues.push({
        tier: downstream.tier,
        path: downstream.path,
        kind: 'stale-downstream-artifact',
        upstream: upstream.path
      });
    }
  }
  return { method: 'git-last-change-with-mtime-fallback', issues };
}

function inspectPrepublicationGate(view, canonical) {
  const prepublication = canonical.find((entry) => entry.id === 'launch-prepublication');
  const hardening = canonical.find((entry) => entry.id === 'harden');
  if (!prepublication || !prepublication.present) return { present: false, status: 'not-recorded', issues: [] };
  const raw = view.read(prepublication.path, true);
  const text = raw === null ? '' : raw.toString('utf8');
  const field = (name) => {
    const match = text.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'));
    return match ? match[1].trim() : null;
  };
  const checkedAt = field('checked_at');
  const hardeningRevision = field('hardening_revision');
  const verdict = (field('verdict') || '').toLowerCase() || null;
  const issues = [];
  if (!checkedAt || Number.isNaN(Date.parse(checkedAt))) issues.push({ kind: 'invalid-checked-at' });
  if (!hardeningRevision) issues.push({ kind: 'missing-hardening-revision' });
  else if (!/^[a-f0-9]{7,64}$/i.test(hardeningRevision)) issues.push({ kind: 'invalid-hardening-revision' });
  if (!hardening || !hardening.present || !hardening.sha256) issues.push({ kind: 'missing-hardening-artifact' });
  if (!['pass', 'block'].includes(verdict)) issues.push({ kind: 'invalid-prepublication-verdict' });
  if (hardening && hardening.changed_at_ms !== null && prepublication.changed_at_ms !== null
    && hardening.changed_at_ms > prepublication.changed_at_ms + 1000) {
    issues.push({ kind: 'stale-prepublication', upstream: hardening.path });
  }
  let revisionMatches = null;
  let revisionMatchKind = null;
  if (hardeningRevision && hardening && hardening.sha256 && /^[a-f0-9]{7,64}$/i.test(hardeningRevision)) {
    if (hardening.sha256.startsWith(hardeningRevision.toLowerCase())) {
      revisionMatches = true;
      revisionMatchKind = 'content-sha256';
    } else {
      const historical = view.readAtRevision(hardening.path, hardeningRevision);
      if (historical !== null) {
        revisionMatches = sha256(historical) === hardening.sha256;
        revisionMatchKind = 'git-revision';
      } else if (hardeningRevision.length > 40) {
        revisionMatches = false;
        revisionMatchKind = 'content-sha256';
      }
    }
    if (revisionMatches === false) issues.push({ kind: 'hardening-revision-mismatch' });
    if (revisionMatches === null) issues.push({ kind: 'unverifiable-hardening-revision' });
  }
  return {
    present: true,
    status: issues.length ? 'invalid' : verdict,
    checked_at: checkedAt,
    hardening_revision: hardeningRevision,
    hardening_revision_matches_content: revisionMatches,
    hardening_revision_match_kind: revisionMatchKind,
    verdict,
    issues
  };
}

function validateProjectContextCatalog(input = catalog) {
  const errors = [];
  const expectedForms = ['web-application', 'api-service', 'cli-sdk', 'mobile-desktop', 'data-ml', 'infrastructure-iac'];
  if (!input || input.schema_version !== '1.0') return ['project-context catalog must use schema_version 1.0'];
  if (!input.source || input.source.name !== 'arc-ready' || input.source.version !== '1.1.0') errors.push('project-context source must be arc-ready@1.1.0');
  if (!Array.isArray(input.forms) || JSON.stringify(input.forms.map((form) => form.id)) !== JSON.stringify(expectedForms)) {
    errors.push('project-context catalog must define the six forms in canonical order');
  }
  const formIds = new Set(expectedForms);
  for (const form of input.forms || []) {
    if (!Array.isArray(form.signals) || form.signals.length < 2) errors.push(`form ${form.id} requires at least two signals`);
    if (new Set((form.signals || []).map((signal) => signal.id)).size !== (form.signals || []).length) errors.push(`form ${form.id} has duplicate signal ids`);
  }
  if (!Array.isArray(input.profiles) || input.profiles.length !== 37) errors.push('project-context catalog must contain 37 profiles');
  const profileIds = new Set();
  const profileSlugs = new Set();
  for (const profile of input.profiles || []) {
    if (profileIds.has(profile.id)) errors.push(`duplicate profile id ${profile.id}`);
    if (profileSlugs.has(profile.slug)) errors.push(`duplicate profile slug ${profile.slug}`);
    profileIds.add(profile.id);
    profileSlugs.add(profile.slug);
    if (!Array.isArray(profile.roles) || profile.roles.length === 0) errors.push(`profile ${profile.id} requires roles`);
    if (!Array.isArray(profile.signals) || profile.signals.length < 5) errors.push(`profile ${profile.id} requires at least five signals`);
    for (const form of profile.common_forms || []) if (!formIds.has(form)) errors.push(`profile ${profile.id} references unknown form ${form}`);
  }
  for (let id = 1; id <= 37; id += 1) if (!profileIds.has(id)) errors.push(`project-context catalog is missing profile id ${id}`);
  const regulationIds = (input.regulations || []).map((item) => item.id);
  if (new Set(regulationIds).size !== regulationIds.length) errors.push('project-context catalog has duplicate regulation ids');
  const artifactPaths = [...(input.artifacts || {}).canonical || [], ...(input.artifacts || {}).legacy || []].map((item) => item.path);
  if (new Set(artifactPaths).size !== artifactPaths.length) errors.push('project-context catalog has duplicate artifact paths');
  return errors;
}

function analyzeProjectContext(root, paths, contentsByPath) {
  const catalogErrors = validateProjectContextCatalog();
  if (catalogErrors.length) throw new Error(catalogErrors.join('; '));
  const view = createRepositoryView(root, paths, contentsByPath);
  const forms = matchForms(view);
  const profiles = matchProfiles(view);
  const result = {
    schema_version: '1.0',
    catalog_source: `${catalog.source.name}@${catalog.source.version}`,
    mode: 'static-local',
    root: path.basename(view.absoluteRoot),
    project_forms: forms,
    product_archetype: profiles.product_archetype,
    industry_overlays: profiles.industry_overlays,
    regulatory_overlays: matchRegulations(view),
    artifacts: inventoryArtifacts(view),
    limitations: [
      'Candidate context is derived from repository paths and text only.',
      'Regulatory candidates require jurisdiction and applicability verification.',
      'No project code, tests, build scripts, models, infrastructure, or network requests were executed.'
    ]
  };
  const volatileFields = new Set(['mtime_ms', 'changed_at_ms', 'timestamp_source']);
  return { ...result, fingerprint_sha256: sha256(JSON.stringify(result, (key, value) => volatileFields.has(key) ? undefined : value)) };
}

module.exports = { analyzeProjectContext, isExcludedContextPath, validateProjectContextCatalog };
