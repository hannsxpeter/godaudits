'use strict';

// Change-safety reviews are separate from repository audit state. Planning is
// static and runs only Git reads. Executable and running-app proof is produced
// by an explicitly authorized external harness, then imported with apply.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { redactSecrets } = require('./evidence');

const PROOF_LEVELS = Object.freeze({
  1: { kind: 'assertion', label: 'unproven assertion' },
  2: { kind: 'citation', label: 'source citation' },
  3: { kind: 'failure-path', label: 'failure path shown unreachable' },
  4: { kind: 'executable', label: 'executable proof against shipped code' },
  5: { kind: 'running-app', label: 'running-app reproduction' }
});

const LEAD_ROUTES = Object.freeze({
  'direct-reference': { domains: ['architecture', 'code-quality'], checks: ['A-ARCH-6', 'A-CODE-2'] },
  'public-contract': { domains: ['architecture', 'build'], checks: ['A-ARCH-23', 'A-BUILD-13'] },
  'database-schema': { domains: ['database', 'deploy'], checks: ['A-DB-16', 'A-DB-17', 'A-DEPLOY-5'] },
  'dependency-version': { domains: ['stack', 'security', 'build'], checks: ['A-CODE-24', 'A-SEC-26', 'A-BUILD-14'] },
  'configuration-flag': { domains: ['code-quality'], checks: ['A-CODE-18', 'A-CODE-25'] },
  'serialization-wire': { domains: ['architecture', 'build'], checks: ['A-ARCH-23', 'A-BUILD-13'] },
  'cross-language': { domains: ['architecture', 'build', 'style-genome'], checks: ['A-ARCH-23', 'A-BUILD-13', 'A-DNA-12'] },
  'async-lifecycle': { domains: ['architecture', 'code-quality'], checks: ['A-ARCH-8', 'A-ARCH-25', 'A-CODE-25'] },
  'cache-invalidation': { domains: ['architecture', 'code-quality'], checks: ['A-ARCH-24', 'A-CODE-16'] },
  'generated-artifact': { domains: ['repo'], checks: ['A-REPO-4'] },
  'public-entry-point': { domains: ['architecture', 'security', 'build'], checks: ['A-ARCH-23', 'A-SEC-29', 'A-BUILD-13'] },
  'audit-finding': { domains: [], checks: [] }
});

const LANGUAGE_EXTENSIONS = Object.freeze({
  '.c': 'C', '.cc': 'C++', '.cpp': 'C++', '.cs': 'C#', '.go': 'Go', '.java': 'Java',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.kt': 'Kotlin', '.php': 'PHP', '.py': 'Python',
  '.rb': 'Ruby', '.rs': 'Rust', '.swift': 'Swift', '.ts': 'TypeScript', '.tsx': 'TypeScript'
});

const LIKELIHOODS = new Set(['rare', 'unlikely', 'possible', 'likely', 'almost-certain']);
const CONSEQUENCES = new Set(['Critical', 'High', 'Medium', 'Low']);

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value, limit = 2000) {
  return redactSecrets(String(value || '')).text.slice(0, limit);
}

function runGit(repo, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout || 'unknown error').trim()}`);
  }
  return result.status === 0 ? result.stdout : '';
}

function resolveRevision(repo, revision) {
  if (!revision || /^-/.test(revision)) throw new Error('base and head revisions must be explicit non-option values');
  return runGit(repo, ['rev-parse', '--verify', `${revision}^{commit}`]).trim();
}

function parseNameStatus(output) {
  const tokens = output.split('\0');
  if (tokens[tokens.length - 1] === '') tokens.pop();
  const files = [];
  for (let index = 0; index < tokens.length;) {
    const rawStatus = tokens[index++];
    if (!rawStatus) continue;
    const code = rawStatus[0];
    let previousPath = null;
    let filePath;
    if (code === 'R' || code === 'C') {
      previousPath = tokens[index++];
      filePath = tokens[index++];
    } else {
      filePath = tokens[index++];
    }
    if (!filePath) continue;
    files.push({
      status: ({ A: 'added', C: 'copied', D: 'deleted', M: 'modified', R: 'renamed', T: 'type-changed' })[code] || 'changed',
      path: filePath,
      ...(previousPath ? { previous_path: previousPath } : {})
    });
  }
  return files;
}

function parseNumstat(output) {
  const stats = new Map();
  for (const line of output.split('\n')) {
    if (!line) continue;
    const [added, deleted, ...rest] = line.split('\t');
    const filePath = rest.join('\t');
    if (!filePath) continue;
    stats.set(filePath, {
      additions: added === '-' ? null : Number(added),
      deletions: deleted === '-' ? null : Number(deleted)
    });
  }
  return stats;
}

function symbolFromLine(line) {
  const declaration = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|def|func|type|interface|enum|struct)\s+([A-Za-z_$][\w$]*)/);
  if (declaration) return declaration[1];
  const method = line.match(/^(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:\{|=>|:)/);
  return method ? method[1] : null;
}

function parsePatch(patch) {
  const byPath = new Map();
  let current = null;
  for (const rawLine of patch.split('\n')) {
    if (rawLine.startsWith('+++ ')) {
      const marker = rawLine.slice(4);
      current = marker === '/dev/null' ? current : marker.replace(/^b\//, '');
      if (current && !byPath.has(current)) byPath.set(current, { symbols: new Set(), text: [] });
      continue;
    }
    if (rawLine.startsWith('--- ') && rawLine.slice(4) !== '/dev/null' && !current) {
      current = rawLine.slice(4).replace(/^a\//, '');
      if (!byPath.has(current)) byPath.set(current, { symbols: new Set(), text: [] });
      continue;
    }
    if (!current) continue;
    const record = byPath.get(current) || { symbols: new Set(), text: [] };
    byPath.set(current, record);
    if (rawLine.startsWith('diff --git ')) {
      current = null;
      continue;
    }
    if (rawLine.startsWith('@@')) {
      const tail = rawLine.replace(/^@@[^@]*@@\s*/, '').trim();
      const symbol = symbolFromLine(tail);
      if (symbol) record.symbols.add(symbol);
      continue;
    }
    if ((rawLine.startsWith('+') || rawLine.startsWith('-')) && !rawLine.startsWith('+++') && !rawLine.startsWith('---')) {
      const changed = rawLine.slice(1).trim();
      record.text.push(changed);
      const symbol = symbolFromLine(changed);
      if (symbol) record.symbols.add(symbol);
    }
  }
  return byPath;
}

function repositoryLanguages(repo, head) {
  const files = runGit(repo, ['ls-tree', '-r', '--name-only', '-z', head]).split('\0').filter(Boolean);
  return [...new Set(files.map((file) => LANGUAGE_EXTENSIONS[path.extname(file).toLowerCase()]).filter(Boolean))].sort();
}

function addLead(leads, kind, input) {
  const route = LEAD_ROUTES[kind] || { domains: [], checks: [] };
  const lead = {
    id: '',
    kind,
    summary: cleanText(input.summary, 400),
    basis: cleanText(input.basis, 600),
    source_paths: [...new Set(input.source_paths || [])].sort(),
    downstream_paths: [...new Set(input.downstream_paths || [])].sort(),
    symbols: [...new Set(input.symbols || [])].sort(),
    domains: [...new Set([...(route.domains || []), ...(input.domains || [])])].sort(),
    checks: [...new Set([...(route.checks || []), ...(input.checks || [])])].sort(),
    ...(input.finding_ids && input.finding_ids.length ? { finding_ids: [...new Set(input.finding_ids)].sort() } : {})
  };
  const key = JSON.stringify([lead.kind, lead.source_paths, lead.downstream_paths, lead.symbols, lead.finding_ids || []]);
  if (!leads.some((item) => item._key === key)) leads.push({ ...lead, _key: key });
}

function detectSurfaceLeads(files, patchByPath, languages) {
  const leads = [];
  let carriesSharedContract = false;
  for (const file of files) {
    const record = patchByPath.get(file.path) || patchByPath.get(file.previous_path) || { symbols: new Set(), text: [] };
    const changedText = record.text.join('\n');
    const lowerPath = file.path.toLowerCase();
    const source = [file.path];
    const symbols = [...record.symbols];

    if (/(^|\/)(openapi|swagger|asyncapi)(\.|\/)|\.proto$|\.graphqls?$|(^|\/)api\/.*schema|(^|\/)schemas?\/.*\.json$/i.test(file.path)) {
      carriesSharedContract = true;
      addLead(leads, 'public-contract', {
        summary: `Public contract changed in ${file.path}.`,
        basis: 'Machine-readable API or message contracts can affect consumers that do not import the changed implementation.',
        source_paths: source,
        symbols
      });
    }
    if (/(^|\/)(migrations?|prisma\/schema|db\/schema|schema\.(sql|prisma))|\.sql$/i.test(file.path)) {
      addLead(leads, 'database-schema', {
        summary: `Persistent data shape changed in ${file.path}.`,
        basis: 'Schema changes can break older application revisions, backfills, rollback, and downstream readers.',
        source_paths: source,
        symbols
      });
    }
    if (/(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements[^/]*\.txt|poetry\.lock|pyproject\.toml|go\.(mod|sum)|cargo\.(toml|lock)|composer\.(json|lock)|gemfile(\.lock)?|patches\/)/i.test(file.path)) {
      addLead(leads, 'dependency-version', {
        summary: `Dependency resolution changed in ${file.path}.`,
        basis: 'Pinned library behavior and local patches can change without a source-level caller changing.',
        source_paths: source,
        symbols
      });
    }
    if (/(^|\/)(config|configs|feature-flags?|flags|env)(\/|\.|$)/i.test(file.path)
      || /\b(feature[_-]?flag|flagEnabled|isEnabled|process\.env|import\.meta\.env|config\.)\b/i.test(changedText)) {
      addLead(leads, 'configuration-flag', {
        summary: `Configuration-controlled behavior changed in ${file.path}.`,
        basis: 'Configuration and feature flags can select behavior through string keys rather than imports.',
        source_paths: source,
        symbols
      });
    }
    if (/\b(JSON\.(?:parse|stringify)|serialize|deserialize|marshal|unmarshal|encode|decode|protobuf|messagepack|avro|wire format)\b/i.test(changedText)
      || /\.(proto|graphqls?)$/i.test(file.path)) {
      carriesSharedContract = true;
      addLead(leads, 'serialization-wire', {
        summary: `Serialized or wire behavior changed in ${file.path}.`,
        basis: 'Readers can consume the same bytes without sharing a symbol or language with the writer.',
        source_paths: source,
        symbols
      });
    }
    if (/\b(queue|enqueue|publish|consumer|microtask|setTimeout|setImmediate|useEffect|unmount|teardown|dispose|cleanup|close|state transition|transitionTo|afterCommit)\b/i.test(changedText)) {
      addLead(leads, 'async-lifecycle', {
        summary: `Asynchronous or lifecycle ordering changed in ${file.path}.`,
        basis: 'Timing, teardown, retries, and state transitions can break paths that a static caller list does not order.',
        source_paths: source,
        symbols
      });
    }
    if (/\b(cache|cached|invalidate|evict|ttl|s-maxage|Cache-Control)\b/i.test(`${file.path}\n${changedText}`)) {
      addLead(leads, 'cache-invalidation', {
        summary: `Cache behavior changed in ${file.path}.`,
        basis: 'Cache keys, invalidation, and rolling-version overlap affect writers and readers beyond the helper call.',
        source_paths: source,
        symbols
      });
    }
    if (/(^|\/)(generated|gen|dist|build)(\/|$)|\.generated\.|\.g\.[^.]+$/i.test(file.path)
      || /\b(codegen|generated by|do not edit)\b/i.test(changedText)) {
      addLead(leads, 'generated-artifact', {
        summary: `Generated surface changed in ${file.path}.`,
        basis: 'The source generator and every downstream generated artifact must remain synchronized.',
        source_paths: source,
        symbols
      });
    }
    if (/(^|\/)(routes?|controllers?|handlers?|api|public|cmd|bin)(\/|\.)/i.test(file.path)
      || /\b(module\.exports|exports\.|export\s+(?:default|function|class|const)|router\.(?:get|post|put|patch|delete)|app\.(?:get|post|put|patch|delete))\b/i.test(changedText)) {
      addLead(leads, 'public-entry-point', {
        summary: `Externally reachable entry point changed in ${file.path}.`,
        basis: 'Public exports and route registration can be reached by callers outside the primary interactive path.',
        source_paths: source,
        symbols
      });
    }
  }
  if (carriesSharedContract && languages.length > 1) {
    const contractPaths = leads.filter((lead) => ['public-contract', 'serialization-wire'].includes(lead.kind)).flatMap((lead) => lead.source_paths);
    addLead(leads, 'cross-language', {
      summary: `A shared contract changed in a repository containing ${languages.join(', ')}.`,
      basis: 'Consumers in another language can read the same contract or bytes without appearing in a same-language symbol graph.',
      source_paths: contractPaths
    });
  }
  return leads;
}

function directReferenceLeads(repo, head, files, patchByPath) {
  const changedPaths = new Set(files.flatMap((file) => [file.path, file.previous_path].filter(Boolean)));
  const leads = [];
  const candidates = [];
  for (const file of files) {
    const record = patchByPath.get(file.path) || patchByPath.get(file.previous_path);
    for (const symbol of record ? record.symbols : []) {
      if (symbol.length >= 3) candidates.push({ source: file.path, symbol });
    }
  }
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.symbol}`;
    if (!seen.has(key) && unique.length < 24) {
      seen.add(key);
      unique.push(candidate);
    }
  }
  for (const candidate of unique) {
    const output = runGit(repo, ['grep', '-l', '-F', '-e', candidate.symbol, head, '--'], { allowFailure: true });
    const downstream = output.split('\n').filter(Boolean).map((line) => {
      const prefix = `${head}:`;
      return line.startsWith(prefix) ? line.slice(prefix.length) : line.replace(/^[^:]+:/, '');
    }).filter((file) => file && !changedPaths.has(file)).slice(0, 50);
    if (!downstream.length) continue;
    addLead(leads, 'direct-reference', {
      summary: `${candidate.symbol} changed in ${candidate.source} and is referenced outside the diff.`,
      basis: 'Direct reverse references are inventory leads; contract and lifecycle resolvers still inspect paths a symbol graph cannot see.',
      source_paths: [candidate.source],
      downstream_paths: downstream,
      symbols: [candidate.symbol]
    });
  }
  return leads;
}

function auditLeads(audit, changedPaths) {
  if (!audit || !Array.isArray(audit.findings) || !Array.isArray(audit.evidence)) return [];
  const evidenceById = new Map(audit.evidence.map((item) => [item.id, item]));
  const leads = [];
  for (const finding of audit.findings) {
    if (!['open', 'accepted-risk'].includes(finding.status)) continue;
    const touched = (finding.evidence || []).map((id) => evidenceById.get(id)).filter((item) => item && changedPaths.has(item.path));
    if (!touched.length) continue;
    addLead(leads, 'audit-finding', {
      summary: `${finding.id} cites a file changed by this diff.`,
      basis: 'A current audit finding or accepted risk depends on changed source evidence and must be re-evaluated.',
      source_paths: touched.map((item) => item.path),
      domains: [finding.domain],
      checks: finding.checks || [],
      finding_ids: [finding.id]
    });
  }
  return leads;
}

function finalizeLeads(leads) {
  return leads.map(({ _key, ...lead }) => lead)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.summary.localeCompare(b.summary))
    .map((lead, index) => ({ ...lead, id: `BRL-${String(index + 1).padStart(3, '0')}` }));
}

function deriveMergeGate(review) {
  const blocked = [];
  const unproven = [];
  const proofById = new Map((review.proofs || []).map((proof) => [proof.id, proof]));
  for (const fact of review.safety_facts || []) {
    const currentProof = proofById.get((fact.proof_ids || []).at(-1));
    if (fact.status === 'refuted') blocked.push(`${fact.id} was refuted.`);
    else if (fact.status !== 'proven' || fact.proof_level < 4 || !currentProof || currentProof.level < 4) {
      unproven.push(`${fact.id} is ${fact.status === 'proven' ? `proven only to level ${fact.proof_level}` : 'unproven'}; level 4 executable proof is required.`);
    }
  }
  for (const risk of review.risks || []) {
    if (risk.status === 'open' && ['Critical', 'High'].includes(risk.consequence)) {
      blocked.push(`${risk.id} is an open ${risk.consequence}-consequence risk.`);
    }
  }
  if (review.before_merge && review.before_merge.status === 'failed') blocked.push('The before-merge reproduction failed.');
  else {
    const beforeMergeProof = review.before_merge
      ? proofById.get((review.before_merge.proof_ids || []).at(-1))
      : null;
    if (!review.before_merge || review.before_merge.status !== 'passed' || !beforeMergeProof || beforeMergeProof.level < 4
      || beforeMergeProof.command !== review.before_merge.command) {
      unproven.push('The before-merge reproduction has not passed with executable proof.');
    }
  }
  const reasons = blocked.length ? blocked : unproven;
  return { status: blocked.length ? 'blocked' : (unproven.length ? 'unproven' : 'pass'), reasons };
}

function planBlastRadius(repo, options = {}) {
  const absoluteRepo = path.resolve(repo || process.cwd());
  if (!fs.existsSync(absoluteRepo)) throw new Error(`repository does not exist: ${absoluteRepo}`);
  runGit(absoluteRepo, ['rev-parse', '--git-dir']);
  const base = resolveRevision(absoluteRepo, options.base);
  const head = resolveRevision(absoluteRepo, options.head);
  if (base === head) throw new Error('base and head resolve to the same commit');
  const facts = [...new Set((options.facts || []).map((fact) => cleanText(fact, 400).trim()).filter(Boolean))];
  if (facts.length < 1 || facts.length > 2) throw new Error('blast-radius plan requires one or two --fact values');
  const verify = cleanText(options.verify, 1000).trim();
  if (!verify) throw new Error('blast-radius plan requires --verify with the cheapest before-merge test or reproduction');

  const nameStatus = runGit(absoluteRepo, ['diff', '--name-status', '-z', '--find-renames', base, head]);
  const files = parseNameStatus(nameStatus);
  if (!files.length) throw new Error('the selected revisions contain no changed files');
  const numstat = parseNumstat(runGit(absoluteRepo, ['diff', '--numstat', '--find-renames', base, head]));
  const patch = runGit(absoluteRepo, ['diff', '--no-ext-diff', '--no-color', '--unified=0', '--find-renames', base, head]);
  const patchByPath = parsePatch(patch);
  for (const file of files) {
    const stats = numstat.get(file.path) || { additions: null, deletions: null };
    const record = patchByPath.get(file.path) || patchByPath.get(file.previous_path);
    file.additions = stats.additions;
    file.deletions = stats.deletions;
    file.symbols = record ? [...record.symbols].sort() : [];
  }
  const languages = repositoryLanguages(absoluteRepo, head);
  const leads = detectSurfaceLeads(files, patchByPath, languages);
  leads.push(...directReferenceLeads(absoluteRepo, head, files, patchByPath));
  const changedPaths = new Set(files.flatMap((file) => [file.path, file.previous_path].filter(Boolean)));
  leads.push(...auditLeads(options.audit, changedPaths));
  const impactLeads = finalizeLeads(leads);
  const date = options.date || today();
  const review = {
    schema_version: '1.0',
    review: {
      repository: path.basename(absoluteRepo),
      created: date,
      updated: date,
      base,
      head,
      diff_sha256: hash(patch),
      capabilities: ['static'],
      limitations: [
        'Static planning only. Git metadata and diffs were read; application code, tests, live systems, network requests, and models were not executed.',
        'Impact leads are routing evidence, not confirmed risks. A reviewer must trace, refute, and prove them.',
        'A merge pass requires every safety fact and the before-merge reproduction to reach proof level 4 or 5.'
      ]
    },
    change: {
      summary: `${files.length} changed file${files.length === 1 ? '' : 's'} with ${files.reduce((sum, item) => sum + (item.additions || 0), 0)} additions and ${files.reduce((sum, item) => sum + (item.deletions || 0), 0)} deletions.`,
      languages,
      files
    },
    impact_leads: impactLeads,
    affected_domains: [...new Set(impactLeads.flatMap((lead) => lead.domains))].sort(),
    affected_checks: [...new Set(impactLeads.flatMap((lead) => lead.checks))].sort(),
    safety_facts: facts.map((claim, index) => ({
      id: `SF-${index + 1}`,
      claim,
      status: 'unproven',
      proof_level: 1,
      proof_kind: 'assertion',
      proof_ids: [],
      stopped_because: 'No proof result has been applied.'
    })),
    proofs: [],
    risks: [],
    cleared: [],
    before_merge: { command: verify, status: 'unproven', proof_ids: [] },
    merge_gate: { status: 'unproven', reasons: [] }
  };
  review.merge_gate = deriveMergeGate(review);
  const errors = validateChangeReview(review);
  if (errors.length) throw new Error(errors.join('\n'));
  return review;
}

function proofErrors(proof) {
  const errors = [];
  if (!proof || typeof proof !== 'object') return ['proof must be an object'];
  if (!Number.isInteger(proof.level) || !PROOF_LEVELS[proof.level]) errors.push('proof.level must be an integer from 1 to 5');
  else if (proof.kind !== PROOF_LEVELS[proof.level].kind) errors.push(`proof level ${proof.level} requires kind ${PROOF_LEVELS[proof.level].kind}`);
  if ([2, 3].includes(proof.level)) {
    if (!proof.path || !Number.isInteger(proof.line) || proof.line < 1 || !proof.quote || !/^[a-f0-9]{64}$/.test(proof.sha256 || '')) {
      errors.push(`proof level ${proof.level} requires path, positive line, quote, and sha256`);
    }
  }
  if (proof.level === 3 && (!Array.isArray(proof.steps) || proof.steps.length < 2)) errors.push('proof level 3 requires at least two failure-path steps');
  if ([4, 5].includes(proof.level)) {
    for (const field of ['tool', 'tool_version', 'command', 'result', 'environment', 'isolation']) {
      if (!proof[field]) errors.push(`proof level ${proof.level} requires ${field}`);
    }
  }
  return errors;
}

function normalizeProof(input, id, authorization) {
  const proof = clone(input || {});
  const output = { id, level: proof.level, kind: proof.kind };
  for (const field of ['path', 'quote', 'sha256', 'tool', 'tool_version', 'command', 'result', 'environment', 'isolation']) {
    if (proof[field] !== undefined) output[field] = cleanText(proof[field], field === 'quote' || field === 'result' ? 2000 : 1000);
  }
  if (proof.line !== undefined) output.line = proof.line;
  if (Array.isArray(proof.steps)) output.steps = proof.steps.map((step) => cleanText(step, 600));
  if ([4, 5].includes(proof.level) && authorization) {
    output.capability = authorization.capability;
    output.authorized_by = cleanText(authorization.authorized_by, 200);
  }
  output.redacted = JSON.stringify(output) !== JSON.stringify({ id, ...proof });
  return output;
}

function nextSequence(items, prefix) {
  const values = (items || []).map((item) => Number(String(item.id || '').replace(`${prefix}-`, ''))).filter(Number.isInteger);
  return (values.length ? Math.max(...values) : 0) + 1;
}

function applyBlastRadiusResults(inputReview, results) {
  const review = clone(inputReview);
  const errors = validateChangeReview(review);
  if (!results || results.schema_version !== '1.0') errors.push('results.schema_version must be 1.0');
  if (!results || !results.review) errors.push('results.review must bind proof to the reviewed base, head, and diff_sha256');
  else {
    for (const field of ['base', 'head', 'diff_sha256']) {
      if (results.review[field] !== review.review[field]) errors.push(`results.review.${field} does not match the change review`);
    }
  }
  const factResults = results && Array.isArray(results.safety_facts) ? results.safety_facts : [];
  const riskResults = results && Array.isArray(results.risks) ? results.risks : [];
  const clearedResults = results && Array.isArray(results.cleared) ? results.cleared : [];
  const factResultIds = factResults.map((item) => item && item.fact).filter(Boolean);
  if (new Set(factResultIds).size !== factResultIds.length) errors.push('results.safety_facts must contain at most one result per fact');
  const proofInputs = [
    ...factResults.map((item) => item.proof),
    ...riskResults.map((item) => item.proof),
    ...clearedResults.map((item) => item.proof),
    ...(results && results.before_merge && results.before_merge.proof ? [results.before_merge.proof] : [])
  ].filter(Boolean);
  const needsAuthority = proofInputs.some((proof) => proof && proof.level >= 4);
  const authorization = results && results.authorization;
  const validAuthorization = authorization && ['sandbox', 'connected'].includes(authorization.capability)
    && authorization.authorized_by && authorization.environment && authorization.isolation;
  if (authorization && !validAuthorization) {
    errors.push('results authorization requires capability, authorized_by, environment, and isolation');
  }
  if (needsAuthority) {
    if (!validAuthorization) errors.push('executable or running-app proof requires valid results authorization');
    if (authorization) {
      for (const proof of proofInputs.filter((item) => item && item.level >= 4)) {
        if (proof.environment !== authorization.environment || proof.isolation !== authorization.isolation) {
          errors.push('executable proof environment and isolation must match the results authorization');
          break;
        }
      }
    }
  }
  if (errors.length) return { review, errors: [...new Set(errors)] };

  if (authorization && needsAuthority) {
    if (!review.review.capabilities.includes(authorization.capability)) review.review.capabilities.push(authorization.capability);
    review.review.capabilities.sort();
  }
  let proofSequence = nextSequence(review.proofs, 'P');
  function addProof(proof, context) {
    const localErrors = proofErrors(proof).map((error) => `${context}: ${error}`);
    if (localErrors.length) {
      errors.push(...localErrors);
      return null;
    }
    const id = `P-${String(proofSequence++).padStart(3, '0')}`;
    review.proofs.push(normalizeProof(proof, id, authorization));
    return id;
  }

  for (const result of factResults) {
    const fact = review.safety_facts.find((item) => item.id === result.fact);
    if (!fact) {
      errors.push(`unknown safety fact: ${result.fact}`);
      continue;
    }
    if (!['proven', 'refuted', 'unproven'].includes(result.outcome)) {
      errors.push(`${fact.id} outcome must be proven, refuted, or unproven`);
      continue;
    }
    const proofId = addProof(result.proof, fact.id);
    if (!proofId) continue;
    fact.proof_ids.push(proofId);
    fact.status = result.outcome;
    fact.proof_level = result.proof.level;
    fact.proof_kind = result.proof.kind;
    fact.stopped_because = result.outcome === 'proven' && result.proof.level >= 4
      ? null
      : cleanText(result.stopped_because || `Proof stopped at level ${result.proof.level}.`, 400);
  }

  let riskSequence = nextSequence(review.risks, 'BR');
  for (const result of riskResults) {
    if (!result.title || !result.mechanism || !LIKELIHOODS.has(result.likelihood)
      || !CONSEQUENCES.has(result.consequence) || !result.verify) {
      errors.push('each risk requires title, mechanism, likelihood, consequence, and verify');
      continue;
    }
    const proofId = addProof(result.proof, `risk ${result.title}`);
    if (!proofId) continue;
    review.risks.push({
      id: `BR-${riskSequence++}`,
      title: cleanText(result.title, 300),
      mechanism: cleanText(result.mechanism, 600),
      likelihood: result.likelihood,
      consequence: result.consequence,
      verify: cleanText(result.verify, 1000),
      status: 'open',
      proof_ids: [proofId]
    });
  }

  let clearedSequence = nextSequence(review.cleared, 'CL');
  for (const result of clearedResults) {
    if (!result.title || !result.rationale || !result.invalidated_by) {
      errors.push('each cleared risk requires title, rationale, and invalidated_by');
      continue;
    }
    const proofId = addProof(result.proof, `cleared risk ${result.title}`);
    if (!proofId) continue;
    if (result.proof.level < 2) {
      errors.push(`cleared risk ${result.title} requires proof level 2 or higher`);
      continue;
    }
    review.cleared.push({
      id: `CL-${clearedSequence++}`,
      title: cleanText(result.title, 300),
      rationale: cleanText(result.rationale, 600),
      invalidated_by: cleanText(result.invalidated_by, 600),
      proof_level: result.proof.level,
      proof_ids: [proofId]
    });
  }

  if (results.before_merge) {
    if (!['passed', 'failed', 'unproven'].includes(results.before_merge.outcome)) errors.push('before_merge.outcome must be passed, failed, or unproven');
    else if (results.before_merge.proof) {
      const proofId = addProof(results.before_merge.proof, 'before_merge');
      if (proofId) {
        if (results.before_merge.proof.level < 4) errors.push('before_merge proof must reach level 4 or 5');
        if (results.before_merge.proof.command !== review.before_merge.command) {
          errors.push('before_merge proof command must exactly match the command selected during planning');
        }
        review.before_merge.status = results.before_merge.outcome;
        review.before_merge.proof_ids.push(proofId);
      }
    } else if (results.before_merge.outcome !== 'unproven') errors.push('a passed or failed before_merge result requires proof');
  }

  review.review.updated = results.date || today();
  review.merge_gate = deriveMergeGate(review);
  errors.push(...validateChangeReview(review));
  return { review, errors: [...new Set(errors)] };
}

function validateChangeReview(review) {
  const errors = [];
  if (!review || typeof review !== 'object') return ['change review must be an object'];
  if (review.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (!review.review || typeof review.review !== 'object') return [...errors, 'review metadata is required'];
  for (const field of ['repository', 'created', 'updated', 'base', 'head', 'diff_sha256']) if (!review.review[field]) errors.push(`review.${field} is required`);
  if (!/^[a-f0-9]{40,64}$/.test(review.review.base || '') || !/^[a-f0-9]{40,64}$/.test(review.review.head || '')) errors.push('review base and head must be full Git commit ids');
  if (!/^[a-f0-9]{64}$/.test(review.review.diff_sha256 || '')) errors.push('review.diff_sha256 must be a SHA-256 digest');
  if (!Array.isArray(review.review.capabilities) || !review.review.capabilities.includes('static')) errors.push('review.capabilities must include static');
  else if (review.review.capabilities.some((item) => !['static', 'sandbox', 'connected'].includes(item))
    || new Set(review.review.capabilities).size !== review.review.capabilities.length) {
    errors.push('review.capabilities must contain unique static, sandbox, or connected values');
  }
  if (!review.change || !Array.isArray(review.change.files) || review.change.files.length === 0) errors.push('change.files must contain at least one changed file');
  for (const field of ['impact_leads', 'affected_domains', 'affected_checks', 'safety_facts', 'proofs', 'risks', 'cleared']) {
    if (!Array.isArray(review[field])) errors.push(`${field} must be an array`);
  }
  if (errors.length) return errors;
  if (review.safety_facts.length < 1 || review.safety_facts.length > 2) errors.push('safety_facts must contain one or two facts');

  const proofIds = new Set();
  const proofById = new Map();
  for (const proof of review.proofs) {
    if (!/^P-\d{3,}$/.test(proof.id || '') || proofIds.has(proof.id)) errors.push(`invalid or duplicate proof id: ${proof.id}`);
    proofIds.add(proof.id);
    proofById.set(proof.id, proof);
    errors.push(...proofErrors(proof).map((error) => `${proof.id}: ${error}`));
    if (typeof proof.redacted !== 'boolean') errors.push(`${proof.id}.redacted must be a boolean`);
    if ([4, 5].includes(proof.level)
      && (!['sandbox', 'connected'].includes(proof.capability) || !proof.authorized_by)) {
      errors.push(`${proof.id} requires sandbox or connected capability and named authority`);
    }
  }

  const factIds = new Set();
  for (const fact of review.safety_facts) {
    if (!/^SF-[12]$/.test(fact.id || '') || factIds.has(fact.id)) errors.push(`invalid or duplicate safety fact id: ${fact.id}`);
    factIds.add(fact.id);
    if (!fact.claim || !['unproven', 'proven', 'refuted'].includes(fact.status)) errors.push(`${fact.id} requires a claim and valid status`);
    if (!PROOF_LEVELS[fact.proof_level] || fact.proof_kind !== PROOF_LEVELS[fact.proof_level].kind) errors.push(`${fact.id} has inconsistent proof level and kind`);
    for (const id of fact.proof_ids || []) if (!proofById.has(id)) errors.push(`${fact.id} references missing proof ${id}`);
    const currentProof = proofById.get((fact.proof_ids || []).at(-1));
    if (currentProof && (currentProof.level !== fact.proof_level || currentProof.kind !== fact.proof_kind)) {
      errors.push(`${fact.id} proof level and kind must match its current proof`);
    }
    if (fact.status !== 'unproven' && !currentProof) errors.push(`${fact.id} cannot be ${fact.status} without proof`);
    if (fact.status === 'proven' && fact.proof_level >= 4 && fact.stopped_because !== null) {
      errors.push(`${fact.id} must clear stopped_because after executable proof`);
    }
    if ((fact.status !== 'proven' || fact.proof_level < 4) && !fact.stopped_because) {
      errors.push(`${fact.id} must record why proof stopped`);
    }
  }
  for (const lead of review.impact_leads) {
    if (!/^BRL-\d{3,}$/.test(lead.id || '') || !LEAD_ROUTES[lead.kind] || !lead.summary || !lead.basis) errors.push(`${lead.id || 'impact lead'} is invalid`);
  }
  for (const risk of review.risks) {
    if (!/^BR-\d+$/.test(risk.id || '') || !LIKELIHOODS.has(risk.likelihood) || !CONSEQUENCES.has(risk.consequence) || risk.status !== 'open') errors.push(`${risk.id || 'risk'} is invalid`);
    if (!(risk.proof_ids || []).length) errors.push(`${risk.id} requires proof`);
    for (const id of risk.proof_ids || []) if (!proofById.has(id)) errors.push(`${risk.id} references missing proof ${id}`);
    const currentProof = proofById.get((risk.proof_ids || []).at(-1));
    if (currentProof && currentProof.level < 2) errors.push(`${risk.id} requires proof level 2 or higher`);
  }
  for (const cleared of review.cleared) {
    if (!/^CL-\d+$/.test(cleared.id || '') || !cleared.title || !cleared.rationale || !cleared.invalidated_by || cleared.proof_level < 2) errors.push(`${cleared.id || 'cleared risk'} is invalid`);
    if (!(cleared.proof_ids || []).length) errors.push(`${cleared.id} requires proof`);
    for (const id of cleared.proof_ids || []) if (!proofById.has(id)) errors.push(`${cleared.id} references missing proof ${id}`);
    const currentProof = proofById.get((cleared.proof_ids || []).at(-1));
    if (currentProof && currentProof.level !== cleared.proof_level) errors.push(`${cleared.id} proof_level must match its current proof`);
  }
  if (!review.before_merge || !review.before_merge.command || !['unproven', 'passed', 'failed'].includes(review.before_merge.status)) errors.push('before_merge requires command and valid status');
  else {
    for (const id of review.before_merge.proof_ids || []) if (!proofById.has(id)) errors.push(`before_merge references missing proof ${id}`);
    const currentProof = proofById.get((review.before_merge.proof_ids || []).at(-1));
    if (['passed', 'failed'].includes(review.before_merge.status) && (!currentProof || currentProof.level < 4)) {
      errors.push(`before_merge ${review.before_merge.status} requires level 4 or 5 proof`);
    }
    if (currentProof && currentProof.level >= 4 && currentProof.command !== review.before_merge.command) {
      errors.push('before_merge proof command must exactly match the planned command');
    }
  }
  const expectedGate = deriveMergeGate(review);
  if (!review.merge_gate || JSON.stringify(review.merge_gate) !== JSON.stringify(expectedGate)) errors.push('merge_gate must equal the derived change-safety disposition');
  return errors;
}

function tableCell(value) {
  return String(value === null || value === undefined || value === '' ? '-' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderBlastRadius(review) {
  const errors = validateChangeReview(review);
  if (errors.length) throw new Error(errors.join('\n'));
  const lines = [
    '# Change safety review',
    '',
    `Repository: ${review.review.repository}`,
    `Base: \`${review.review.base}\``,
    `Head: \`${review.review.head}\``,
    `Change: ${review.change.summary}`,
    `Merge disposition: ${review.merge_gate.status.toUpperCase()}`,
    '',
    '## Safety facts',
    '',
    '| Fact | Claim | Status | Proof |',
    '|---|---|---|---|'
  ];
  for (const fact of review.safety_facts) {
    lines.push(`| ${fact.id} | ${tableCell(fact.claim)} | ${fact.status} | Level ${fact.proof_level}: ${PROOF_LEVELS[fact.proof_level].label} |`);
  }
  lines.push('', '## Impact leads', '', '| Lead | Kind | Why it can escape grep | Paths | Checks |', '|---|---|---|---|---|');
  for (const lead of review.impact_leads) {
    const paths = [...lead.source_paths, ...lead.downstream_paths].join(', ');
    lines.push(`| ${lead.id} | ${lead.kind} | ${tableCell(lead.basis)} | ${tableCell(paths)} | ${tableCell(lead.checks.join(', '))} |`);
  }
  lines.push('', '## Confirmed risks', '');
  if (!review.risks.length) lines.push('No confirmed risks were recorded.');
  for (const risk of review.risks) {
    lines.push(`### ${risk.id}: ${risk.title}`, '', risk.mechanism, '', `Likelihood: ${risk.likelihood}`, `Consequence: ${risk.consequence}`, `Verify: \`${risk.verify}\``, '');
  }
  lines.push('## Cleared risks', '');
  if (!review.cleared.length) lines.push('No risks have been cleared yet.', '');
  for (const cleared of review.cleared) {
    lines.push(`### ${cleared.id}: ${cleared.title}`, '', cleared.rationale, '', `Invalidated by: ${cleared.invalidated_by}`, `Proof level: ${cleared.proof_level}`, '');
  }
  lines.push('## Before merge', '', `Command: \`${review.before_merge.command}\``, `Status: ${review.before_merge.status}`, '', '## Merge gate', '');
  if (!review.merge_gate.reasons.length) lines.push('Every safety fact and the before-merge reproduction reached executable proof, with no open High or Critical risk.');
  else for (const reason of review.merge_gate.reasons) lines.push(`- ${reason}`);
  lines.push('', '## Proof ledger', '');
  if (!review.proofs.length) lines.push('No proof has been applied. Every safety fact remains unproven.', '');
  for (const proof of review.proofs) {
    lines.push(`### ${proof.id}: Level ${proof.level}, ${PROOF_LEVELS[proof.level].label}`, '');
    if (proof.path) lines.push(`Source: \`${proof.path}:${proof.line}\``);
    if (proof.steps) for (const step of proof.steps) lines.push(`- ${step}`);
    if (proof.command) lines.push(`Command: \`${proof.command}\``);
    if (proof.result) lines.push(`Result: ${proof.result}`);
    lines.push('');
  }
  lines.push('## Limits', '');
  for (const limitation of review.review.limitations || []) lines.push(`- ${limitation}`);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function exportChangeReviewEvidence(review, options = {}) {
  const errors = validateChangeReview(review);
  if (errors.length) throw new Error(errors.join('\n'));
  let sequence = Number.isInteger(options.start) && options.start > 0 ? options.start : 1;
  const source = path.basename(options.source || 'CHANGE-REVIEW.json');
  const range = `${review.review.base.slice(0, 12)}..${review.review.head.slice(0, 12)}`;
  const evidence = [];
  for (const proof of review.proofs) {
    if (proof.level < 2) continue;
    const common = {
      id: `E-${sequence++}`,
      scope: `change review ${range}, ${proof.id}, proof level ${proof.level}`,
      sensitive: proof.redacted,
      redacted: proof.redacted
    };
    if ([2, 3].includes(proof.level)) {
      evidence.push({
        ...common,
        type: 'source',
        path: proof.path,
        line: proof.line,
        quote: proof.quote,
        sha256: proof.sha256
      });
    } else {
      evidence.push({
        ...common,
        type: 'runtime',
        tool: proof.tool,
        tool_version: proof.tool_version,
        command: proof.command,
        quote: proof.result
      });
    }
  }
  return {
    schema_version: '1.0',
    source,
    generated_from: range,
    evidence,
    findings_created: 0,
    note: 'Change-review proof exported as evidence leads. A domain evaluator must still trace ownership, refute the claim, and update the existing check ledger. This export creates no finding and changes no score.'
  };
}

module.exports = {
  LEAD_ROUTES,
  PROOF_LEVELS,
  applyBlastRadiusResults,
  deriveMergeGate,
  exportChangeReviewEvidence,
  planBlastRadius,
  renderBlastRadius,
  validateChangeReview
};
