#!/usr/bin/env node
// PreToolUse guard: send PR body updates and chained comments through scripts/pr-publish.mjs,
// so a failed step cannot leave a comment that describes work GitHub does not show.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { commands, gitSubcommand, program } from './shell-commands.mjs';
import { isMain } from '../scripts/entry.mjs';

const PUBLISH = fileURLToPath(new URL('../scripts/pr-publish.mjs', import.meta.url));
const FIX = `Run: node "${PUBLISH}" --repo R --pr N --body FILE [--comment FILE]. It checks the text and images, reads the body back, and posts the comment last.`;

const BODY_FLAGS = /^(?:--body(?:-file)?(?:=|$)|-[bF])/;

export function blockReason(input) {
  if (input.tool_name !== 'Bash') return null;
  const argvs = commands(String(input.tool_input?.command ?? '')).map(program);
  const isGh = (a, ...words) => a[0] === 'gh' && words.every((w, k) => a[k + 1] === w);
  if (argvs.some((a) => isGh(a, 'pr', 'edit') && a.some((arg) => BODY_FLAGS.test(arg)))) {
    return `\`gh pr edit\` fails on the retired Projects (classic) field. ${FIX}`;
  }
  const changesState = argvs.some((a) => ['push', 'commit'].includes(gitSubcommand(a)?.[0])
    || (isGh(a, 'api') && a.some((arg) => /^(?:-X|--method=?)?PATCH$/i.test(arg))));
  if (changesState && argvs.some((a) => isGh(a, 'pr', 'comment'))) {
    return `This posts a comment in the same command as the work it describes, so a failed step can leave the comment wrong. ${FIX}`;
  }
  return null;
}

if (isMain(import.meta.url)) {
  if (process.env.PLUMB_HOOK === 'off') process.exit(0);
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  const reason = blockReason(input);
  if (reason) {
    process.stderr.write(reason + '\n');
    process.exit(2);
  }
}
