'use strict';

const path = require('node:path');
const { redactSecrets } = require('./evidence');

function messageText(message) {
  if (!message) return 'SARIF result without a message.';
  return String(message.text || message.markdown || 'SARIF result without a message.');
}

function importSarif(sarif, options = {}) {
  if (!sarif || sarif.version !== '2.1.0' || !Array.isArray(sarif.runs)) {
    throw new Error('input must be SARIF 2.1.0 with a runs array');
  }
  const source = path.basename(options.source || 'input.sarif');
  let sequence = Number.isInteger(options.start) && options.start > 0 ? options.start : 1;
  const evidence = [];
  for (const run of sarif.runs) {
    const driver = run.tool && run.tool.driver ? run.tool.driver : {};
    const tool = driver.name || 'unknown-sarif-tool';
    const toolVersion = driver.semanticVersion || driver.version || 'unknown';
    const invocation = run.invocations && run.invocations[0];
    const command = redactSecrets(invocation && invocation.commandLine ? invocation.commandLine : `imported SARIF ${source}`);
    for (const result of run.results || []) {
      const location = result.locations && result.locations[0] && result.locations[0].physicalLocation;
      const artifact = location && location.artifactLocation;
      const region = location && location.region;
      const clean = redactSecrets(messageText(result.message));
      const sensitive = clean.redacted || command.redacted;
      evidence.push({
        id: `E-${sequence}`,
        type: 'tool',
        tool,
        tool_version: toolVersion,
        command: command.text,
        quote: clean.text.slice(0, 1000),
        ...(artifact && artifact.uri ? { path: artifact.uri } : {}),
        ...(region && Number.isInteger(region.startLine) ? { line: region.startLine } : {}),
        ...(result.ruleId ? { scope: `rule ${result.ruleId}` } : {}),
        sensitive,
        redacted: sensitive
      });
      sequence += 1;
    }
  }
  return {
    schema_version: '1.0',
    source,
    evidence
  };
}

module.exports = { importSarif };
