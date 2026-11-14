import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../failure-log.mjs', import.meta.url));
const required = ['--context', 'was editing x', '--cause', 'assumed y', '--fix', 'did z'];

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'failure-log-'));
  const home = join(base, 'home');
  mkdirSync(home);
  return { base, home, log: join(base, 'logs', 'failures.jsonl') };
}

function repo(base, name, remote) {
  const dir = join(base, name);
  mkdirSync(dir);
  const g = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  if (remote) g('remote', 'add', 'origin', remote);
  writeFileSync(join(dir, 'a.txt'), 'base\n');
  g('add', '.');
  g('commit', '-q', '-m', 'base');
  return { dir, g };
}

function cli(env, cwd, args, session) {
  return spawnSync('node', [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: env.home, PLUMB_FAILURE_LOG: env.log, CLAUDE_CODE_SESSION_ID: session ?? '' },
  });
}

function listJson(env, cwd, args = []) {
  const run = cli(env, cwd, ['list', '--json', ...args]);
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test('add records repo, branch, sha, session, and the transcript found under HOME; list shows it', () => {
  const env = setup();
  const { dir, g } = repo(env.base, 'one', 'git@example.com:me/one.git');
  const transcript = join(env.home, '.claude', 'projects', '-tmp-one', 'sess-1.jsonl');
  mkdirSync(join(env.home, '.claude', 'projects', '-tmp-one'), { recursive: true });
  writeFileSync(transcript, '{}\n');
  const add = cli(env, dir, ['add', ...required, '--lane', 'Feature', '--skill', 'implement', '--tag', 'test', '--tag', 'git'], 'sess-1');
  assert.equal(add.status, 0, add.stderr);
  const id = add.stdout.trim();
  assert.match(id, /^\d{8}T\d{6}Z-[0-9a-f]{4}$/);
  const [entry] = listJson(env, dir);
  assert.equal(entry.id, id);
  assert.equal(entry.repo, 'git@example.com:me/one.git');
  assert.equal(entry.branch, 'main');
  assert.equal(entry.sha, g('rev-parse', 'HEAD'));
  assert.equal(entry.session, 'sess-1');
  assert.equal(entry.transcript, transcript);
  assert.equal(entry.lane, 'Feature');
  assert.equal(entry.skill, 'implement');
  assert.deepEqual(entry.tags, ['test', 'git']);
  assert.equal(entry.context, 'was editing x');
  assert.equal(entry.encoded, null);
  const md = cli(env, dir, ['list']);
  assert.equal(md.status, 0);
  for (const text of [id, 'git@example.com:me/one.git', `main@${entry.sha.slice(0, 7)}`, 'Feature/implement', transcript, 'was editing x', 'assumed y', 'did z']) {
    assert.ok(md.stdout.includes(text), `markdown should contain ${text}:\n${md.stdout}`);
  }
});

test('encode drops an entry from list --open and plain list shows encoded', () => {
  const env = setup();
  const { dir } = repo(env.base, 'one');
  const id = cli(env, dir, ['add', ...required]).stdout.trim();
  const other = cli(env, dir, ['add', '--context', 'c2', '--cause', 'k2', '--fix', 'f2']).stdout.trim();
  const enc = cli(env, dir, ['encode', id, '--by', 'abc1234']);
  assert.equal(enc.status, 0, enc.stderr);
  assert.deepEqual(listJson(env, dir, ['--open']).map((e) => e.id), [other]);
  const all = listJson(env, dir);
  assert.equal(all.find((e) => e.id === id).encoded.by, 'abc1234');
  assert.match(cli(env, dir, ['list']).stdout, /encoded: abc1234/);
  const bad = cli(env, dir, ['encode', 'nope', '--by', 'x']);
  assert.equal(bad.status, 1);
});

test('a missing --fix or an unknown flag exits 2 and writes nothing', () => {
  const env = setup();
  const { dir } = repo(env.base, 'one');
  for (const args of [['add', '--context', 'a', '--cause', 'b'], ['add', ...required, '--bogus', 'x'], ['add', ...required.slice(0, 5), '']]) {
    const run = cli(env, dir, args);
    assert.equal(run.status, 2, `args ${JSON.stringify(args)}`);
    assert.match(run.stderr, /usage: failure-log\.mjs/);
  }
  assert.equal(existsSync(env.log), false);
});

test('add works outside a git repo with repo, branch, and sha null', () => {
  const env = setup();
  const dir = join(env.base, 'plain');
  mkdirSync(dir);
  assert.equal(cli(env, dir, ['add', ...required]).status, 0);
  const [entry] = listJson(env, dir);
  assert.equal(entry.repo, null);
  assert.equal(entry.branch, null);
  assert.equal(entry.sha, null);
  assert.equal(entry.session, null);
  assert.equal(entry.transcript, null);
});

test('a repo with no commits records its branch and a null sha', () => {
  const env = setup();
  const dir = join(env.base, 'empty');
  mkdirSync(dir);
  execFileSync('git', ['init', '-q', '-b', 'trunk'], { cwd: dir });
  assert.equal(cli(env, dir, ['add', ...required]).status, 0);
  const [entry] = listJson(env, dir);
  assert.equal(entry.sha, null);
  assert.equal(entry.branch, 'trunk');
  assert.ok(entry.repo.endsWith('empty'));
});

test('--here and --repo filter across two repos, and --since drops older entries', () => {
  const env = setup();
  const a = repo(env.base, 'alpha', 'https://example.com/alpha.git');
  const b = repo(env.base, 'beta');
  cli(env, a.dir, ['add', ...required]);
  cli(env, b.dir, ['add', ...required]);
  assert.equal(listJson(env, a.dir).length, 2);
  assert.deepEqual(listJson(env, a.dir, ['--here']).map((e) => e.repo), ['https://example.com/alpha.git']);
  assert.deepEqual(listJson(env, a.dir, ['--repo', 'beta']).map((e) => e.repo), [b.dir]);
  assert.equal(listJson(env, a.dir, ['--since', '2999-01-01']).length, 0);
  assert.equal(listJson(env, a.dir, ['--since', '2000-01-01']).length, 2);
});

test('a malformed line is skipped with a warning, and a missing log lists as empty', () => {
  const env = setup();
  const { dir } = repo(env.base, 'one');
  const empty = cli(env, dir, ['list']);
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /no failures/);
  cli(env, dir, ['add', ...required]);
  appendFileSync(env.log, 'not json\n');
  cli(env, dir, ['add', ...required]);
  const run = cli(env, dir, ['list', '--json']);
  assert.equal(run.status, 0);
  assert.equal(JSON.parse(run.stdout).length, 2);
  assert.match(run.stderr, /warning: .*line 2/);
  assert.equal(readFileSync(env.log, 'utf8').trim().split('\n').length, 3);
});
