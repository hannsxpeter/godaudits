#!/usr/bin/env node
'use strict';

// Publication gate for external OSS dogfood audits. Empty is valid and means
// no track-record claim. Every listed artifact must be attributed, pinned,
// retained under dogfood/, and compile against the current catalog.

const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');
const { compileAudit } = require('../skills/godaudits/runtime/lib/audit');

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
    if (!Number.isInteger(entry.misses) || entry.misses < 0) errors.push(`${entry.id}.misses must be a non-negative integer`);
    if (!Number.isInteger(entry.false_positives) || entry.false_positives < 0) errors.push(`${entry.id}.false_positives must be a non-negative integer`);
    const artifacts = entry.artifacts || {};
    retained(artifacts.evidence, `${entry.id}.artifacts.evidence`);
    const auditFile = retained(artifacts.audit, `${entry.id}.artifacts.audit`);
    retained(artifacts.report, `${entry.id}.artifacts.report`);
    if (artifacts.sarif) retained(artifacts.sarif, `${entry.id}.artifacts.sarif`);
    if (auditFile) {
      const result = compileAudit(JSON.parse(fs.readFileSync(auditFile, 'utf8')), { catalog });
      for (const error of result.errors) errors.push(`${entry.id} audit: ${error}`);
      const applicable = result.audit.domains.filter((domain) => domain.status === 'applicable').map((domain) => domain.id).sort();
      if (JSON.stringify(applicable) !== JSON.stringify([...(entry.domains || [])].sort())) errors.push(`${entry.id} indexed domains do not match AUDIT.json`);
      if (result.audit.audit.budget !== entry.budget) errors.push(`${entry.id} indexed budget does not match AUDIT.json`);
    }
  }
}

process.stdout.write(`${JSON.stringify({ published: index.published ? index.published.length : 0, errors }, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
