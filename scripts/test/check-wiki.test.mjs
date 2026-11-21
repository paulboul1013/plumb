import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { wikiProblems } from '../check-wiki.mjs';

const script = fileURLToPath(new URL('../check-wiki.mjs', import.meta.url));

const INDEX = '# Wiki\n\n## Subsystems\n\n- [Retro](retro.md): how retro turns mistakes into checks.\n- [Hooks](hooks.md): which hooks run on each host.\n';
const RETRO = '# Retro\n\n- 2026-11-21, as of `abc1234`: retro loads the failure log first. See [Hooks](hooks.md#stop).\n';
const HOOKS = '# Hooks\n\n- ~~2026-11-01, as of `def5678`: the stop gate runs on every reply.~~ superseded 2026-11-21\n- 2026-11-21, as of `abc1234`: the stop gate runs only on a final reply.\n';

function withWiki(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'wiki-'));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const clean = { 'index.md': INDEX, 'retro.md': RETRO, 'hooks.md': HOOKS };

test('a clean wiki has no problems', () => {
  withWiki(clean, (dir) => assert.deepEqual(wikiProblems(dir), []));
});

test('a page the index does not link is reported', () => {
  withWiki({ ...clean, 'orphan.md': '# Orphan\n' }, (dir) => {
    assert.deepEqual(wikiProblems(dir), ['orphan.md:1: not linked from index.md; add "- [Title](orphan.md): one-line summary." under a ## heading in index.md']);
  });
});

test('an index entry off the format, without a summary, or pointing at no page is reported', () => {
  const index = `${INDEX}- Loose note about retro\n- [Gone](gone.md): a page that does not exist.\n- [Hooks again](hooks.md):\n`;
  withWiki({ ...clean, 'index.md': index }, (dir) => {
    assert.deepEqual(wikiProblems(dir), [
      'index.md:7: index entry must be "- [Title](slug.md): one-line summary."',
      'index.md:8: index entry points at gone.md, which does not exist; create the page or remove the entry',
      'index.md:9: index entry must be "- [Title](slug.md): one-line summary."',
    ]);
  });
});

test('a relative page link that does not resolve is reported, while web links and anchors are not', () => {
  const retro = `${RETRO}- 2026-11-21: see [missing](missing.md#top), [docs](https://example.com/x.md), and [here](#retro).\n`;
  withWiki({ ...clean, 'retro.md': retro }, (dir) => {
    assert.deepEqual(wikiProblems(dir), ['retro.md:4: broken link missing.md; fix the path or create the page']);
  });
});

test('a present-tense word without a date or commit is reported outside fenced code only', () => {
  const retro = `${RETRO}- Retro currently reads the log.\n- 2026-11-21: retro now reads the log.\n- As of \`abc1234\`, at present it reads the log.\n- Known issues are listed in the tracker.\n\n\`\`\`\nnow is fine in a code block\n\`\`\`\n- At Present it skips the log.\n`;
  withWiki({ ...clean, 'retro.md': retro }, (dir) => {
    assert.deepEqual(wikiProblems(dir), [
      'retro.md:4: "currently" with no date or commit on the line; start the claim with its YYYY-MM-DD date and cite the commit',
      'retro.md:12: "at present" with no date or commit on the line; start the claim with its YYYY-MM-DD date and cite the commit',
    ]);
  });
});

const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('the CLI exits 0 on a clean wiki, 1 on a problem, and 2 with usage when the wiki is missing', () => {
  withWiki(clean, (dir) => {
    const ok = run([dir]);
    assert.equal(ok.status, 0);
    assert.equal(ok.stdout.trim(), `ok: ${dir}`);
  });
  withWiki({ ...clean, 'orphan.md': '# Orphan\n' }, (dir) => {
    const bad = run([dir]);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^orphan\.md:1: not linked from index\.md/);
  });
  assert.equal(run([]).status, 2);
  withWiki({ 'retro.md': RETRO }, (dir) => {
    const noIndex = run([dir]);
    assert.equal(noIndex.status, 2);
    assert.match(noIndex.stderr, /usage: check-wiki\.mjs <wiki-dir>/);
  });
});
