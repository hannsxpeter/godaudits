#!/usr/bin/env node
'use strict';

// Publication gate for external OSS dogfood audits. Empty is valid and means
// no track-record claim. Every listed artifact must be attributed, pinned,
// retained under dogfood/, and compile against the current catalog.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');
const { redactSecrets } = require('../skills/godaudits/runtime/lib/evidence');

const root = path.resolve(__dirname, '..');
const dogfoodRoot = path.join(root, 'dogfood');
const index = JSON.parse(fs.readFileSync(path.join(dogfoodRoot, 'index.json'), 'utf8'));
const catalog = buildCatalog(root);
const errors = [];
const ids = new Set();
const knownDomains = new Set(catalog.domains.map((domain) => domain.id));

function retained(relative, label) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) {
    errors.push(`${label} must be a relative path`);
    return null;
  }
  const resolved = path.resolve(dogfoodRoot, relative);
  if (resolved !== dogfoodRoot && !resolved.startsWith(`${dogfoodRoot}${path.sep}`)) {
    errors.push(`${label} escapes dogfood/`);
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    errors.push(`${label} does not exist: ${relative}`);
    return null;
  }
  return resolved;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (index.schema_version !== '1.0' || !Array.isArray(index.published)) {
  errors.push('dogfood index must use schema_version 1.0 and contain published');
} else {
  for (const entry of index.published) {
    if (!/^[a-z0-9-]+$/.test(entry.id || '') || ids.has(entry.id)) errors.push(`dogfood id is invalid or duplicated: ${entry.id || 'missing'}`);
    ids.add(entry.id);
    if (!/^https:\/\/github\.com\//.test(entry.repo_url || '')) errors.push(`${entry.id}.repo_url must be a public GitHub URL`);
    if (!/^[a-f0-9]{40}$/.test(entry.repo_commit || '')) errors.push(`${entry.id}.repo_commit must be a full commit SHA`);
    if (typeof entry.license !== 'string' || !entry.license) errors.push(`${entry.id}.license is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.audited_date || '')) errors.push(`${entry.id}.audited_date must be YYYY-MM-DD`);
    if (!['medium', 'full'].includes(entry.budget)) errors.push(`${entry.id}.budget must be medium or full`);
    if (!Array.isArray(entry.domains) || entry.domains.length === 0 || new Set(entry.domains).size !== entry.domains.length) {
      errors.push(`${entry.id}.domains must be a non-empty unique list`);
    }
    for (const domain of entry.domains || []) if (!knownDomains.has(domain)) errors.push(`${entry.id} has unknown domain ${domain}`);
    for (const field of ['provider', 'id', 'snapshot']) {
      if (!entry.model || typeof entry.model[field] !== 'string' || !entry.model[field]) errors.push(`${entry.id}.model.${field} is required`);
    }
    for (const field of ['name', 'version', 'config_sha256']) {
      if (!entry.harness || typeof entry.harness[field] !== 'string' || !entry.harness[field]) errors.push(`${entry.id}.harness.${field} is required`);
    }
    if (entry.harness && !/^[a-f0-9]{64}$/.test(entry.harness.config_sha256 || '')) errors.push(`${entry.id}.harness.config_sha256 must be a SHA-256`);
    if (!Number.isInteger(entry.hits) || entry.hits < 0) errors.push(`${entry.id}.hits must be a non-negative integer`);
    if (!Number.isInteger(entry.misses) || entry.misses < 0) errors.push(`${entry.id}.misses must be a non-negative integer`);
    if (!Number.isInteger(entry.false_positives) || entry.false_positives < 0) errors.push(`${entry.id}.false_positives must be a non-negative integer`);
    if (!Number.isInteger(entry.open_unknowns) || entry.open_unknowns < 0) errors.push(`${entry.id}.open_unknowns must be a non-negative integer`);
    if (!Array.isArray(entry.specialist_escalation_leads) || entry.specialist_escalation_leads.length < 1
      || entry.specialist_escalation_leads.length > 3) {
      errors.push(`${entry.id}.specialist_escalation_leads must contain 1 to 3 leads`);
    }
    if (!entry.ground_truth || typeof entry.ground_truth.id !== 'string' || !entry.ground_truth.id
      || !/^https:\/\/github\.com\//.test(entry.ground_truth.url || '')
      || !/^[a-f0-9]{40}$/.test(entry.ground_truth.fix_commit || '')
      || !Number.isInteger(entry.ground_truth.expected_findings)
      || entry.ground_truth.expected_findings < 1) {
      errors.push(`${entry.id}.ground_truth must identify a public source, fix commit, and expected-finding count`);
    }
    const artifacts = entry.artifacts || {};
    retained(artifacts.evidence, `${entry.id}.artifacts.evidence`);
    const auditFile = retained(artifacts.audit, `${entry.id}.artifacts.audit`);
    retained(artifacts.report, `${entry.id}.artifacts.report`);
    const runFile = retained(artifacts.run, `${entry.id}.artifacts.run`);
    const transcriptFile = retained(artifacts.transcript, `${entry.id}.artifacts.transcript`);
    const groundTruthFile = retained(artifacts.ground_truth, `${entry.id}.artifacts.ground_truth`);
    const packagingFile = retained(artifacts.packaging, `${entry.id}.artifacts.packaging`);
    if (artifacts.sarif) retained(artifacts.sarif, `${entry.id}.artifacts.sarif`);
    if (auditFile) {
      const result = compileAudit(JSON.parse(fs.readFileSync(auditFile, 'utf8')), { catalog });
      for (const error of result.errors) errors.push(`${entry.id} audit: ${error}`);
      const applicable = result.audit.domains.filter((domain) => domain.status === 'applicable').map((domain) => domain.id).sort();
      if (JSON.stringify(applicable) !== JSON.stringify([...(entry.domains || [])].sort())) errors.push(`${entry.id} indexed domains do not match AUDIT.json`);
      if (result.audit.audit.budget !== entry.budget) errors.push(`${entry.id} indexed budget does not match AUDIT.json`);
      if (result.audit.computed.coverage.unknown !== entry.open_unknowns) errors.push(`${entry.id} indexed open unknowns do not match AUDIT.json`);
    }
    if (runFile) {
      const run = readJson(runFile, `${entry.id}.artifacts.run`);
      if (run) {
        if (run.repository_commit !== entry.repo_commit) errors.push(`${entry.id} run commit does not match index`);
        for (const field of ['provider', 'id', 'snapshot']) {
          if (!run.model || run.model[field] !== entry.model[field]) errors.push(`${entry.id} run model.${field} does not match index`);
        }
        for (const field of ['name', 'version', 'config_sha256']) {
          if (!run.harness || run.harness[field] !== entry.harness[field]) errors.push(`${entry.id} run harness.${field} does not match index`);
        }
      }
    }
    if (groundTruthFile) {
      const truth = readJson(groundTruthFile, `${entry.id}.artifacts.ground_truth`);
      if (truth) {
        const adjudication = truth.adjudication || {};
        if (truth.vulnerable_commit !== entry.repo_commit) errors.push(`${entry.id} ground-truth vulnerable commit does not match index`);
        if (truth.fix_commit !== entry.ground_truth.fix_commit) errors.push(`${entry.id} ground-truth fix commit does not match index`);
        if (!truth.source || truth.source.id !== entry.ground_truth.id || truth.source.url !== entry.ground_truth.url) {
          errors.push(`${entry.id} ground-truth source does not match index`);
        }
        if (!truth.disclosure_hidden_during_run) errors.push(`${entry.id} ground truth must be hidden during the run`);
        if (!Array.isArray(truth.expected_findings)
          || truth.expected_findings.length !== entry.ground_truth.expected_findings) {
          errors.push(`${entry.id} expected-finding count does not match ground truth`);
        }
        if (!Array.isArray(adjudication.hits) || adjudication.hits.length !== entry.hits) errors.push(`${entry.id} hit count does not match adjudication`);
        if (!Array.isArray(adjudication.misses) || adjudication.misses.length !== entry.misses) errors.push(`${entry.id} miss count does not match adjudication`);
        if (!Array.isArray(adjudication.false_positives)
          || adjudication.false_positives.length !== entry.false_positives) {
          errors.push(`${entry.id} false-positive count does not match adjudication`);
        }
        if (entry.hits + entry.misses !== entry.ground_truth.expected_findings) {
          errors.push(`${entry.id} hits plus misses must equal expected findings`);
        }
      }
    }
    if (transcriptFile) {
      const transcript = fs.readFileSync(transcriptFile, 'utf8');
      if (redactSecrets(transcript).redacted) errors.push(`${entry.id} transcript contains an unredacted credential-shaped value`);
      if (/\/Users\/|\/private\/tmp\/|\/tmp\/godaudits-/.test(transcript)) errors.push(`${entry.id} transcript contains an unredacted local path`);
    }
    if (packagingFile) {
      const packaging = readJson(packagingFile, `${entry.id}.artifacts.packaging`);
      if (packaging && packaging.artifacts) {
        const artifactRoot = path.dirname(packagingFile);
        for (const [relative, expectedHash] of Object.entries(packaging.artifacts)) {
          const file = path.resolve(artifactRoot, relative);
          if (!file.startsWith(`${artifactRoot}${path.sep}`) || !fs.existsSync(file)) {
            errors.push(`${entry.id} packaging artifact is missing or escapes its directory: ${relative}`);
          } else if (hashFile(file) !== expectedHash) {
            errors.push(`${entry.id} packaging hash mismatch: ${relative}`);
          }
        }
      } else errors.push(`${entry.id} packaging manifest must contain artifact hashes`);
    }
  }
}

process.stdout.write(`${JSON.stringify({ published: index.published ? index.published.length : 0, errors }, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
