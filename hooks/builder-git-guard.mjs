#!/usr/bin/env node
// PreToolUse guard: a plumb-builder must not rewrite or discard working-tree state,
// because a worktree can fall back to the parent's checkout and sweep up its uncommitted work.
import { readFileSync } from 'node:fs';
import { commands, gitSubcommand } from './shell-commands.mjs';

// Each rule gets git's subcommand and its arguments, after git's global options.
const DESTRUCTIVE = {
  stash: () => true,
  restore: () => true,
  clean: () => true,
  reset: (args) => args.includes('--hard'),
  checkout: (args) => args.includes('--') || args.includes('.') || args.some((a) => a === '-f' || a === '--force'),
  switch: (args) => args.some((a) => a === '-f' || a === '--force' || a === '--discard-changes'),
};

export function blockReason(input) {
  if (!/plumb-builder$/.test(input.agent_type ?? '')) return null;
  if (input.tool_name !== 'Bash') return null;
  for (const argv of commands(String(input.tool_input?.command ?? ''))) {
    const [sub, ...args] = gitSubcommand(argv) ?? [];
    if (!DESTRUCTIVE[sub]?.(args)) continue;
    return `plumb-builder may not run \`git ${sub}\`: it can discard or hide uncommitted work in a shared checkout. ` +
      'To run something against the base, use `git worktree add <tmp-dir> <base>` and run it there.';
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.PLUMB_HOOK === 'off') process.exit(0);
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  const reason = blockReason(input);
  if (reason) {
    process.stderr.write(reason + '\n');
    process.exit(2);
  }
}
