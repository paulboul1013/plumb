#!/usr/bin/env node
// Keeps one log of every review finding and what became of it, across every repo on this machine, so
// /plumb:retro can judge from counts whether an axis earns its cost on each kind of change.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { appendEvent, currentRepo, git, newId, parseFlags as parseLogFlags, readEvents } from './jsonl-log.mjs';

const AXES = ['Standards', 'Spec', 'Proof', 'Adversarial'];
const OUTCOMES = ['useful', 'trivial', 'wrong'];
const CHANGES = ['code', 'prose'];

const USAGE = `usage: review-log.mjs add --axis <${AXES.join('|')}> --outcome <${OUTCOMES.join('|')}> --change <${CHANGES.join('|')}> --summary <text>
       review-log.mjs stats [--since YYYY-MM-DD] [--json]
log file: $PLUMB_REVIEW_LOG, default ~/.plumb/review-findings.jsonl`;

function usage(message) {
  console.error(`error: ${message}\n${USAGE}`);
  process.exit(2);
}

const logFile = process.env.PLUMB_REVIEW_LOG || join(homedir(), '.plumb', 'review-findings.jsonl');
const parseFlags = (argv, spec) => parseLogFlags(argv, spec, usage);

function oneOf(flags, name, allowed) {
  if (!allowed.includes(flags[name])) usage(`--${name} must be one of ${allowed.join(', ')}`);
}

function add(argv) {
  const { flags, positional } = parseFlags(argv, { axis: 'one', outcome: 'one', change: 'one', summary: 'one' });
  if (positional.length) usage(`unexpected argument "${positional[0]}"`);
  oneOf(flags, 'axis', AXES);
  oneOf(flags, 'outcome', OUTCOMES);
  oneOf(flags, 'change', CHANGES);
  if (!flags.summary?.trim()) usage('--summary is required');
  const now = new Date();
  const id = newId(now);
  const top = git(['rev-parse', '--show-toplevel']);
  appendEvent(logFile, {
    type: 'finding',
    id,
    time: now.toISOString(),
    repo: currentRepo(),
    sha: top && git(['rev-parse', '--verify', '-q', 'HEAD']),
    session: process.env.CLAUDE_CODE_SESSION_ID || null,
    axis: flags.axis,
    outcome: flags.outcome,
    change: flags.change,
    summary: flags.summary,
  });
  console.log(id);
}

// One review is one reviewer pass, so findings from the same session at the same commit share it.
function tally(findings) {
  const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0]));
  for (const f of findings) if (f.outcome in counts) counts[f.outcome] += 1;
  return { ...counts, reviews: new Set(findings.map((f) => `${f.session}\u0000${f.sha}`)).size };
}

function aggregate(findings) {
  return AXES.flatMap((axis) => {
    const mine = findings.filter((f) => f.axis === axis);
    if (!mine.length) return [];
    const row = { axis, reviews: tally(mine).reviews };
    for (const change of CHANGES) {
      const part = mine.filter((f) => f.change === change);
      if (part.length) row[change] = tally(part);
    }
    return [row];
  });
}

function stats(argv) {
  const { flags, positional } = parseFlags(argv, { since: 'one', json: 'bool' });
  if (positional.length) usage(`unexpected argument "${positional[0]}"`);
  if (flags.since && !/^\d{4}-\d\d-\d\d$/.test(flags.since)) usage('--since takes YYYY-MM-DD');
  const findings = readEvents(logFile)
    .filter((e) => e?.type === 'finding')
    .filter((e) => !flags.since || String(e.time) >= flags.since);
  const rows = aggregate(findings);
  if (flags.json) { console.log(JSON.stringify(rows, null, 2)); return; }
  if (!rows.length) { console.log('no review findings logged'); return; }
  for (const row of rows) {
    for (const change of CHANGES) {
      const t = row[change];
      if (t) console.log(`${row.axis} ${change}: ${OUTCOMES.map((o) => `${o} ${t[o]}`).join(', ')} (reviews: ${t.reviews})`);
    }
  }
}

const [command, ...rest] = process.argv.slice(2);
const commands = { add, stats };
if (!commands[command]) usage(command ? `unknown command "${command}"` : 'missing command');
commands[command](rest);
