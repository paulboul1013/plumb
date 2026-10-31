#!/usr/bin/env node
// What `git worktree remove` would destroy in a worktree: uncommitted work, ignored files that
// may exist nowhere else, and commits only its HEAD reflog reaches. The last two go with exit 0.
import { execFileSync } from 'node:child_process';

// An ignored path under one of these names is a rebuildable build or cache artifact.
const DISPOSABLE = new Set([
  'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  'dist', 'build', 'target', 'out', 'coverage', '.next', '.nuxt', '.turbo', '.cache', '.gradle',
]);

function git(cwd, args, input) {
  return execFileSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const lines = (text) => text.split('\n').filter(Boolean);

export function worktreeHolds(path) {
  const holds = [];
  for (const line of lines(git(path, ['status', '--porcelain', '--untracked-files=all', '--ignored=matching']))) {
    if (!line.startsWith('!!')) {
      holds.push(`uncommitted change: ${line}`);
      continue;
    }
    const file = line.slice(3);
    if (!file.split('/').some((part) => DISPOSABLE.has(part))) holds.push(`ignored file that may exist nowhere else: ${file}`);
  }

  // A branch reflog lives in the shared repo and survives the removal, so only commits
  // that neither a ref nor a branch reflog reaches are lost with this worktree's HEAD reflog.
  const visited = new Set(lines(git(path, ['rev-list', '--walk-reflogs', 'HEAD'])));
  const unreachable = new Set(lines(git(path, ['rev-list', '--stdin', '--not', '--branches', '--tags', '--remotes'], [...visited].join('\n') + '\n')));
  const branchLogged = new Set(lines(git(path, ['rev-list', '--walk-reflogs', '--branches'])));
  for (const sha of visited) {
    if (unreachable.has(sha) && !branchLogged.has(sha)) holds.push(`commit only this worktree's HEAD reflog reaches: ${sha}`);
  }
  return holds;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error('usage: worktree-check.mjs <worktree-path>...');
    process.exit(2);
  }
  let held = false;
  for (const path of paths) {
    const holds = worktreeHolds(path);
    if (!holds.length) {
      console.log(`ok: ${path} is safe to remove`);
      continue;
    }
    held = true;
    console.log(`hold: ${path}`);
    for (const hold of holds) console.log(`  ${hold}`);
  }
  process.exit(held ? 1 : 0);
}
