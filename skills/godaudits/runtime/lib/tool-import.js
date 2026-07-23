'use strict';

// Generalized tool-result import. SARIF was the first adapter; static analysis
// depth arrives as versioned, redacted tool evidence instead of a runtime
// dependency, so the zero-dependency engine stays portable and every imported
// lead carries the tool, its version, and the producing command. Imported
// results are leads, never findings: a domain pass must still trace and refute
// them before any check outcome moves.
//
// Every adapter emits the same TOOL-EVIDENCE.json shape
// (schemas/tool-evidence.schema.json): E-n records with type tool, the tool
// name and version, the producing command, a redacted quote, and optional
// path, line, and scope. Adapters never emit a raw secret: gitleaks results
// carry the secret's one-way fingerprint, and every quote passes through the
// same redactor the evidence collector uses.

const path = require('node:path');
const crypto = require('node:crypto');
const { redactSecrets } = require('./evidence');
const { importSarif } = require('./sarif-import');

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function sanitize(value, fallback = 'tool result without a message.') {
  const text = String(value || fallback);
  const clean = redactSecrets(text);
  return { text: (clean.text.slice(0, 1000) || fallback), redacted: clean.redacted };
}

function provenance(options, reportVersion, tool) {
  const toolVersion = options.toolVersion || reportVersion;
  if (!toolVersion || toolVersion === 'unknown') {
    throw new Error(`${tool} import requires --tool-version when the report does not embed one`);
  }
  if (!options.command) throw new Error(`${tool} import requires --command with the scanner command that produced the report`);
  const command = redactSecrets(String(options.command));
  return { toolVersion: String(toolVersion), command };
}

function startSequence(options) {
  return Number.isInteger(options.start) && options.start > 0 ? options.start : 1;
}

// semgrep JSON (--json): results carry check_id, path, start.line, and
// extra.message. Version comes from the top-level version field when present.
function importSemgrep(report, options) {
  const results = report && Array.isArray(report.results) ? report.results : null;
  if (!results) throw new Error('semgrep input must be a JSON report with a results array');
  let sequence = startSequence(options);
  const run = provenance(options, typeof report.version === 'string' ? report.version : null, 'semgrep');
  const evidence = results.map((result) => {
    const clean = sanitize(result.extra && result.extra.message);
    const sensitive = clean.redacted || run.command.redacted;
    return {
      id: `E-${sequence++}`,
      type: 'tool',
      tool: 'semgrep',
      tool_version: run.toolVersion,
      command: run.command.text,
      quote: clean.text,
      ...(result.path ? { path: result.path } : {}),
      ...(result.start && Number.isInteger(result.start.line) ? { line: result.start.line } : {}),
      ...(result.check_id ? { scope: `rule ${result.check_id}` } : {}),
      sensitive,
      redacted: sensitive
    };
  });
  return { schema_version: '1.0', source: path.basename(options.source || 'input.json'), evidence };
}

// ast-grep JSON (--json=pretty or --json=compact): the report is an array of
// matches. range.start.line is zero-based, unlike TOOL-EVIDENCE.json. Lint
// rules add ruleId, message, note, and severity; pattern matches may carry only
// text and lines.
function importAstGrep(report, options) {
  if (!Array.isArray(report)) throw new Error('ast-grep input must be a JSON array of matches');
  let sequence = startSequence(options);
  const run = provenance(options, null, 'ast-grep');
  const evidence = report.map((match) => {
    const clean = sanitize(match.message || match.note || match.lines || match.text, 'ast-grep match without a message.');
    const zeroBasedLine = match.range && match.range.start && match.range.start.line;
    const sensitive = clean.redacted || run.command.redacted;
    return {
      id: `E-${sequence++}`,
      type: 'tool',
      tool: 'ast-grep',
      tool_version: run.toolVersion,
      command: run.command.text,
      quote: clean.text,
      ...(match.file ? { path: match.file } : {}),
      ...(Number.isInteger(zeroBasedLine) && zeroBasedLine >= 0 ? { line: zeroBasedLine + 1 } : {}),
      ...(match.ruleId ? { scope: `rule ${match.ruleId}` } : {}),
      sensitive,
      redacted: sensitive
    };
  });
  return { schema_version: '1.0', source: path.basename(options.source || 'input.json'), evidence };
}

// gitleaks JSON report: an array of findings with RuleID, Description, File,
// StartLine, and the matched Secret. The secret value never enters evidence;
// only its fingerprint does, so an auditor can correlate two leaks of the same
// credential without the credential itself. Every record is sensitive and
// redacted by construction.
function importGitleaks(report, options) {
  if (!Array.isArray(report)) throw new Error('gitleaks input must be a JSON array of findings');
  let sequence = startSequence(options);
  const run = provenance(options, null, 'gitleaks');
  const evidence = report.map((finding) => {
    const rule = finding.RuleID || 'unknown-rule';
    const description = finding.Description || 'gitleaks finding';
    const marker = finding.Secret ? ` secret sha256:${fingerprint(finding.Secret)}` : '';
    const line = Number.parseInt(finding.StartLine, 10);
    const clean = sanitize(`${rule}: ${description}.${marker}`);
    return {
      id: `E-${sequence++}`,
      type: 'tool',
      tool: 'gitleaks',
      tool_version: run.toolVersion,
      command: run.command.text,
      quote: clean.text,
      ...(finding.File ? { path: finding.File } : {}),
      ...(Number.isInteger(line) && line > 0 ? { line } : {}),
      scope: `rule ${rule}`,
      sensitive: true,
      redacted: true
    };
  });
  return { schema_version: '1.0', source: path.basename(options.source || 'input.json'), evidence };
}

// osv-scanner JSON (--format json): results[].packages[] carries the package
// and its vulnerabilities. One evidence record per package-vulnerability pair.
function importOsvScanner(report, options) {
  const results = report && Array.isArray(report.results) ? report.results : null;
  if (!results) throw new Error('osv-scanner input must be a JSON report with a results array');
  let sequence = startSequence(options);
  const run = provenance(options, typeof report.version === 'string' ? report.version : null, 'osv-scanner');
  const evidence = [];
  for (const result of results) {
    for (const entry of result.packages || []) {
      const pkg = entry.package || {};
      const label = [pkg.name, pkg.version].filter(Boolean).join('@') || 'unknown-package';
      for (const vulnerability of entry.vulnerabilities || []) {
        const summary = vulnerability.summary || vulnerability.details || 'OSV vulnerability without a summary.';
        const clean = sanitize(`${vulnerability.id || 'OSV-UNKNOWN'}: ${summary}`);
        const sensitive = clean.redacted || run.command.redacted;
        evidence.push({
          id: `E-${sequence++}`,
          type: 'tool',
          tool: 'osv-scanner',
          tool_version: run.toolVersion,
          command: run.command.text,
          quote: clean.text,
          ...(result.source && result.source.path ? { path: result.source.path } : {}),
          scope: `package ${label}`,
          sensitive,
          redacted: sensitive
        });
      }
    }
  }
  return { schema_version: '1.0', source: path.basename(options.source || 'input.json'), evidence };
}

const ADAPTERS = {
  sarif: (data, options) => importSarif(data, options),
  semgrep: importSemgrep,
  'ast-grep': importAstGrep,
  gitleaks: importGitleaks,
  'osv-scanner': importOsvScanner
};

function importTool(tool, data, options = {}) {
  const adapter = ADAPTERS[tool];
  if (!adapter) throw new Error(`unknown tool adapter: ${tool} (known: ${Object.keys(ADAPTERS).join(', ')})`);
  const imported = adapter(data, options);
  for (const record of imported.evidence) {
    if (record.tool_version === 'unknown') throw new Error(`${tool} import requires --tool-version when the report does not embed one`);
    if (/^imported SARIF\b/.test(record.command)) {
      throw new Error(`${tool} import requires --command when the report does not embed an invocation`);
    }
  }
  return imported;
}

module.exports = { ADAPTERS, importTool };
