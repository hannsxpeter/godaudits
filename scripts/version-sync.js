#!/usr/bin/env node
'use strict';

// Single source of version truth: package.json. This writes that version into
// every version surface (or verifies them with --check), so a release never
// hand-edits ~6 files in lockstep. After writing, regenerate the catalog and
// prompts (pack_version derives from SKILL.md). Run: npm run version:sync.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const minor = version.split('.').slice(0, 2).join('.'); // e.g. 2.4

// Each surface: the file, a regex that captures the version, and how to rebuild
// the line with the target version. The regex must match exactly one place.
const surfaces = [
  ['skills/godaudits/SKILL.md', /^(\s+version:\s*")([0-9]+\.[0-9]+\.[0-9]+)(")/m, (m) => `${m[1]}${version}${m[3]}`],
  ['skills/godaudits/SKILL.md', /^(## Skill version:\s*)([0-9]+\.[0-9]+\.[0-9]+)/m, (m) => `${m[1]}${version}`],
  ['skills/godaudits/SKILL.md', /(godaudits )([0-9]+\.[0-9]+)( is an evidence-first)/, (m) => `${m[1]}${minor}${m[3]}`],
  ['plugins/godaudits/.claude-plugin/plugin.json', /^(\s+"version":\s*")([0-9]+\.[0-9]+\.[0-9]+)(")/m, (m) => `${m[1]}${version}${m[3]}`],
  ['.claude-plugin/marketplace.json', /^(\s+"version":\s*")([0-9]+\.[0-9]+\.[0-9]+)(")/m, (m) => `${m[1]}${version}${m[3]}`],
  ['README.md', /(version-)([0-9]+\.[0-9]+\.[0-9]+)(-blue)/, (m) => `${m[1]}${version}${m[3]}`],
];

const mismatches = [];
for (const [rel, regex, build] of surfaces) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(regex);
  if (!match) {
    mismatches.push(`${rel}: no version surface matched ${regex}`);
    continue;
  }
  // build() encodes the correct target (full version or minor form), so compare
  // the current matched text against the rebuilt text. This handles both forms.
  const corrected = build(match);
  if (match[0] === corrected) continue;
  if (check) {
    mismatches.push(`${rel}: "${match[0]}" should be "${corrected}"`);
  } else {
    fs.writeFileSync(file, text.replace(regex, corrected));
    process.stdout.write(`  synced ${rel}: "${match[0]}" -> "${corrected}"\n`);
  }
}

if (check) {
  if (mismatches.length) {
    process.stderr.write(`Version surfaces are stale:\n  ${mismatches.join('\n  ')}\n`);
    process.stderr.write('To fix: run `npm run version:sync`.\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(`All version surfaces are ${version}.\n`);
  }
} else {
  if (mismatches.length) {
    process.stderr.write(`Could not sync some surfaces:\n  ${mismatches.join('\n  ')}\n`);
    process.exitCode = 1;
    return;
  }
  execFileSync('node', ['scripts/build-catalog.js'], { cwd: root, stdio: 'inherit' });
  execFileSync('node', ['scripts/build-check-map.js'], { cwd: root, stdio: 'inherit' });
  execFileSync('bash', ['scripts/build-prompt.sh'], { cwd: root, stdio: 'inherit' });
  process.stdout.write(`Version surfaces synced to ${version}; catalog, check map, and prompts regenerated.\n`);
}
