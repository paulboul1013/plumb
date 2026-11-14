// Helpers shared by the append-only logs under ~/.plumb, which each keep one JSON event per line.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

export function currentRepo() {
  const top = git(['rev-parse', '--show-toplevel']);
  return top && (git(['remote', 'get-url', 'origin']) ?? top);
}

export function newId(now) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${randomBytes(2).toString('hex')}`;
}

// Flags whose value may repeat collect into an array; every flag takes exactly one value.
export function parseFlags(argv, spec, usage) {
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

export function appendEvent(logFile, event) {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${JSON.stringify(event)}\n`);
}

export function readEvents(logFile) {
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
