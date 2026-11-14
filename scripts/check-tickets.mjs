#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isMain } from './entry.mjs';

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

const section = (text, name) => text.match(new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1].trim();

// Build, Acceptance, and Proof hold on every tracker, so both loaders share this check.
function checkBody(text) {
  const errors = [];
  const acceptance = section(text, 'Acceptance');
  if (!acceptance || !/^- \[[ xX]\] \S/m.test(acceptance)) errors.push('"## Acceptance" needs at least one "- [ ] <behavior>" item');
  if (!section(text, 'Proof')) errors.push('"## Proof" is empty: name the command, scenario, or screenshot that shows it working');
  if (!section(text, 'Build')) errors.push('"## Build" is empty: describe the end-to-end behavior');
  return errors;
}

// A decision ticket's output is a decision, not code, so it holds a Question instead of Build, Acceptance, and Proof.
function checkDecisionBody(text) {
  return section(text, 'Question') ? [] : ['"## Question" is empty: state the decision this ticket resolves'];
}

const TYPES = ['research', 'prototype', 'align', 'task'];
const DECISION_STATUSES = new Set([...STATUSES, 'out-of-scope']);

function parseTicket(file, raw) {
  const text = maskFences(raw);
  const errors = [];
  const type = text.match(/^\*\*Type:\*\*\s*(\S+)/m)?.[1];
  if (type && !TYPES.includes(type)) errors.push(`type "${type}" is not one of ${TYPES.join(', ')}`);
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
  const allowed = type ? DECISION_STATUSES : STATUSES;
  if (!status) errors.push('missing "**Status:**" line');
  else if (!allowed.has(status)) errors.push(`status "${status}" is not one of ${[...allowed].join(', ')}`);

  if (!type) errors.push(...checkBody(text));
  else {
    errors.push(...checkDecisionBody(text));
    if (status === 'done' && !section(text, 'Resolution')) errors.push('status is done but "## Resolution" is empty: write the answer and link its assets');
  }
  return { id: file, label: file, ref: file.replace(/\.md$/, ''), file, num: fileNum, blockers, status, type, errors };
}

export function loadLocal(dir) {
  const files = readdirSync(dir).filter((f) => /^\d+-.+\.md$/.test(f)).sort();
  return files.map((f) => parseTicket(f, readFileSync(join(dir, f), 'utf8')));
}

// A ticket ruled out of scope leaves the route, so it unblocks like a done one. Only decision tickets can be ruled out.
const isOutOfScope = (t) => Boolean(t.type) && t.status === 'out-of-scope';
const isClosed = (t) => t.status === 'done' || isOutOfScope(t);

// The map is an index: every decision made, and every ticket ruled out, has a pointer there.
// `mentions(section, ticket)` decides what a pointer looks like on each tracker.
function checkMap(label, rawMap, tickets, mentions) {
  const map = maskFences(rawMap);
  const errors = [];
  if (!section(map, 'Destination')) errors.push(`${label}: "## Destination" is empty: say what reaching the end of this map looks like`);
  const decided = section(map, 'Decisions so far') ?? '';
  const outOfScope = section(map, 'Out of scope') ?? '';
  for (const t of tickets.filter((t) => t.type)) {
    if (t.status === 'done' && !mentions(decided, t)) errors.push(`${label}: "## Decisions so far" does not mention done ticket ${t.ref}: append a pointer to it`);
    if (t.status === 'out-of-scope' && !mentions(outOfScope, t)) errors.push(`${label}: "## Out of scope" does not mention out-of-scope ticket ${t.ref}: add one line for it`);
  }
  return errors;
}

const mentionsLocal = (text, t) => new RegExp(`(?<![\\w-])${t.ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text);
// A pointer is a `#n` reference or a link to the issue's URL, which ends in `/issues/n`.
const mentionsGitHub = (text, t) => new RegExp(`(?:#|/issues/)${t.num}(?!\\d)`).test(text);

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
      else if (t.status !== 'ready' && !isOutOfScope(t) && !isClosed(blocker)) t.errors.push(`status is ${t.status} but blocker ${ref(b)} is ${blocker.status}`);
    }
  }
  const frontier = tickets.filter((t) => t.status === 'ready' && t.blockers.every((b) => byNum.has(b) && isClosed(byNum.get(b))));
  return { tickets, frontier, errors: tickets.flatMap((t) => t.errors.map((e) => `${t.label}: ${e}`)) };
}

function gh(args) {
  return execFileSync('gh', ['api', '--paginate', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const lines = (out) => out.split('\n').filter(Boolean);

// A plumb:<type> label makes a sub-issue a decision ticket, since its body never states the type.
const LABEL_PREFIX = 'plumb:';

function labelType(labels) {
  const plumb = labels.filter((l) => l.startsWith(LABEL_PREFIX));
  const typeOf = (l) => l.slice(LABEL_PREFIX.length);
  const errors = plumb.filter((l) => !TYPES.includes(typeOf(l)))
    .map((l) => `label "${l}" is not one of ${TYPES.map((t) => LABEL_PREFIX + t).join(', ')}`);
  if (plumb.length > 1) errors.unshift(`more than one plumb type label: ${plumb.join(', ')}`);
  return { type: plumb[0] && typeOf(plumb[0]), errors };
}

// The tracker holds the title, the blocking links, and the state, so only the body is checked.
export function loadGitHub(repo, parent) {
  const issues = lines(gh([`repos/${repo}/issues/${parent}/sub_issues`, '--jq', '.[] | {number,title,body,state,state_reason,assignees:[.assignees[].login],labels:[.labels[].name]}']))
    .map((line) => JSON.parse(line));
  const tickets = issues.map((i) => {
    const { type, errors } = labelType(i.labels ?? []);
    const body = maskFences(i.body ?? '');
    const closed = type && i.state_reason === 'not_planned' ? 'out-of-scope' : 'done';
    return {
      id: i.number,
      label: `#${i.number} ${i.title}`,
      ref: `#${i.number}`,
      num: i.number,
      type,
      blockers: lines(gh([`repos/${repo}/issues/${i.number}/dependencies/blocked_by`, '--jq', '.[].number'])).map(Number),
      status: i.state === 'closed' ? closed : i.assignees.length ? 'in-progress' : 'ready',
      errors: type ? [...errors, ...checkDecisionBody(body)] : checkBody(body),
    };
  });
  const map = JSON.parse(gh([`repos/${repo}/issues/${parent}`, '--jq', '{body,labels:[.labels[].name]}']));
  return { tickets, map: map.labels.includes('plumb:map') ? map.body ?? '' : null };
}

export function checkTickets(dir) {
  const result = checkGraph(loadLocal(dir));
  const mapFile = join(dirname(resolve(dir)), 'map.md');
  // Build tickets can share a parent folder with the map, so only a dir of decision tickets is checked against it.
  if (result.tickets.some((t) => t.type) && existsSync(mapFile)) result.errors.push(...checkMap('map.md', readFileSync(mapFile, 'utf8'), result.tickets, mentionsLocal));
  return result;
}

function run(args) {
  const github = args.indexOf('--github');
  if (github >= 0) {
    const [repo, parent] = args.slice(github + 1);
    if (!repo || !/^\d+$/.test(parent ?? '')) return { usage: true };
    let loaded;
    try {
      loaded = loadGitHub(repo, parent);
    } catch (err) {
      return { fatal: err.stderr?.toString() || err.message };
    }
    const { tickets, map } = loaded;
    const result = checkGraph(tickets, { ref: (n) => `#${n}`, missing: (b) => `blocker #${b} is not a sub-issue of #${parent}` });
    if (tickets.length === 0) result.errors.push(`#${parent}: no sub-issues found`);
    if (map !== null) result.errors.push(...checkMap(`#${parent}`, map, tickets, mentionsGitHub));
    return result;
  }
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) return { usage: true };
  const result = checkTickets(dir);
  if (result.tickets.length === 0) result.errors.push(`${dir}: no NN-<slug>.md tickets found`);
  return result;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const { usage, fatal, tickets, frontier, errors } = run(args);
  if (usage) {
    console.error('usage: check-tickets.mjs <tickets-or-decisions-dir> [--frontier]\n       check-tickets.mjs --github <owner/repo> <spec-or-map-issue> [--frontier]');
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
