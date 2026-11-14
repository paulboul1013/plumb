import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../..', import.meta.url));

function symlinkedRepo() {
  const link = join(mkdtempSync(join(tmpdir(), 'entry-link-')), 'link');
  symlinkSync(root, link);
  return link;
}

function spacedRepo() {
  const dir = join(mkdtempSync(join(tmpdir(), 'entry-space-')), 'with space');
  for (const p of ['scripts', 'hooks']) cpSync(join(root, p), join(dir, p), { recursive: true });
  return dir;
}

const stash = JSON.stringify({ agent_type: 'plumb:plumb-builder', tool_name: 'Bash', tool_input: { command: 'git stash' } });

for (const [name, make] of [['a symlinked directory', symlinkedRepo], ['a path with a space', spacedRepo]]) {
  test(`worktree-check runs its CLI through ${name}`, () => {
    const r = spawnSync('node', [join(make(), 'scripts/worktree-check.mjs')], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage: worktree-check\.mjs <worktree-path>/);
  });

  test(`builder-git-guard blocks git stash through ${name}`, () => {
    const r = spawnSync('node', [join(make(), 'hooks/builder-git-guard.mjs')], { input: stash, encoding: 'utf8', env: { ...process.env, PLUMB_HOOK: '' } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /may not run `git stash`/);
  });
}
