'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

function commitFor(root) {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'no-git';
  }
}

function initAudit(catalog, options) {
  const root = path.resolve(options.root || process.cwd());
  const date = options.date || new Date().toISOString().slice(0, 10);
  const applicable = new Set(options.applicable === 'all' ? catalog.domains.map((domain) => domain.id) : options.applicable);
  const knownDomains = new Set(catalog.domains.map((domain) => domain.id));
  const unknownDomains = [...applicable].filter((domain) => !knownDomains.has(domain));
  if (unknownDomains.length) throw new Error(`unknown applicable domains: ${unknownDomains.join(', ')}`);
  if (applicable.size === 0) throw new Error('at least one applicable domain is required');
  const riskProfile = options.riskProfile || 'balanced';
  const profile = catalog.profiles[riskProfile];
  if (!profile) throw new Error(`unknown risk profile: ${riskProfile}`);
  const domains = catalog.domains.map((definition) => {
    const active = applicable.has(definition.id);
    return {
      id: definition.id,
      status: active ? 'applicable' : 'excluded',
      weight: profile.weights[definition.id],
      ...(active ? {} : { reason: 'Excluded by the requested focused-audit scope.' }),
      checks: active ? catalog.checks.filter((check) => check.domain === definition.id).map((check) => ({
        id: check.id,
        outcome: 'unknown',
        confidence: 'Tentative',
        weight: check.default_weight,
        evidence: [],
        finding_ids: []
      })) : []
    };
  });
  const standards = Object.entries(catalog.standards.frameworks).flatMap(([framework, definition]) => (
    definition.categories.map((category) => ({
      framework,
      category: category.id,
      title: category.title,
      status: 'unknown',
      checks: [...category.checks],
      evidence: [],
      finding_ids: []
    }))
  ));
  const evidenceMetadata = options.evidence ? {
    evidence_fingerprint_sha256: options.evidence.fingerprint_sha256,
    evidence_commit: options.evidence.commit,
    ...(options.evidence.project_context ? {
      project_form: options.evidence.project_context.project_forms.primary.id,
      secondary_forms: options.evidence.project_context.project_forms.secondary.map((form) => form.id),
      domain_overlays: [
        ...options.evidence.project_context.product_archetype.candidates.map((item) => ({
          axis: 'product', id: item.slug, status: item.status, confidence: item.confidence, requires_verification: false
        })),
        ...options.evidence.project_context.industry_overlays.map((item) => ({
          axis: 'industry', id: item.slug, status: item.status, confidence: item.confidence, requires_verification: false
        })),
        ...options.evidence.project_context.regulatory_overlays.map((item) => ({
          axis: 'regulatory', id: item.id, status: item.status, confidence: item.confidence, requires_verification: true
        }))
      ]
    } : {})
  } : {};
  return {
    schema_version: '2.0',
    audit: {
      name: options.name,
      audit_version: 1,
      status: 'reported',
      created: date,
      updated: date,
      mode: 'fresh',
      plan_aware: Boolean(options.planAware),
      commit: options.commit || commitFor(root),
      archetype: options.archetype,
      scale: options.scale,
      risk_profile: riskProfile,
      engine_version: catalog.pack_version,
      pack_version: catalog.pack_version,
      ...evidenceMetadata,
      capabilities: ['static'],
      assumptions: []
    },
    compliance: {
      result: options.compliance || 'pass',
      screened: date,
      policy_pack: options.policyPack || 'provider-neutral@1'
    },
    domains,
    standards,
    evidence: [],
    strengths: [],
    findings: [],
    tasks: [{
      id: 'GA-601',
      phase: 6,
      wave: '6.1',
      title: 'Re-run godaudits at the remediated commit',
      parallel: false,
      files: [],
      depends_on: [],
      reuses: 'the current check catalog and evidence fingerprint',
      fixes: [],
      acceptance: ['Every prior task is done and the expected score movement is recorded.'],
      verify: 'godaudits validate .godaudits/AUDIT.json',
      checks: [],
      status: 'open',
      final_gate: true
    }],
    accepted_risks: [],
    open_questions: [],
    session_log: [{ date, summary: 'Audit state initialized; every selected check is unknown until evaluated.' }]
  };
}

module.exports = { initAudit };
