#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('../skills/godaudits/runtime/lib/catalog');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'skills/godaudits/catalog/checks.json');
const rendered = `${JSON.stringify(buildCatalog(root), null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== rendered) {
    process.stderr.write('Generated check catalog is stale. Run npm run catalog.\n');
    process.exitCode = 1;
  } else process.stdout.write('Check catalog is fresh.\n');
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, rendered);
  process.stdout.write(`Wrote ${output}\n`);
}
