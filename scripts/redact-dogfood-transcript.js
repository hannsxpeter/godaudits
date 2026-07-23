#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { redactSecrets } = require('../skills/godaudits/runtime/lib/evidence');

function parseArgs(argv) {
  const options = { input: null, output: null, replacements: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--input') options.input = value;
    else if (arg === '--output') options.output = value;
    else if (arg === '--replace') {
      const separator = value.indexOf('=');
      if (separator < 1) throw new Error('--replace must be FROM=TO');
      options.replacements.push([value.slice(0, separator), value.slice(separator + 1)]);
    } else throw new Error(`unknown argument ${arg}`);
    index += 1;
  }
  if (!options.input || !options.output) throw new Error('--input and --output are required');
  return options;
}

function cleanString(value, replacements) {
  let text = value;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  return redactSecrets(text).text;
}

function clean(value, replacements) {
  if (typeof value === 'string') return cleanString(value, replacements);
  if (Array.isArray(value)) return value.map((item) => clean(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item, replacements)]));
  }
  return value;
}

const options = parseArgs(process.argv.slice(2));
const input = fs.readFileSync(options.input, 'utf8');
const output = input.split(/\r?\n/).map((line) => {
  if (!line) return '';
  try {
    return JSON.stringify(clean(JSON.parse(line), options.replacements));
  } catch {
    return cleanString(line, options.replacements);
  }
}).join('\n');
fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(options.output, output);
process.stdout.write(`${JSON.stringify({
  input_sha256: crypto.createHash('sha256').update(input).digest('hex'),
  output_sha256: crypto.createHash('sha256').update(output).digest('hex')
}, null, 2)}\n`);
