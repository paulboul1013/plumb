#!/usr/bin/env node
// Everything a review must see since <ref>: commits, staged and unstaged edits, and new files.
// `git diff <ref>...HEAD` sees commits only, so uncommitted work used to reach reviewers as an empty diff.
import { execFileSync, spawnSync } from 'node:child_process';
import { isMain } from './entry.mjs';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function reviewDiff(ref, { cwd = process.cwd(), filesOnly = false } = {}) {
  const ok = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd });
  if (ok.status !== 0) throw new Error(`"${ref}" is not a commit in ${cwd}`);
  const base = git(['merge-base', ref, 'HEAD'], cwd).trim();
  const untracked = git(['ls-files', '--others', '--exclude-standard'], cwd).split('\n').filter(Boolean);

  if (filesOnly) {
    const tracked = git(['diff', '--name-only', base], cwd).split('\n').filter(Boolean);
    const files = [...new Set([...tracked, ...untracked])];
    if (!files.length) throw new Error(`nothing to review since ${ref}`);
    return files.join('\n') + '\n';
  }

  let out = git(['diff', base], cwd);
  for (const file of untracked) {
    // --no-index exits 1 when the files differ, which is the expected case here.
    out += spawnSync('git', ['diff', '--no-index', '--', '/dev/null', file], { cwd, encoding: 'utf8' }).stdout;
  }
  if (!out.trim()) throw new Error(`nothing to review since ${ref}`);
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const ref = args.find((a) => !a.startsWith('--'));
  if (!ref) {
    console.error('usage: review-diff.mjs <ref> [--files]');
    process.exit(2);
  }
  try {
    process.stdout.write(reviewDiff(ref, { filesOnly: args.includes('--files') }));
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}
