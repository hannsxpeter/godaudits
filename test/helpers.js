'use strict';

function validAudit() {
  return {
    schema_version: '2.0',
    audit: {
      name: 'fixture-app',
      audit_version: 1,
      status: 'reported',
      created: '2026-07-13',
      updated: '2026-07-13',
      mode: 'fresh',
      plan_aware: false,
      commit: 'abc1234',
      archetype: 'api-service',
      scale: 'side-project',
      risk_profile: 'balanced',
      engine_version: '2.0.0',
      pack_version: '2.0.0',
      capabilities: ['static'],
      assumptions: []
    },
    compliance: {
      result: 'pass',
      screened: '2026-07-13',
      policy_pack: 'provider-neutral@1'
    },
    domains: [
      {
        id: 'security',
        status: 'applicable',
        weight: 15,
        checks: [
          {
            id: 'A-SEC-3',
            outcome: 'fail',
            confidence: 'Certain',
            weight: 60,
            evidence: ['E-1', 'E-2'],
            finding_ids: ['F-SEC-1']
          },
          {
            id: 'A-SEC-4',
            outcome: 'pass',
            confidence: 'Certain',
            weight: 40,
            evidence: ['E-2'],
            finding_ids: []
          }
        ]
      },
      {
        id: 'seo',
        status: 'excluded',
        weight: 3,
        reason: 'private API with no public crawlable surface',
        checks: []
      }
    ],
    evidence: [
      {
        id: 'E-1',
        type: 'source',
        path: 'src/boards.js',
        line: 8,
        quote: 'db.boards.findOne({ id })',
        sha256: 'a'.repeat(64),
        redacted: false
      },
      {
        id: 'E-2',
        type: 'source',
        path: 'src/router.js',
        line: 4,
        quote: 'router.use(authorize)',
        sha256: 'b'.repeat(64),
        redacted: false
      }
    ],
    strengths: [
      {
        title: 'Authorization middleware is mounted centrally',
        evidence: ['E-2'],
        preserve: 'Keep the central mount while fixing query scoping.'
      }
    ],
    findings: [
      {
        id: 'F-SEC-1',
        domain: 'security',
        title: 'Board lookup omits the tenant predicate',
        severity: 'Critical',
        confidence: 'Certain',
        effort: 'S',
        evidence: ['E-1', 'E-2'],
        impact: 'An authenticated user can read another tenant board by id.',
        fix: 'Add the tenant predicate inside the board query.',
        verify: 'node --test test/security.test.js',
        checks: ['A-SEC-3'],
        status: 'open',
        remediation: ['GA-101']
      }
    ],
    tasks: [
      {
        id: 'GA-101',
        phase: 1,
        wave: '1.1',
        title: 'Scope board lookups to the tenant',
        parallel: false,
        files: ['src/boards.js', 'test/security.test.js'],
        depends_on: [],
        reuses: 'central authorization middleware',
        fixes: ['F-SEC-1'],
        acceptance: [
          'Every board query contains a tenant predicate.',
          'A cross-tenant lookup returns 404.'
        ],
        verify: 'node --test test/security.test.js',
        checks: ['A-SEC-3'],
        status: 'open'
      },
      {
        id: 'GA-601',
        phase: 6,
        wave: '6.1',
        title: 'Re-run godaudits',
        parallel: false,
        files: [],
        depends_on: ['GA-101'],
        reuses: 'the current audit state',
        fixes: [],
        acceptance: ['Security reaches 85 or better with no open Critical findings.'],
        verify: 'godaudits validate .godaudits/AUDIT.json',
        checks: [],
        status: 'open',
        final_gate: true
      }
    ],
    accepted_risks: [],
    open_questions: [],
    session_log: [
      {
        date: '2026-07-13',
        summary: 'Audit created.'
      }
    ]
  };
}

module.exports = { validAudit };
