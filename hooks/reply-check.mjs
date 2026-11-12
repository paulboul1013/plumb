#!/usr/bin/env node
// Stop hook for the Finish rule of the plumb skill: the walked todolist in the final reply names every lane step,
// each done or carrying `adjusted:` or `skip:` with a reason, and at Standard or Strict a Build or Review marked done
// has the builder or reviewer spawn in the transcript to back it.
// It reads the Claude Code JSONL transcript. Any other transcript (Codex) fails to classify, so the hook passes.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function laneSteps(root) {
  const dir = join(root, 'skills/plumb/lanes');
  const lanes = {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const text = readFileSync(join(dir, name), 'utf8');
    const lane = text.match(/^# (\S+) lane\s*$/m)?.[1];
    if (!lane) continue;
    lanes[lane] = [...text.matchAll(/^\d+\.\s+\*\*(.+?)\.\*\*/gm)].map((m) => m[1]);
  }
  return lanes;
}

const main = (entries) => entries.filter((e) => e && !e.isSidechain);
const blocks = (e) => (Array.isArray(e.message?.content) ? e.message.content : []);
const texts = (e) => blocks(e).filter((b) => b?.type === 'text').map((b) => b.text);
const isRealUserTurn = (e) => e.type === 'user'
  && (typeof e.message?.content === 'string' || blocks(e).some((b) => b?.type === 'text'));

export function classification(entries) {
  let found = null;
  for (const e of main(entries)) {
    if (e.type !== 'assistant') continue;
    for (const text of texts(e)) {
      for (const m of text.matchAll(/lane:\s*(\w+)\s*·\s*rigor:\s*(\w+)/g)) found = { lane: m[1], rigor: m[2] };
    }
  }
  return found;
}

export function replyText(entries) {
  const list = main(entries);
  let start = 0;
  list.forEach((e, k) => { if (isRealUserTurn(e)) start = k + 1; });
  return list.slice(start).filter((e) => e.type === 'assistant').flatMap(texts).join('\n');
}

export function toolUses(entries) {
  return main(entries).filter((e) => e.type === 'assistant').flatMap(blocks).filter((b) => b?.type === 'tool_use');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stepStatuses(text, steps) {
  const lines = text.split('\n');
  return Object.fromEntries(steps.map((step) => {
    const line = new RegExp(`^\\s*[-*]\\s*\\[([ xX])\\]\\s*(?:\\*\\*)?${escape(step)}\\.?(?:\\*\\*)?(?=$|[\\s:：—\\-,，])(.*)$`, 'i');
    for (const l of lines) {
      const m = l.match(line);
      if (!m) continue;
      const marker = m[2].match(/\b(adjusted|skip)\s*[:：,，]\s*(.*)$/i);
      if (marker) return [step, { status: marker[1].toLowerCase(), reason: marker[2].trim() }];
      return [step, { status: m[1] === ' ' ? 'open' : 'done', reason: '' }];
    }
    return [step, { status: 'missing', reason: '' }];
  }));
}

const EVIDENCE = { Build: /plumb-builder$/, Review: /plumb-reviewer$/ };

export function problems({ text, lane, rigor, steps, toolUses }) {
  const statuses = stepStatuses(text, steps);
  if (Object.values(statuses).filter((s) => s.status !== 'missing').length < 2) return [];
  const found = [];
  for (const [step, { status, reason }] of Object.entries(statuses)) {
    if (status === 'missing') found.push(`${lane} step "${step}" is missing from the walked list`);
    else if (status === 'open') found.push(`"${step}" is open with no adjusted: or skip: reason`);
    else if (status !== 'done' && !reason) found.push(`"${step}" is marked ${status}: with no reason`);
  }
  if (/^(standard|strict)$/i.test(rigor)) {
    for (const [step, agent] of Object.entries(EVIDENCE)) {
      if (statuses[step]?.status !== 'done') continue;
      const spawned = toolUses.some((u) => (u.name === 'Agent' || u.name === 'Task') && agent.test(u.input?.subagent_type ?? ''));
      if (!spawned) {
        const who = agent.source.replace('$', '');
        found.push(`"${step}" is marked done at ${rigor} but no ${who} subagent ran in this session, so mark it adjusted: <what changed>, <why> or spawn the ${who}`);
      }
    }
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (process.env.PLUMB_HOOK === 'off') process.exit(0);
    const input = JSON.parse(readFileSync(0, 'utf8'));
    if (input.stop_hook_active === true || !input.transcript_path) process.exit(0);
    const entries = readFileSync(input.transcript_path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    const c = classification(entries);
    const steps = c && laneSteps(new URL('..', import.meta.url).pathname)[c.lane];
    if (!steps?.length) process.exit(0);
    const found = problems({ text: replyText(entries), lane: c.lane, rigor: c.rigor, steps, toolUses: toolUses(entries) });
    if (!found.length) process.exit(0);
    // Block once per state, so the agent is not trapped when it cannot fix the list.
    const marker = join(tmpdir(), `plumb-reply-check-${String(input.session_id ?? 'none').replace(/[^\w-]/g, '_')}`);
    const state = JSON.stringify(found);
    if (existsSync(marker) && readFileSync(marker, 'utf8') === state) process.exit(0);
    writeFileSync(marker, state);
    const reason = `plumb reply check: ${found.join('; ')}. Fix the walked list in your reply (see the Finish section of the plumb skill), or do the missing step.`;
    process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  } catch {
    // A broken check must never trap the session.
  }
}
