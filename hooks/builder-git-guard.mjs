#!/usr/bin/env node
// PreToolUse guard: a plumb-builder must not rewrite or discard working-tree state,
// because a worktree can fall back to the parent's checkout and sweep up its uncommitted work.
import { readFileSync } from 'node:fs';

const DESTRUCTIVE = /\bgit\s+(?:-C\s+\S+\s+)?(stash\b|reset\s+--hard\b|checkout\s+(?:--\s|\.(?:\s|$))|restore\b|clean\b)/;

export function blockReason(input) {
  if (!/plumb-builder$/.test(input.agent_type ?? '')) return null;
  if (input.tool_name !== 'Bash') return null;
  const match = String(input.tool_input?.command ?? '').match(DESTRUCTIVE);
  if (!match) return null;
  return `plumb-builder may not run \`git ${match[1].trim()}\`: it can discard or hide uncommitted work in a shared checkout. ` +
    'To run something against the base, use `git worktree add <tmp-dir> <base>` and run it there.';
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
