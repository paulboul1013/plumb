#!/usr/bin/env node
// Keeps one log of the mistakes agents fixed in their own work, across every repo on this machine, so
// /plumb:retro can turn recurring ones into checks without digging through old session transcripts.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const USAGE = `usage: failure-log.mjs add --context <text> --cause <text> --fix <text> [--lane L] [--skill S] [--tag T]...
       failure-log.mjs list [--here | --repo <substring>] [--since YYYY-MM-DD] [--open] [--json]
       failure-log.mjs encode <id> --by <commit-or-file>
log file: $PLUMB_FAILURE_LOG, default ~/.plumb/failures.jsonl`;

function usage(message) {
  console.error(`error: ${message}\n${USAGE}`);
  process.exit(2);
}

const logFile = process.env.PLUMB_FAILURE_LOG || join(homedir(), '.plumb', 'failures.jsonl');

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function currentRepo() {
  const top = git(['rev-parse', '--show-toplevel']);
  return top && (git(['remote', 'get-url', 'origin']) ?? top);
}

// Flags whose value may repeat collect into an array; every flag takes exactly one value.
function parseFlags(argv, spec) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (!(name in spec)) usage(`unknown flag ${arg}`);
    if (spec[name] === 'bool') { flags[name] = true; continue; }
    const value = argv[i + 1];
    if (value === undefined) usage(`${arg} needs a value`);
    i += 1;
    if (spec[name] === 'list') (flags[name] ??= []).push(value);
    else flags[name] = value;
  }
  return { flags, positional };
}

function append(event) {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${JSON.stringify(event)}\n`);
}

function readEvents() {
  if (!existsSync(logFile)) return [];
  const events = [];
  readFileSync(logFile, 'utf8').split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    try {
      events.push(JSON.parse(line));
    } catch {
      console.error(`warning: ${logFile} line ${index + 1} is not JSON, skipped`);
    }
  });
  return events;
}

function fold(events) {
  const encoded = new Map();
  for (const e of events) if (e?.type === 'encoded') encoded.set(e.id, { by: e.by, time: e.time });
  return events
    .filter((e) => e?.type === 'failure')
    .map((e) => ({ ...e, encoded: encoded.get(e.id) ?? null }));
}

function findTranscript(session) {
  if (!session) return null;
  const projects = join(homedir(), '.claude', 'projects');
  if (!existsSync(projects)) return null;
  for (const dir of readdirSync(projects)) {
    const file = join(projects, dir, `${session}.jsonl`);
    if (existsSync(file)) return file;
  }
  return null;
}

function add(argv) {
  const { flags, positional } = parseFlags(argv, { context: 'one', cause: 'one', fix: 'one', lane: 'one', skill: 'one', tag: 'list' });
  if (positional.length) usage(`unexpected argument "${positional[0]}"`);
  for (const key of ['context', 'cause', 'fix']) if (!flags[key]?.trim()) usage(`--${key} is required`);
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const id = `${stamp}-${randomBytes(2).toString('hex')}`;
  const top = git(['rev-parse', '--show-toplevel']);
  const session = process.env.CLAUDE_CODE_SESSION_ID || null;
  append({
    type: 'failure',
    id,
    time: now.toISOString(),
    repo: currentRepo(),
    branch: top && git(['symbolic-ref', '--short', 'HEAD']),
    sha: top && git(['rev-parse', '--verify', '-q', 'HEAD']),
    session,
    transcript: findTranscript(session),
    lane: flags.lane ?? null,
    skill: flags.skill ?? null,
    tags: flags.tag ?? [],
    context: flags.context,
    cause: flags.cause,
    fix: flags.fix,
  });
  console.log(id);
}

function markdown(entry) {
  const where = `${entry.branch ?? '?'}@${entry.sha ? entry.sha.slice(0, 7) : '?'}`;
  const lines = [
    `## ${entry.id}`,
    '',
    `- time: ${entry.time}`,
    `- repo: ${entry.repo ?? '(none)'}`,
    `- at: ${where}`,
    `- lane/skill: ${entry.lane ?? '-'}/${entry.skill ?? '-'}`,
    `- tags: ${entry.tags?.length ? entry.tags.join(', ') : '-'}`,
    `- transcript: ${entry.transcript ?? '-'}`,
  ];
  if (entry.encoded) lines.push(`- encoded: ${entry.encoded.by}`);
  lines.push('', `**Context:** ${entry.context}`, '', `**Cause:** ${entry.cause}`, '', `**Fix:** ${entry.fix}`);
  return lines.join('\n');
}

function list(argv) {
  const { flags, positional } = parseFlags(argv, { here: 'bool', repo: 'one', since: 'one', open: 'bool', json: 'bool' });
  if (positional.length) usage(`unexpected argument "${positional[0]}"`);
  if (flags.here && flags.repo) usage('--here and --repo cannot be combined');
  if (flags.since && !/^\d{4}-\d\d-\d\d$/.test(flags.since)) usage('--since takes YYYY-MM-DD');
  const here = flags.here ? currentRepo() : undefined;
  const entries = fold(readEvents())
    .filter((e) => !flags.here || e.repo === here)
    .filter((e) => !flags.repo || (e.repo ?? '').includes(flags.repo))
    .filter((e) => !flags.since || String(e.time) >= flags.since)
    .filter((e) => !flags.open || !e.encoded)
    .reverse()
    .sort((a, b) => String(b.time).localeCompare(String(a.time)));
  if (flags.json) console.log(JSON.stringify(entries, null, 2));
  else if (!entries.length) console.log('no failures logged');
  else console.log(entries.map(markdown).join('\n\n'));
}

function encode(argv) {
  const { flags, positional } = parseFlags(argv, { by: 'one' });
  if (positional.length !== 1) usage('encode takes exactly one id');
  if (!flags.by?.trim()) usage('--by is required');
  const [id] = positional;
  if (!fold(readEvents()).some((e) => e.id === id)) {
    console.error(`error: no failure with id ${id} in ${logFile}`);
    process.exit(1);
  }
  append({ type: 'encoded', id, by: flags.by, time: new Date().toISOString() });
}

const [command, ...rest] = process.argv.slice(2);
const commands = { add, list, encode };
if (!commands[command]) usage(command ? `unknown command "${command}"` : 'missing command');
commands[command](rest);
