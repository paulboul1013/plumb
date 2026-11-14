import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageProblems, textProblems } from '../pr-publish.mjs';

const script = fileURLToPath(new URL('../pr-publish.mjs', import.meta.url));
const BODY = 'A body long enough to describe the change.\n';
const COMMENT = 'Thanks for the review.\n';

// A fake gh: logs each call and keeps the patched body, so the order of writes is observable.
function publish({ body = BODY, comment = COMMENT, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pr-publish-'));
  const log = join(dir, 'gh.log');
  writeFileSync(log, '');
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash
echo "$*" >> "${log}"
a="$*"
case "$a" in
  *"/commits"*) printf '%s\\n' "\${STUB_COMMITS:-fix: ok}" ;;
  *"-X PATCH"*)
    [ -n "$STUB_PATCH_FAIL" ] && { echo 'HTTP 500' >&2; exit 1; }
    f=\${a##*body=@}; f=\${f%% *}
    if [ -n "$STUB_MANGLE" ]; then echo mangled > "${log}.body"; else cp "$f" "${log}.body"; fi ;;
  *"/comments"*) echo https://example.test/comment ;;
  *) cat "${log}.body" ;;
esac
`);
  chmodSync(join(dir, 'gh'), 0o755);
  writeFileSync(join(dir, 'body.md'), body);
  writeFileSync(join(dir, 'comment.md'), comment);
  const result = spawnSync('node', [script, '--repo', 'o/r', '--pr', '1', '--body', join(dir, 'body.md'), '--comment', join(dir, 'comment.md')], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ...env },
  });
  const calls = readFileSync(log, 'utf8').trim().split('\n');
  return {
    status: result.status,
    stderr: result.stderr,
    patched: calls.some((call) => call.includes('-X PATCH')),
    commented: calls.some((call) => call.includes('/comments')),
    lastCall: calls.at(-1),
  };
}

test('a clean body is updated and read back before the comment is posted', () => {
  const run = publish();
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.patched);
  assert.match(run.lastCall, /issues\/1\/comments/);
});

for (const [name, options, expected] of [
  ['an unfilled placeholder', { body: 'See <EVIDENCE_SHA> for the images.\n' }, /<EVIDENCE_SHA>/],
  ['a body in Chinese', { body: '修復反向搜尋的按鍵處理。\n' }, /English/],
  ['an AI credit in the body', { body: `${BODY}\nGenerated with [Claude Code](https://claude.com)\n` }, /attribution/],
  ['an AI credit in the comment', { comment: 'Co-Authored-By: Claude\n' }, /attribution/],
  ['an AI credit in a pushed commit', { env: { STUB_COMMITS: 'fix: x\nCo-Authored-By: Claude' } }, /pushed commit/],
]) {
  test(`${name} stops before any write`, () => {
    const run = publish(options);
    assert.equal(run.status, 1);
    assert.match(run.stderr, expected);
    assert.equal(run.patched, false);
    assert.equal(run.commented, false);
  });
}

test('a failed body update does not post the comment', () => {
  const run = publish({ env: { STUB_PATCH_FAIL: '1' } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /updating the body failed/);
  assert.equal(run.commented, false);
});

test('a body that differs after the update does not post the comment', () => {
  const run = publish({ env: { STUB_MANGLE: '1' } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /differs/);
  assert.equal(run.commented, false);
});

test('an image that does not resolve is reported and one that does is not', async () => {
  const server = createServer((req, res) => { res.statusCode = req.url === '/ok.png' ? 200 : 404; res.end(); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await imageProblems(`![ok](${base}/ok.png)`), []);
    const [problem] = await imageProblems(`![gone](${base}/gone.png)`);
    assert.match(problem, /returned 404.*git add -f/);
  } finally {
    server.close();
  }
});

test('plain text with no placeholder, Han, or credit has no problems', () => {
  assert.deepEqual(textProblems('body', 'Use `Vec<T>` and <details> as usual.\n'), []);
});

