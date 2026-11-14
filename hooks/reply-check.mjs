#!/usr/bin/env node
// Stop hook for the Finish rule of the plumb skill: the walked todolist in the final reply names every lane step,
// each done or carrying `adjusted:` or `skip:` with a reason, and at Standard or Strict a step whose lane text hands
// work to plumb-builder or runs `review` is marked done only when this task spawned that subagent.
// It reads the Claude Code JSONL transcript. Any other transcript (Codex) fails to classify, so the hook passes.
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain } from '../scripts/entry.mjs';

function readLanes(root) {
  const dir = join(root, 'skills/plumb/lanes');
  const lanes = {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const text = readFileSync(join(dir, name), 'utf8');
    const lane = text.match(/^# (\S+) lane\s*$/m)?.[1];
    if (lane) lanes[lane] = [...text.matchAll(/^\d+\.\s+\*\*(.+?)\.\*\*(.*)$/gm)].map((m) => ({ step: m[1], body: m[2] }));
  }
  return lanes;
}

export function laneSteps(root) {
  return Object.fromEntries(Object.entries(readLanes(root)).map(([lane, steps]) => [lane, steps.map((s) => s.step)]));
}

// The subagent each step must have spawned, read from the step's own text in the lane file.
export function laneEvidence(root) {
  return Object.fromEntries(Object.entries(readLanes(root)).map(([lane, steps]) => [lane, Object.fromEntries(steps.flatMap(({ step, body }) => {
    if (body.includes('`plumb:plumb-builder`')) return [[step, 'plumb-builder']];
    if (/\bRun `review`/.test(body)) return [[step, 'plumb-reviewer']];
    return [];
  }))]));
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

// The entries of the current task: everything after the latest earlier turn whose reply held a walked list,
// so a subagent spawned for an earlier task in the same session does not back this one.
export function taskEntries(entries, steps) {
  const list = main(entries);
  const turnStarts = [0];
  // Hook feedback, such as a blocked stop, is stored as a meta user entry. It does not start a task: the rewritten
  // reply after it belongs to the task the blocked one did.
  list.forEach((e, k) => { if (isRealUserTurn(e) && !e.isMeta) turnStarts.push(k + 1); });
  for (let t = turnStarts.length - 2; t >= 0; t--) {
    const turn = list.slice(turnStarts[t], turnStarts[t + 1]);
    const text = turn.filter((e) => e.type === 'assistant').flatMap(texts).join('\n');
    if (isWalkedList(stepStatuses(text, steps))) return list.slice(turnStarts[t + 1]);
  }
  return list;
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

// The plumb skill puts lane steps in a checklist only in the final reply, so two checklist steps mark one.
const isWalkedList = (statuses) => Object.values(statuses).filter((s) => s.status !== 'missing').length >= 2;

export function problems({ text, lane, rigor, steps, evidence = {}, toolUses }) {
  const statuses = stepStatuses(text, steps);
  if (!isWalkedList(statuses)) return [];
  const found = [];
  for (const [step, { status, reason }] of Object.entries(statuses)) {
    if (status === 'missing') found.push(`${lane} step "${step}" is missing from the walked list`);
    else if (status === 'open') found.push(`"${step}" is open with no adjusted: or skip: reason (mid-task, report progress in one line, not as a lane checklist)`);
    else if (status !== 'done' && !reason) found.push(`"${step}" is marked ${status}: with no reason`);
  }
  if (/^(standard|strict)$/i.test(rigor)) {
    for (const [step, who] of Object.entries(evidence)) {
      if (statuses[step]?.status !== 'done') continue;
      const spawned = toolUses.some((u) => (u.name === 'Agent' || u.name === 'Task') && (u.input?.subagent_type ?? '').endsWith(who));
      if (!spawned) {
        found.push(`"${step}" is marked done at ${rigor} but no ${who} subagent ran for this task, so mark it adjusted: <what changed>, <why> or spawn the ${who}`);
      }
    }
  }
  return found;
}

const STALE_MS = 14 * 24 * 3600 * 1000;

if (isMain(import.meta.url)) {
  if (process.env.PLUMB_HOOK === 'off') process.exit(0);
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch {}
  try {
    // No early exit on stop_hook_active: when the finish gate blocked first, the rewritten reply still needs checking.
    // The once-per-state marker below is what keeps the session from being trapped.
    const entries = readFileSync(input.transcript_path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    const c = classification(entries);
    const root = fileURLToPath(new URL('..', import.meta.url));
    const steps = c && laneSteps(root)[c.lane];
    if (!steps?.length) process.exit(0);
    const task = taskEntries(entries, steps);
    const found = problems({ text: replyText(entries), lane: c.lane, rigor: c.rigor, steps, evidence: laneEvidence(root)[c.lane], toolUses: toolUses(task) });
    if (!found.length) process.exit(0);
    // The marker lives in the temp dir, not the git dir as the finish gate's does, because a reply can need checking
    // outside a git repo. Old markers are pruned here for the same reason.
    const dir = tmpdir();
    for (const name of readdirSync(dir).filter((n) => n.startsWith('plumb-reply-check-'))) {
      try { if (Date.now() - statSync(join(dir, name)).mtimeMs > STALE_MS) rmSync(join(dir, name), { force: true }); } catch {}
    }
    const marker = join(dir, `plumb-reply-check-${String(input.session_id ?? 'none').replace(/[^\w-]/g, '_')}`);
    const state = JSON.stringify(found);
    if (existsSync(marker) && readFileSync(marker, 'utf8') === state) process.exit(0);
    writeFileSync(marker, state);
    const reason = `plumb reply check: ${found.join('; ')}. Fix the walked list in your reply (see the Finish section of the plumb skill), or do the missing step.`;
    process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  } catch {
    // A broken check must never trap the session.
  }
}
