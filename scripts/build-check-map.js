#!/usr/bin/env node
'use strict';

// The 431 checks are legible only if they roll up. This generates a browsable
// map from the catalog - domain -> dimension/role -> checks -> standards - so a
// contributor sees the shape without reading 18 modules. Generated, never
// hand-maintained. Run: npm run check-map (or --check to verify freshness).

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'skills/godaudits/catalog/checks.json'), 'utf8'));
const output = path.join(root, 'docs/CHECK-MAP.md');

const byDomain = new Map();
for (const c of catalog.checks) {
  if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
  byDomain.get(c.domain).push(c);
}

const lines = [];
lines.push('# Check map');
lines.push('');
lines.push(`Generated from \`catalog/checks.json\` by \`npm run check-map\`. Do not edit by hand.`);
lines.push('');
lines.push(`${catalog.domain_count} domains, ${catalog.check_count} checks, and ${Object.keys(catalog.standards.frameworks).length} standards frameworks. Each check's ownership, weight, and standards mapping are derived from its domain module and the standards catalog.`);
lines.push('');

// Standards summary: framework -> categories -> check count.
lines.push('## Standards frameworks');
lines.push('');
for (const [id, framework] of Object.entries(catalog.standards.frameworks)) {
  const total = framework.categories.reduce((sum, cat) => sum + cat.checks.length, 0);
  lines.push(`- **${framework.name}** (\`${id}\`): ${framework.categories.length} categories, ${total} mapped checks.`);
}
lines.push('');

lines.push('## Domains');
lines.push('');
for (const domain of catalog.domains) {
  const checks = (byDomain.get(domain.id) || []).slice().sort((a, b) =>
    Number(a.id.slice(a.id.lastIndexOf('-') + 1)) - Number(b.id.slice(b.id.lastIndexOf('-') + 1)));
  const weighted = checks.filter((c) => c.scoring_role === 'weighted').length;
  const routing = checks.filter((c) => c.scoring_role === 'routing').length;
  lines.push(`### ${domain.id} (${domain.module})`);
  lines.push('');
  lines.push(`${checks.length} checks: ${weighted} weighted, ${routing} routing.`);
  lines.push('');
  lines.push('| Check | Role | Standards | Title |');
  lines.push('|---|---|---|---|');
  for (const c of checks) {
    const std = (c.standards || []).join(', ') || '-';
    const title = (c.title || '').replace(/\|/g, '\\|').slice(0, 100);
    lines.push(`| ${c.id} | ${c.scoring_role}${c.dimension ? ` (${c.dimension})` : ''} | ${std} | ${title} |`);
  }
  lines.push('');
}

const rendered = `${lines.join('\n')}\n`;

if (check) {
  const current = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  if (current === rendered) {
    process.stdout.write('Check map is fresh.\n');
  } else {
    process.stderr.write('Check map is stale. To fix: run `npm run check-map`.\n');
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, rendered);
  process.stdout.write(`Wrote ${output} (${catalog.check_count} checks across ${catalog.domain_count} domains).\n`);
}
