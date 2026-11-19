import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'plumb codex '));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const manifest = json('.codex-plugin/plugin.json');
  const { hooks } = json(manifest.hooks);
  const call = (event, payload, options = {}) => hooks[event][0].hooks.map(({ command }) => spawnSync('sh', ['-c', command], {
    input: JSON.stringify({ cwd, hook_event_name: event, session_id: cwd, ...payload }),
    cwd: tmpdir(),
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_ROOT: root, CLAUDE_PLUGIN_ROOT: '', CLAUDE_PROJECT_DIR: tmpdir(), PLUMB_HOOK: 'on', ...options },
  }));
  return { cwd, call };
}

test('the Codex marketplace points to a native manifest and the shared skills', () => {
  const marketplace = json('.agents/plugins/marketplace.json');
  const [plugin] = marketplace.plugins;
  const manifest = json(join(plugin.source.path, '.codex-plugin/plugin.json'));
  assert.equal(plugin.source.source, 'local');
  assert.equal(manifest.name, plugin.name);
  assert.ok(existsSync(join(root, plugin.source.path, manifest.skills, 'plumb', 'SKILL.md')));
  assert.ok(existsSync(join(root, plugin.source.path, manifest.hooks)));
});

test('Codex startup injects the router context and records the baseline in the payload cwd', (t) => {
  const { cwd, call } = fixture(t);
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, '.plumb'), '');
  writeFileSync(join(cwd, 'user-draft'), 'before');
  const [start] = call('SessionStart', { source: 'startup' });
  assert.equal(start.status, 0, start.stderr);
  const context = JSON.parse(start.stdout).hookSpecificOutput;
  assert.equal(context.hookEventName, 'SessionStart');
  assert.match(context.additionalContext, /plumb:plumb/);
  assert.ok(context.additionalContext.includes(root));
  assert.equal(call('Stop', {})[0].stdout, '');
  writeFileSync(join(cwd, 'task-draft'), 'after');
  const [first] = call('Stop', {});
  assert.match(JSON.parse(first.stdout).reason, /task-draft/);
  assert.doesNotMatch(first.stdout, /user-draft/);
  assert.equal(call('Stop', {})[0].stdout, '');
  assert.equal(call('SessionStart', { source: 'startup' }, { PLUMB_HOOK: 'off' })[0].stdout, '');
});

test('Codex Stop checks the last reply without needing a transcript', (t) => {
  const { call } = fixture(t);
  const header = 'lane: Feature · rigor: Standard (M, two-way)';
  const [, omitted] = call('Stop', { last_assistant_message: header });
  assert.match(JSON.parse(omitted.stdout).reason, /Ground.*missing/);
  const incomplete = `${header}\n\n- [x] Ground\n- [x] Align`;
  const reply = { last_assistant_message: incomplete, transcript_path: null, stop_hook_active: true };
  const [, first] = call('Stop', reply);
  assert.equal(first.status, 0, first.stderr);
  assert.match(JSON.parse(first.stdout).reason, /Build.*missing/);
  assert.equal(call('Stop', reply)[1].stdout, '');
  assert.equal(call('Stop', { last_assistant_message: 'Which acceptance criterion should apply?' })[1].stdout, '');
  const complete = ['Ground', 'Align', 'Design', 'Plan the throughput', 'Build', 'Prove', 'Review', 'Deliver'];
  assert.equal(call('Stop', { last_assistant_message: [header, ...complete.map((s) => `- [x] ${s}`)].join('\n') })[1].stdout, '');
});

test('Codex Bash hooks keep the PR publishing guard', (t) => {
  const { call } = fixture(t);
  const [denied] = call('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'gh pr edit 1 --body x' } });
  assert.equal(denied.status, 2);
  assert.match(denied.stderr, /pr-publish\.mjs/);
});
