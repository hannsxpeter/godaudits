'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  grade,
  parseArgs,
  parseTranscript
} = require('../scripts/run-paired-accuracy');

const root = path.resolve(__dirname, '..');

test('paired harness defaults to the complete two-arm protocol', () => {
  const options = parseArgs([]);
  assert.equal(options.repetitions, 3);
  assert.deepEqual(options.arms, ['control', 'skill']);
  assert.equal(options.model, 'gpt-5.6-terra');
});

test('seed grading requires the expected citation and records severity separately', () => {
  const result = grade({
    kind: 'seeded',
    path: 'src/passwords.js',
    line: 10,
    severity: 'High'
  }, {
    outcome: 'fail',
    findings: [
      {
        path: 'src/passwords.js',
        line: 10,
        severity: 'Critical'
      }
    ]
  });
  assert.deepEqual(result, {
    outcome: 'fail',
    hits: 1,
    misses: 0,
    false_positives: 0,
    severity_matches: 0,
    severity_mismatches: 1,
    citation_matches: 1,
    citation_mismatches: 0
  });
});

test('a clean-control alarm is a false positive', () => {
  const result = grade({ kind: 'control' }, {
    outcome: 'fail',
    findings: [{ path: 'src/server.js', line: 4 }]
  });
  assert.equal(result.hits, 0);
  assert.equal(result.misses, 0);
  assert.equal(result.false_positives, 1);
  assert.equal(result.citation_mismatches, 1);
});

test('transcript parser retains structured output and token usage', () => {
  const transcript = [
    JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: JSON.stringify({
          outcome: 'pass',
          confidence: 'Firm',
          findings: [],
          reasoning: 'All relevant controls are present.'
        })
      }
    }),
    JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 10, output_tokens: 4 }
    })
  ].join('\n');
  const parsed = parseTranscript(transcript);
  assert.equal(parsed.audit.outcome, 'pass');
  assert.equal(parsed.usage.input_tokens, 10);
});

test('A-SEC-6 ground truth has five seeds, one control, and standalone fixtures', () => {
  const groundTruth = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/accuracy-ground-truth.json'), 'utf8'));
  const suite = groundTruth.suites.find((candidate) => candidate.id === 'a-sec-6');
  assert.equal(suite.cases.filter((caseData) => caseData.kind === 'seeded').length, 5);
  assert.equal(suite.cases.filter((caseData) => caseData.kind === 'control').length, 1);
  for (const caseData of suite.cases) {
    const fixture = path.join(root, 'benchmarks/fixtures/accuracy/a-sec-6', caseData.id);
    assert.ok(fs.statSync(fixture).isDirectory());
    assert.equal(fs.existsSync(path.join(fixture, 'accuracy-ground-truth.json')), false);
  }
});
