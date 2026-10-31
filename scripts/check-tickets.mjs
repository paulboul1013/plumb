#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const STATUSES = new Set(['ready', 'in-progress', 'done']);

// Indent every line of a fenced block so the ticket's own headings, fields, and checklist
// items never match inside an example, while a fenced Proof command still leaves its section non-empty.
function maskFences(text) {
  let fence = null;
  return text.split('\n').map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (!fence && marker) { fence = marker; return `    ${line}`; }
    if (fence && marker && marker[0] === fence[0] && marker.length >= fence.length && !line.slice(line.indexOf(marker) + marker.length).trim()) {
      fence = null;
      return `    ${line}`;
    }
    return fence ? `    ${line}` : line;
  }).join('\n');
}

function parseTicket(file, raw) {
  const text = maskFences(raw);
  const errors = [];
  const fileNum = Number(file.match(/^(\d+)-/)[1]);
  const heading = text.match(/^# (\d+): (.+)$/m);
  if (!heading) errors.push('missing "# NN: <title>" heading');
  else if (Number(heading[1]) !== fileNum) errors.push(`heading number ${heading[1]} does not match file number ${fileNum}`);

  const blockedLine = text.match(/^\*\*Blocked by:\*\*\s*(.+)$/m);
  let blockers = [];
  if (!blockedLine) errors.push('missing "**Blocked by:**" line (write "None" when it can start now)');
  else if (!/^none\b/i.test(blockedLine[1].trim())) {
    blockers = blockedLine[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const n = s.match(/^#?(\d+)/);
      if (!n) errors.push(`blocker "${s}" is not a ticket number`);
      return n ? Number(n[1]) : NaN;
    }).filter((n) => !Number.isNaN(n));
  }

  const statusLine = text.match(/^\*\*Status:\*\*\s*(\S+)/m);
  const status = statusLine?.[1];
  if (!status) errors.push('missing "**Status:**" line');
  else if (!STATUSES.has(status)) errors.push(`status "${status}" is not one of ${[...STATUSES].join(', ')}`);

  const section = (name) => text.match(new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1].trim();
  const acceptance = section('Acceptance');
  if (!acceptance || !/^- \[[ xX]\] \S/m.test(acceptance)) errors.push('"## Acceptance" needs at least one "- [ ] <behavior>" item');
  if (!section('Proof')) errors.push('"## Proof" is empty: name the command, scenario, or screenshot that shows it working');
  if (!section('Build')) errors.push('"## Build" is empty: describe the end-to-end behavior');

  return { file, num: fileNum, blockers, status, errors };
}

export function checkTickets(dir) {
  const files = readdirSync(dir).filter((f) => /^\d+-.+\.md$/.test(f)).sort();
  const tickets = files.map((f) => parseTicket(f, readFileSync(join(dir, f), 'utf8')));
  const byNum = new Map();
  for (const t of tickets) {
    if (byNum.has(t.num)) t.errors.push(`duplicate ticket number ${t.num}, also used by ${byNum.get(t.num).file}`);
    else byNum.set(t.num, t);
  }
  for (const t of tickets) {
    for (const b of t.blockers) {
      const blocker = byNum.get(b);
      if (!blocker) t.errors.push(`blocker ${b} does not exist`);
      else if (b >= t.num) t.errors.push(`blocker ${b} must have a lower number than ${t.num}: number tickets blockers-first`);
      else if (t.status !== 'ready' && blocker.status !== 'done') t.errors.push(`status is ${t.status} but blocker ${b} is ${blocker.status}`);
    }
  }
  const frontier = tickets.filter((t) => t.status === 'ready' && t.blockers.every((b) => byNum.get(b)?.status === 'done'));
  return { tickets, frontier, errors: tickets.flatMap((t) => t.errors.map((e) => `${t.file}: ${e}`)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: check-tickets.mjs <tickets-dir> [--frontier]');
    process.exit(2);
  }
  const { tickets, frontier, errors } = checkTickets(dir);
  if (tickets.length === 0) errors.push(`${dir}: no NN-<slug>.md tickets found`);
  for (const e of errors) console.log(e);
  if (errors.length) process.exit(1);
  if (args.includes('--frontier')) for (const t of frontier) console.log(t.file);
  else console.log(`ok: ${tickets.length} tickets, ${frontier.length} ready now`);
}
