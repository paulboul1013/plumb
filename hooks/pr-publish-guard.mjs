#!/usr/bin/env node
// PreToolUse guard: send PR body updates and chained comments through scripts/pr-publish.mjs,
// so a failed step cannot leave a comment that describes work GitHub does not show.
import { readFileSync } from 'node:fs';

const PUBLISH = new URL('../scripts/pr-publish.mjs', import.meta.url).pathname;
const FIX = `Run: node "${PUBLISH}" --repo R --pr N --body FILE [--comment FILE]. It checks the text and images, reads the body back, and posts the comment last.`;

export function blockReason(input) {
  if (input.tool_name !== 'Bash') return null;
  const command = String(input.tool_input?.command ?? '');
  if (/\bgh\s+pr\s+edit\b[^\n;&|]*--body/.test(command)) {
    return `\`gh pr edit\` fails on the retired Projects (classic) field. ${FIX}`;
  }
  const changesState = /\bgit\s+(?:-C\s+\S+\s+)?(?:push|commit)\b|\bgh\s+api\b[^\n;&|]*PATCH/.test(command);
  if (/\bgh\s+pr\s+comment\b/.test(command) && changesState) {
    return `This posts a comment in the same command as the work it describes, so a failed step can leave the comment wrong. ${FIX}`;
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
