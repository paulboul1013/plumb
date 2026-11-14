#!/usr/bin/env node
// Finish gate. `record` (from SessionStart) saves the working tree's uncommitted entries once per session.
// The Stop hook then blocks only on entries the session added or changed, so a user's earlier edits never trip it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from '../scripts/entry.mjs';

const STALE_MS = 14 * 24 * 3600 * 1000;
const run = (cwd, args, input) => execFileSync('git', args, { cwd, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
const git = (cwd, ...args) => run(cwd, args);

// Each uncommitted path, keyed to its status and content hash, so any later edit to it shows as a change.
export function dirtyEntries(cwd) {
  const fields = git(cwd, 'status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0');
  const status = new Map();
  for (let k = 0; k < fields.length; k++) {
    const f = fields[k];
    if (f.length < 4) continue;
    if (f[0] === 'R' || f[0] === 'C') k++;
    // With --untracked-files=all, only a nested repository, such as a builder's linked worktree,
    // stays one entry with a trailing slash. Its work belongs to that repository, so skip it.
    if (f.endsWith('/')) continue;
    status.set(f.slice(3), f.slice(0, 2));
  }
  const files = [...status.keys()].filter((p) => { try { return statSync(join(cwd, p)).isFile(); } catch { return false; } });
  const hashes = files.length ? run(cwd, ['hash-object', '--stdin-paths'], files.join('\n')).trim().split('\n') : [];
  const hashOf = new Map(files.map((p, k) => [p, hashes[k]]));
  return Object.fromEntries([...status].map(([p, xy]) => [p, `${xy} ${hashOf.get(p) ?? 'missing'}`]));
}

const sessionFile = (gitDir, kind, sessionId) => join(gitDir, 'plumb', `${kind}-${String(sessionId).replace(/[^\w-]/g, '_')}`);

function gitDirOf(cwd) {
  // --git-dir is absolute in a linked worktree or a subdirectory, and join() would nest it under cwd.
  try { return git(cwd, 'rev-parse', '--absolute-git-dir').trim(); } catch { return null; }
}

function isPlumbRepo(cwd) {
  if (!existsSync(join(cwd, 'docs/agents/plumb.md')) && !existsSync(join(cwd, '.plumb'))) return null;
  return gitDirOf(cwd);
}

// Any git repo gets a baseline, because a session can create .plumb/ partway through
// (record.mjs, tickets, trail, handoff), and the gate then needs what the tree held at the start.
export function record(cwd, sessionId, source) {
  const gitDir = gitDirOf(cwd);
  if (!gitDir || !sessionId) return;
  const dir = join(gitDir, 'plumb');
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (Date.now() - statSync(p).mtimeMs > STALE_MS) rmSync(p, { force: true });
  }
  const file = sessionFile(gitDir, 'baseline', sessionId);
  // A resume or compact keeps the session's first baseline, or its own edits would hide in a new one.
  if (existsSync(file)) return;
  // A clear starts a new session id in the same conversation, so it inherits the newest baseline for the same reason.
  const newest = source === 'clear' && readdirSync(dir)
    .filter((n) => n.startsWith('baseline-'))
    .map((n) => join(dir, n))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  writeFileSync(file, newest ? readFileSync(newest, 'utf8') : JSON.stringify(dirtyEntries(cwd)));
}

// The paths this session changed, or null when the gate should let the stop through.
export function changedPaths(cwd, sessionId) {
  const gitDir = isPlumbRepo(cwd);
  if (!gitDir) return null;
  const baselineFile = sessionId && sessionFile(gitDir, 'baseline', sessionId);
  const baseline = baselineFile && existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {};
  const changed = Object.entries(dirtyEntries(cwd)).filter(([p, v]) => baseline[p] !== v);
  if (!changed.length) return null;
  // Block once per state, so waiting on background reviewers does not re-trigger it.
  mkdirSync(join(gitDir, 'plumb'), { recursive: true });
  const marker = sessionFile(gitDir, 'stopped', sessionId ?? 'none');
  const state = JSON.stringify(changed);
  if (existsSync(marker) && readFileSync(marker, 'utf8') === state) return null;
  writeFileSync(marker, state);
  return changed.map(([p]) => p);
}

if (isMain(import.meta.url)) {
  if (process.env.PLUMB_HOOK === 'off') process.exit(0);
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch {}
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    if (process.argv[2] === 'record') {
      record(cwd, input.session_id, input.source);
    } else if (input.stop_hook_active !== true) {
      const paths = changedPaths(cwd, input.session_id);
      if (paths) {
        const gate = JSON.parse(readFileSync(new URL('./stop-gate.json', import.meta.url), 'utf8'));
        const shown = paths.slice(0, 10).join(', ') + (paths.length > 10 ? `, and ${paths.length - 10} more` : '');
        gate.reason += ` Changed in this session and not committed: ${shown}. Changes that were already there when the session started do not count.`;
        process.stdout.write(JSON.stringify(gate) + '\n');
      }
    }
  } catch {
    // A broken gate must never trap the session.
  }
}
