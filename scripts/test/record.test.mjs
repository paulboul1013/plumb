import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const script = new URL('../record.mjs', import.meta.url).pathname;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'record-'));
  const g = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'a.txt'), 'base\n');
  g('add', '.');
  g('commit', '-q', '-m', 'base');
  return { dir, g };
}

function record(dir, args, input) {
  return spawnSync('node', [script, ...args], { cwd: dir, encoding: 'utf8', input });
}

function savedLog(run) {
  const last = run.stderr.trim().split('\n').at(-1);
  const match = last.match(/^recorded: (.+)$/);
  assert.ok(match, `last stderr line should name the log, got: ${last}`);
  return readFileSync(match[1], 'utf8');
}

function header(log, key) {
  return log.match(new RegExp(`^# ${key}: (.*)$`, 'm'))?.[1];
}

test('a passing command writes its output under a header with sha, clean diff, and exit 0', () => {
  const { dir, g } = repo();
  const run = record(dir, ['cart', 'unit', '--', 'node', '-e', 'console.log("all good"); console.error("warned")']);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /all good/);
  const log = savedLog(run);
  assert.equal(header(log, 'sha'), g('rev-parse', 'HEAD'));
  assert.equal(header(log, 'diff'), 'clean');
  assert.equal(header(log, 'exit'), '0');
  assert.equal(header(log, 'cwd'), '.');
  assert.match(header(log, 'cmd'), /^node -e '.*all good.*'$/);
  assert.match(header(log, 'time'), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);
  assert.match(log, /\n\n[\s\S]*all good[\s\S]*warned/);
  const files = readdirSync(join(dir, '.plumb/cart/evidence'));
  assert.equal(files.length, 1);
  assert.match(files[0], /^\d{8}T\d{6}Z-unit\.log$/);
});

test('a failing command keeps its exit code and records it', () => {
  const { dir } = repo();
  const run = record(dir, ['cart', 'fail', '--', 'node', '-e', 'console.log("boom"); process.exit(3)']);
  assert.equal(run.status, 3);
  const log = savedLog(run);
  assert.equal(header(log, 'exit'), '3');
  assert.match(log, /boom/);
});

test('a dirty tree records a sha256 digest that changes when the tree changes', () => {
  const { dir } = repo();
  writeFileSync(join(dir, 'a.txt'), 'edited\n');
  const first = header(savedLog(record(dir, ['cart', 'one', '--', 'node', '-e', '0'])), 'diff');
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
  writeFileSync(join(dir, 'new.txt'), 'untracked\n');
  const second = header(savedLog(record(dir, ['cart', 'two', '--', 'node', '-e', '0'])), 'diff');
  assert.match(second, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(first, second);
});

test('--note saves stdin with no cmd or exit lines', () => {
  const { dir, g } = repo();
  const run = record(dir, ['cart', 'review-standards', '--note'], 'Standards: no findings\n');
  assert.equal(run.status, 0);
  const log = savedLog(run);
  assert.equal(header(log, 'cmd'), undefined);
  assert.equal(header(log, 'exit'), undefined);
  assert.equal(header(log, 'sha'), g('rev-parse', 'HEAD'));
  assert.match(log, /\n\nStandards: no findings\n$/);
});

test('.plumb/ lands in info/exclude exactly once and earlier logs never dirty the tree', () => {
  const { dir, g } = repo();
  record(dir, ['cart', 'one', '--', 'node', '-e', '0']);
  const second = savedLog(record(dir, ['cart', 'two', '--', 'node', '-e', '0']));
  assert.equal(header(second, 'diff'), 'clean');
  const exclude = readFileSync(join(dir, g('rev-parse', '--git-path', 'info/exclude')), 'utf8');
  assert.equal(exclude.split('\n').filter((line) => line === '.plumb/').length, 1);
});

test('a bad slug or name, or a missing command, exits 2 with a usage line', () => {
  const { dir } = repo();
  for (const args of [['a/b', 'x', '--', 'true'], ['..', 'x', '--', 'true'], ['cart', 'two words', '--', 'true'], ['cart', 'x', '--']]) {
    const run = record(dir, args);
    assert.equal(run.status, 2, `args ${JSON.stringify(args)}`);
    assert.match(run.stderr, /usage: record\.mjs/);
  }
  assert.throws(() => readdirSync(join(dir, '.plumb')));
});

test('--digest prints the same diff state a log records', () => {
  const { dir } = repo();
  assert.equal(record(dir, ['--digest']).stdout.trim(), 'clean');
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  const digest = record(dir, ['--digest']);
  assert.equal(digest.status, 0);
  assert.match(digest.stdout.trim(), /^sha256:[0-9a-f]{64}$/);
  assert.match(savedLog(record(dir, ['s', 'n', '--note'], 'x')), new RegExp(`^# diff: ${digest.stdout.trim()}$`, 'm'));
});

test('two records with the same name in the same second both survive', () => {
  const { dir } = repo();
  const paths = [1, 2].map(() => record(dir, ['s', 'same', '--note'], 'x').stderr.trim().split('\n').at(-1));
  assert.notEqual(paths[0], paths[1]);
  assert.equal(readdirSync(join(dir, '.plumb', 's', 'evidence')).length, 2);
});
