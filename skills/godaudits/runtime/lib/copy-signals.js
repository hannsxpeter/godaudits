'use strict';

const path = require('node:path');

const PROSE_EXTENSIONS = new Set(['.htm', '.html', '.jsx', '.md', '.mdx', '.svelte', '.tsx', '.vue']);
const MESSAGE_EXTENSIONS = new Set(['.js', '.json', '.ts', '.txt', '.yaml', '.yml']);
const MESSAGE_DIRECTORIES = new Set([
  '.launch-ready',
  'copy',
  'email',
  'emails',
  'i18n',
  'locales',
  'marketing',
  'messages',
  'site',
  'www'
]);
const EXCLUDED_DIRECTORIES = new Set(['__fixtures__', '__snapshots__', 'fixture', 'fixtures', 'test', 'tests']);
const EXCLUDED_FILES = /^(?:CHANGELOG(?:\..*)?|LICENSE(?:\..*)?|NOTICE(?:\..*)?|PROMPT(?:\.full)?\.md)$/i;

const COPY_SIGNALS = [
  ['copy-puffery', /\b(?:pivotal moment|testament to|evolving landscape|setting the stage for|indelible mark|deeply rooted)\b/i],
  ['copy-promotional', /\b(?:seamless|revolutionary|effortless|cutting-edge|game-changing|unlock|supercharge|streamline|empower|elevate|best-in-class|industry-leading|enterprise-grade|world-class)\b/i],
  ['copy-vague-attribution', /\b(?:experts believe|industry reports suggest|some critics argue|research shows|studies show)\b/i],
  ['copy-formula', /\bnot (?:just|only)\b.{0,100}\bbut (?:also )?\b|\bdespite (?:the )?challenges\b.{0,100}\bcontinues? to thrive\b/i],
  ['copy-filler', /\b(?:in order to|due to the fact that|it is important to note that|it should be noted that|needless to say)\b/i],
  ['copy-hedging', /\b(?:could potentially|might potentially|may potentially|possibly could|it could be argued that)\b/i],
  ['copy-chatbot-residue', /(?:^|[.!?]\s+)(?:i hope this helps|let me know if|of course|certainly|great question|you(?:'re| are) absolutely right|found the smoking gun)\b/i],
  ['copy-generic-conclusion', /\b(?:the future looks bright|only time will tell|this is just the beginning|exciting times (?:lie|are) ahead)\b/i]
];

function pathSegments(relative) {
  return relative.split('/').filter(Boolean);
}

function isCopySurfacePath(relative) {
  const normalized = relative.split(path.sep).join('/');
  const segments = pathSegments(normalized);
  const basename = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (EXCLUDED_FILES.test(basename)) return false;
  if (segments.slice(0, -1).some((segment) => EXCLUDED_DIRECTORIES.has(segment.toLowerCase()))) return false;
  if (PROSE_EXTENSIONS.has(extension)) return true;
  return MESSAGE_EXTENSIONS.has(extension)
    && segments.slice(0, -1).some((segment) => MESSAGE_DIRECTORIES.has(segment.toLowerCase()));
}

function withoutInlineCode(line) {
  return line.replace(/`[^`]*`/g, ' ');
}

function scanCopySignals(relative, lines, sha256) {
  if (!isCopySurfacePath(relative)) return [];
  const extension = path.posix.extname(relative).toLowerCase();
  const markdown = extension === '.md' || extension === '.mdx';
  const signals = [];
  let fenced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (markdown && /^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || (markdown && /^(?: {4}|\t)/.test(line))) continue;
    const searchable = withoutInlineCode(line);
    for (const [kind, pattern] of COPY_SIGNALS) {
      if (!pattern.test(searchable)) continue;
      signals.push({
        id: '',
        kind,
        path: relative,
        line: index + 1,
        quote: line.trim().slice(0, 240),
        sha256,
        redacted: false
      });
    }
  }
  return signals;
}

module.exports = { COPY_SIGNALS, isCopySurfacePath, scanCopySignals };
