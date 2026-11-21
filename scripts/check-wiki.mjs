#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isMain } from './entry.mjs';

const ENTRY = /^- \[[^\]]+\]\(([^)\s]+\.md)\): \S/;
const LINK = /\]\(<?([^)>\s]+)>?\)/g;
const PRESENT = /\b(currently|now|at present)\b/i;
const DATED = /\b\d{4}-\d{2}-\d{2}\b|`[0-9a-f]{7,40}`/i;

// Blank out fenced lines so an example in a code block is never read as a claim, a link, or an index entry.
function proseLines(text) {
  let fence = null;
  return text.split('\n').map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (!fence && marker) { fence = marker; return ''; }
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return '';
    }
    return line;
  });
}

const pageTarget = (target) => (/^[a-z][a-z0-9+.-]*:/i.test(target) ? null : target.split('#')[0]);

export function wikiProblems(dir) {
  const problems = [];
  const pages = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const linkedFromIndex = new Set();

  for (const file of pages) {
    proseLines(readFileSync(join(dir, file), 'utf8')).forEach((line, i) => {
      const at = `${file}:${i + 1}`;
      if (file === 'index.md' && /^\s*[-*+] /.test(line)) {
        const target = line.match(ENTRY)?.[1];
        if (!target) problems.push(`${at}: index entry must be "- [Title](slug.md): one-line summary."`);
        else if (!existsSync(join(dir, target))) problems.push(`${at}: index entry points at ${target}, which does not exist; create the page or remove the entry`);
      }
      for (const [, raw] of line.matchAll(LINK)) {
        const target = pageTarget(raw);
        if (!target || !target.endsWith('.md')) continue;
        if (file === 'index.md') linkedFromIndex.add(resolve(dir, target));
        if (!existsSync(resolve(dir, target)) && !(file === 'index.md' && ENTRY.test(line))) {
          problems.push(`${at}: broken link ${target}; fix the path or create the page`);
        }
      }
      const word = line.match(PRESENT)?.[1];
      if (word && !DATED.test(line)) {
        problems.push(`${at}: "${word.toLowerCase()}" with no date or commit on the line; start the claim with its YYYY-MM-DD date and cite the commit`);
      }
    });
  }

  for (const file of pages) {
    if (file !== 'index.md' && !linkedFromIndex.has(resolve(dir, file))) {
      problems.push(`${file}:1: not linked from index.md; add "- [Title](${file}): one-line summary." under a ## heading in index.md`);
    }
  }
  return problems;
}

if (isMain(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir || !existsSync(join(dir, 'index.md'))) {
    console.error('usage: check-wiki.mjs <wiki-dir>\nThe directory must hold the wiki\'s index.md.');
    process.exit(2);
  }
  const problems = wikiProblems(dir);
  for (const p of problems) console.log(p);
  if (problems.length) process.exit(1);
  console.log(`ok: ${dir}`);
}
