import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commands } from '../../hooks/shell-commands.mjs';
import { blockReason as builderReason } from '../../hooks/builder-git-guard.mjs';
import { blockReason as publishReason } from '../../hooks/pr-publish-guard.mjs';

const root = new URL('../..', import.meta.url).pathname;
const builder = (command) => builderReason({ agent_type: 'plumb:plumb-builder', tool_name: 'Bash', tool_input: { command } });
const publish = (command) => publishReason({ tool_name: 'Bash', tool_input: { command } });

test('commands splits on operators and newlines, keeps quoted text as data, and skips heredoc bodies', () => {
  assert.deepEqual(commands('a "b;c" && d \'e|f\'; g'), [['a', 'b;c'], ['d', 'e|f'], ['g']]);
  assert.deepEqual(commands('cat > t <<EOF\nrm -rf x\nEOF\necho done'), [['cat'], ['echo', 'done']]);
  assert.deepEqual(commands("cat <<-'X'\n\tgit stash\n\tX\nls"), [['cat'], ['ls']]);
  assert.deepEqual(commands('a \\\n  b'), [['a', 'b']]);
  assert.deepEqual(commands('echo $(git stash) `git clean -f`'), [['git', 'stash'], ['git', 'clean', '-f'], ['echo']]);
  assert.deepEqual(commands('bash -c "git stash; ls"'), [['bash', '-c', 'git stash; ls'], ['git', 'stash'], ['ls']]);
  assert.deepEqual(commands('ls # git stash'), [['ls']]);
});

test('the guard blocks gh pr edit and chained comments, and names the fix', () => {
  const reason = (command) => publishReason({ tool_name: 'Bash', tool_input: { command } });
  for (const command of [
    'gh pr edit 194 --repo R --body-file b.md 2>&1 | tail -1',
    'git push -q fork x; gh pr comment 194 --body-file c.md',
    'git -C wt commit -qm x && gh pr comment 194 --body-file c.md',
    'gh api -X PATCH repos/R/pulls/1 -F body=@b; gh pr comment 1 --body-file c.md',
  ]) {
    assert.match(reason(command) ?? '', /pr-publish\.mjs/, command);
  }
  for (const command of [
    'gh pr comment 194 --repo R --body-file c.md',
    'gh pr view 194 --repo R --json body',
    'gh pr edit 194 --add-label bug',
    'git push -q fork x',
  ]) {
    assert.equal(reason(command), null, command);
  }
  assert.equal(publishReason({ tool_name: 'Read', tool_input: {} }), null);
});

// Regressions against the old guards, which ran one regex over the whole command string.
test('the publish guard ignores the command text inside data and catches the forms the regex missed', () => {
  const G = 'gh pr';
  for (const command of [
    `cat > t.py <<EOF\nrun("${G} edit 3 --body x")\nEOF`,
    `echo "${G} comment 1 && git push" > notes.txt`,
    `grep -n "${G} edit .* --body" hooks/*.mjs`,
    `node -e 'run("${G} edit 3 --body x")'`,
  ]) assert.equal(publish(command), null, command);
  for (const command of [
    `${G} edit 3 \\\n --body x`,
    `${G} edit 3 --title "a;b" --body x`,
    `GH_PAGER= ${G} edit 3 --body x`,
    `${G} edit 3 -F b.md`,
    `git -c core.hooksPath=x push && ${G} comment 1 --body-file c.md`,
    `if true; then ${G} edit 3 --body x; fi`,
    `{ ${G} edit 3 --body x; }`,
    `timeout 60 ${G} edit 3 --body x`,
  ]) assert.match(publish(command) ?? '', /pr-publish\.mjs/, command);
});

test('the builder guard blocks the git stash a plumb-builder ran, and nothing else', () => {
  const call = (command, agentType) => builderReason({ agent_type: agentType, agent_id: agentType && 'a1', tool_name: 'Bash', tool_input: { command } });
  // The command the builder ran on the shared checkout.
  assert.match(call('git stash && npm run mocha; git stash pop', 'plumb:plumb-builder'), /git worktree add/);
  for (const c of ['git reset --hard HEAD', 'git checkout -- public/js/cover.js', 'git restore .', 'git clean -fd']) assert.ok(call(c, 'plumb:plumb-builder'), c);
  for (const c of ['git status', 'git diff HEAD', 'git checkout -b feature', 'git commit -m x']) assert.equal(call(c, 'plumb:plumb-builder'), null, c);
  assert.equal(call('git stash', undefined), null);
  assert.equal(call('git stash', 'plumb:plumb-reviewer'), null);
});

test('the builder guard ignores git words in data and catches global options and forced switches', () => {
  for (const command of [
    'echo "never git stash" >> NOTES.md',
    'grep -rn "git reset --hard" docs',
    'git log --grep stash',
    'git checkout -b x',
  ]) assert.equal(builder(command), null, command);
  for (const command of [
    'git -c x=y stash',
    'git --git-dir=.git stash',
    'git --no-pager -C wt reset --hard',
    'git switch -f main',
    'git checkout --force main',
    'cd wt && git stash',
    '{ git stash; }',
    'if true; then git stash; fi',
    'for d in a b; do git -C $d stash; done',
    '! git stash',
    'timeout 60 git stash',
    'xargs -n1 git stash',
    'nice -n 5 git clean -fd',
    'sudo -u me git stash',
    '/usr/bin/git stash',
  ]) assert.ok(builder(command), command);
});

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  const g = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });
  g('init', '-q');
  mkdirSync(join(dir, '.plumb'));
  writeFileSync(join(dir, 'README.md'), 'a\n');
  writeFileSync(join(dir, 'main.c'), 'int main(void){return 0;}\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  const hook = (script, input) => execFileSync('sh', ['-c', script.endsWith('.mjs') ? `node "${root}hooks/${script}"` : `"${root}hooks/${script}"`], {
    cwd: dir,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_ROOT: root.replace(/\/$/, ''), PLUMB_HOOK: 'on' },
  });
  const start = (session_id = 's1', source = 'startup') => hook('session-start.sh', { session_id, source });
  const stop = (session_id = 's1') => hook('stop-gate.mjs', { session_id, stop_hook_active: false });
  return { dir, g, start, stop };
}

test('the finish gate ignores changes that were already in the tree when the session started', () => {
  const p = project();
  writeFileSync(join(p.dir, 'README.md'), 'a\nuser note\n');
  writeFileSync(join(p.dir, 'notes.md'), 'draft\n');
  assert.match(p.start(), /plumb plugin/);
  assert.equal(p.stop(), '');
  writeFileSync(join(p.dir, 'out.png'), 'png');
  rmSync(join(p.dir, 'notes.md'));
  const blocked = JSON.parse(p.stop());
  assert.equal(blocked.decision, 'block');
  assert.match(blocked.reason, /out\.png/);
  assert.doesNotMatch(blocked.reason, /README\.md/);
  rmSync(p.dir, { recursive: true });
});

test('the finish gate blocks a task edit, even to a file that was already dirty, once per state', () => {
  const p = project();
  writeFileSync(join(p.dir, 'README.md'), 'a\nuser note\n');
  p.start();
  writeFileSync(join(p.dir, 'main.c'), 'int main(void){return 1;}\n');
  assert.equal(JSON.parse(p.stop()).decision, 'block');
  assert.equal(p.stop(), '');
  writeFileSync(join(p.dir, 'README.md'), 'a\nuser note\ntask line\n');
  const blocked = JSON.parse(p.stop());
  assert.match(blocked.reason, /README\.md/);
  assert.match(blocked.reason, /main\.c/);
  rmSync(p.dir, { recursive: true });
});

test('a resumed session keeps its first baseline, and a session with no baseline counts every change', () => {
  const p = project();
  p.start();
  writeFileSync(join(p.dir, 'main.c'), 'changed\n');
  p.start('s1', 'resume');
  assert.equal(JSON.parse(p.stop()).decision, 'block');
  assert.equal(JSON.parse(p.stop('s2')).decision, 'block');
  p.g('commit', '-qam', 'task');
  assert.equal(p.stop(), '');
  rmSync(p.dir, { recursive: true });
});

test('a clear inherits the newest baseline, so work left from before the clear still counts', () => {
  const p = project();
  p.start('s1');
  writeFileSync(join(p.dir, 'main.c'), 'changed\n');
  p.start('s2', 'clear');
  assert.match(JSON.parse(p.stop('s2')).reason, /main\.c/);
  rmSync(p.dir, { recursive: true });
});
