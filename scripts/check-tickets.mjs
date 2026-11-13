#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
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

// Build, Acceptance, and Proof hold on every tracker, so both loaders share this check.
function checkBody(text) {
  const errors = [];
  const section = (name) => text.match(new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1].trim();
  const acceptance = section('Acceptance');
  if (!acceptance || !/^- \[[ xX]\] \S/m.test(acceptance)) errors.push('"## Acceptance" needs at least one "- [ ] <behavior>" item');
  if (!section('Proof')) errors.push('"## Proof" is empty: name the command, scenario, or screenshot that shows it working');
  if (!section('Build')) errors.push('"## Build" is empty: describe the end-to-end behavior');
  return errors;
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

  errors.push(...checkBody(text));
  return { id: file, label: file, file, num: fileNum, blockers, status, errors };
}

export function loadLocal(dir) {
  const files = readdirSync(dir).filter((f) => /^\d+-.+\.md$/.test(f)).sort();
  return files.map((f) => parseTicket(f, readFileSync(join(dir, f), 'utf8')));
}

const LOCAL = { ref: (n) => `${n}`, missing: (b) => `blocker ${b} does not exist` };

export function checkGraph(tickets, { ref, missing } = LOCAL) {
  const byNum = new Map();
  for (const t of tickets) {
    if (byNum.has(t.num)) t.errors.push(`duplicate ticket number ${t.num}, also used by ${byNum.get(t.num).label}`);
    else byNum.set(t.num, t);
  }
  for (const t of tickets) {
    for (const b of t.blockers) {
      const blocker = byNum.get(b);
      if (!blocker) t.errors.push(missing(b));
      else if (b >= t.num) t.errors.push(`blocker ${ref(b)} must have a lower number than ${ref(t.num)}: number tickets blockers-first`);
      else if (t.status !== 'ready' && blocker.status !== 'done') t.errors.push(`status is ${t.status} but blocker ${ref(b)} is ${blocker.status}`);
    }
  }
  const frontier = tickets.filter((t) => t.status === 'ready' && t.blockers.every((b) => byNum.get(b)?.status === 'done'));
  return { tickets, frontier, errors: tickets.flatMap((t) => t.errors.map((e) => `${t.label}: ${e}`)) };
}

function gh(args) {
  return execFileSync('gh', ['api', '--paginate', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const lines = (out) => out.split('\n').filter(Boolean);

// The tracker holds the title, the blocking links, and the state, so only the body is checked.
export function loadGitHub(repo, parent) {
  const issues = lines(gh([`repos/${repo}/issues/${parent}/sub_issues`, '--jq', '.[] | {number,title,body,state,assignees:[.assignees[].login]}']))
    .map((line) => JSON.parse(line));
  return issues.map((i) => ({
    id: i.number,
    label: `#${i.number} ${i.title}`,
    num: i.number,
    blockers: lines(gh([`repos/${repo}/issues/${i.number}/dependencies/blocked_by`, '--jq', '.[].number'])).map(Number),
    status: i.state === 'closed' ? 'done' : i.assignees.length ? 'in-progress' : 'ready',
    errors: checkBody(maskFences(i.body ?? '')),
  }));
}

export function checkTickets(dir) {
  return checkGraph(loadLocal(dir));
}

function run(args) {
  const github = args.indexOf('--github');
  if (github >= 0) {
    const [repo, parent] = args.slice(github + 1);
    if (!repo || !/^\d+$/.test(parent ?? '')) return { usage: true };
    let tickets;
    try {
      tickets = loadGitHub(repo, parent);
    } catch (err) {
      return { fatal: err.stderr?.toString() || err.message };
    }
    const result = checkGraph(tickets, { ref: (n) => `#${n}`, missing: (b) => `blocker #${b} is not a sub-issue of #${parent}` });
    if (tickets.length === 0) result.errors.push(`#${parent}: no sub-issues found`);
    return result;
  }
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) return { usage: true };
  const result = checkTickets(dir);
  if (result.tickets.length === 0) result.errors.push(`${dir}: no NN-<slug>.md tickets found`);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const { usage, fatal, tickets, frontier, errors } = run(args);
  if (usage) {
    console.error('usage: check-tickets.mjs <tickets-dir> [--frontier]\n       check-tickets.mjs --github <owner/repo> <spec-issue> [--frontier]');
    process.exit(2);
  }
  if (fatal) {
    process.stderr.write(fatal.endsWith('\n') ? fatal : `${fatal}\n`);
    process.exit(2);
  }
  for (const e of errors) console.log(e);
  if (errors.length) process.exit(1);
  if (args.includes('--frontier')) for (const t of frontier) console.log(t.label);
  else console.log(`ok: ${tickets.length} tickets, ${frontier.length} ready now`);
}
