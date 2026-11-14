import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../review-log.mjs', import.meta.url));

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'review-log-'));
  const dir = join(base, 'repo');
  mkdirSync(dir);
  const g = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  g('remote', 'add', 'origin', 'git@example.com:me/repo.git');
  writeFileSync(join(dir, 'a.txt'), 'base\n');
  g('add', '.');
  g('commit', '-q', '-m', 'base');
  return { dir, g, log: join(base, 'logs', 'review-findings.jsonl') };
}

function cli(env, args, session = 'sess-1') {
  return spawnSync('node', [script, ...args], {
    cwd: env.dir,
    encoding: 'utf8',
    env: { ...process.env, PLUMB_REVIEW_LOG: env.log, CLAUDE_CODE_SESSION_ID: session },
  });
}

function add(env, axis, outcome, change, session) {
  const run = cli(env, ['add', '--axis', axis, '--outcome', outcome, '--change', change, '--summary', `${axis} ${outcome}`], session);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

function statsJson(env, args = []) {
  const run = cli(env, ['stats', '--json', ...args]);
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test('add records the finding with repo, sha, and session, and prints its id', () => {
  const env = setup();
  const id = add(env, 'Standards', 'trivial', 'code', 'sess-1');
  assert.match(id, /^\d{8}T\d{6}Z-[0-9a-f]{4}$/);
  const [line] = readFileSync(env.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(line.type, 'finding');
  assert.equal(line.id, id);
  assert.equal(line.repo, 'git@example.com:me/repo.git');
  assert.equal(line.sha, env.g('rev-parse', 'HEAD'));
  assert.equal(line.session, 'sess-1');
  assert.equal(line.axis, 'Standards');
  assert.equal(line.outcome, 'trivial');
  assert.equal(line.change, 'code');
  assert.equal(line.summary, 'Standards trivial');
  assert.ok(!Number.isNaN(Date.parse(line.time)));
});

test('stats counts outcomes per axis and change, and reviews as distinct session and sha pairs', () => {
  const env = setup();
  add(env, 'Standards', 'trivial', 'code', 'sess-1');
  add(env, 'Standards', 'trivial', 'code', 'sess-1');
  add(env, 'Standards', 'useful', 'code', 'sess-2');
  add(env, 'Standards', 'wrong', 'prose', 'sess-2');
  add(env, 'Spec', 'useful', 'prose', 'sess-1');
  const run = cli(env, ['stats']);
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.trim().split('\n');
  assert.ok(lines.includes('Standards code: useful 1, trivial 2, wrong 0 (reviews: 2)'), run.stdout);
  assert.ok(lines.includes('Standards prose: useful 0, trivial 0, wrong 1 (reviews: 1)'), run.stdout);
  assert.ok(lines.includes('Spec prose: useful 1, trivial 0, wrong 0 (reviews: 1)'), run.stdout);
  assert.ok(!run.stdout.includes('Spec code'), run.stdout);
  const json = statsJson(env);
  const standards = json.find((a) => a.axis === 'Standards');
  assert.equal(standards.reviews, 2);
  assert.deepEqual(standards.code, { useful: 1, trivial: 2, wrong: 0, reviews: 2 });
  assert.deepEqual(standards.prose, { useful: 0, trivial: 0, wrong: 1, reviews: 1 });
});

test('a new commit in the same session counts as another review', () => {
  const env = setup();
  add(env, 'Proof', 'useful', 'code', 'sess-1');
  writeFileSync(join(env.dir, 'b.txt'), 'b\n');
  env.g('add', '.');
  env.g('commit', '-q', '-m', 'next');
  add(env, 'Proof', 'useful', 'code', 'sess-1');
  assert.equal(statsJson(env).find((a) => a.axis === 'Proof').reviews, 2);
});

test('a bad axis, outcome, change, or missing summary exits 2 with usage and writes nothing', () => {
  const env = setup();
  const good = { axis: 'Spec', outcome: 'useful', change: 'code', summary: 's' };
  const cases = [{ axis: 'Style' }, { outcome: 'meh' }, { change: 'docs' }, { summary: '' }];
  for (const bad of cases) {
    const flags = { ...good, ...bad };
    const run = cli(env, ['add', ...Object.entries(flags).flatMap(([k, v]) => [`--${k}`, v])]);
    assert.equal(run.status, 2, JSON.stringify(bad));
    assert.match(run.stderr, /usage: review-log\.mjs/);
  }
  assert.equal(existsSync(env.log), false);
});

test('--since drops older findings', () => {
  const env = setup();
  add(env, 'Adversarial', 'wrong', 'code');
  assert.deepEqual(statsJson(env, ['--since', '2999-01-01']), []);
  assert.equal(statsJson(env, ['--since', '2000-01-01']).length, 1);
  assert.equal(cli(env, ['stats', '--since', 'yesterday']).status, 2);
});

test('an empty log says so, and a malformed line is skipped with a warning', () => {
  const env = setup();
  const empty = cli(env, ['stats']);
  assert.equal(empty.status, 0);
  assert.equal(empty.stdout.trim(), 'no review findings logged');
  add(env, 'Spec', 'useful', 'code');
  appendFileSync(env.log, 'not json\n');
  add(env, 'Spec', 'trivial', 'code');
  const run = cli(env, ['stats']);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Spec code: useful 1, trivial 1, wrong 0 \(reviews: 1\)/);
  assert.match(run.stderr, /warning: .*line 2/);
});
