import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkTickets } from '../check-tickets.mjs';
import { checkPlugin } from '../check-plugin.mjs';
import { reviewDiff } from '../review-diff.mjs';
import { worktreeHolds } from '../worktree-check.mjs';
import { execFileSync } from 'node:child_process';

const root = new URL('../..', import.meta.url).pathname;

function ticket(num, { blockedBy = 'None', status = 'ready', acceptance = '- [ ] user sees the total', proof = 'npm test -- cart' } = {}) {
  return `# ${num}: Ticket ${num}\n\n**Blocked by:** ${blockedBy}\n**Status:** ${status}\n\n## Build\n\nA slice.\n\n## Acceptance\n\n${acceptance}\n\n## Proof\n\n${proof}\n`;
}

function ticketDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'tickets-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

test('a valid graph passes and the frontier holds only tickets whose blockers are done', () => {
  const dir = ticketDir({
    '01-schema.md': ticket('01', { status: 'done' }),
    '02-api.md': ticket('02', { blockedBy: '01' }),
    '03-ui.md': ticket('03', { blockedBy: '01, 02' }),
    '04-docs.md': ticket('04'),
  });
  const { errors, frontier } = checkTickets(dir);
  assert.deepEqual(errors, []);
  assert.deepEqual(frontier.map((t) => t.file), ['02-api.md', '04-docs.md']);
});

test('an Acceptance or Proof that only appears in a fenced example does not count', () => {
  const example = '```markdown\n## Acceptance\n\n- [ ] user sees the total\n\n## Proof\n\nnpm test -- cart\n```';
  const body = `# 01: Cart total\n\n**Blocked by:** None\n**Status:** ready\n\n## Build\n\nShow the total. Tickets here look like:\n\n${example}\n\n## Acceptance\n\n## Proof\n`;
  assert.deepEqual(checkTickets(ticketDir({ '01-cart.md': body })).errors, [
    '01-cart.md: "## Acceptance" needs at least one "- [ ] <behavior>" item',
    '01-cart.md: "## Proof" is empty: name the command, scenario, or screenshot that shows it working',
  ]);
});

test('a Proof command written in a fenced block still counts', () => {
  const dir = ticketDir({ '01-cart.md': ticket('01', { proof: '```bash\nnpm test -- cart\n```' }) });
  assert.deepEqual(checkTickets(dir).errors, []);
});

test('a blocker with a higher number is rejected, which rules out cycles', () => {
  const dir = ticketDir({ '01-a.md': ticket('01', { blockedBy: '02' }), '02-b.md': ticket('02', { blockedBy: '01' }) });
  assert.deepEqual(checkTickets(dir).errors, ['01-a.md: blocker 2 must have a lower number than 1: number tickets blockers-first']);
});

test('a missing blocker, missing proof, and empty acceptance are each reported', () => {
  const dir = ticketDir({ '01-a.md': ticket('01', { proof: '', acceptance: 'nothing checkable' }), '02-b.md': ticket('02', { blockedBy: '07' }) });
  const { errors } = checkTickets(dir);
  assert.ok(errors.includes('02-b.md: blocker 7 does not exist'));
  assert.ok(errors.some((e) => e.startsWith('01-a.md: "## Proof" is empty')));
  assert.ok(errors.some((e) => e.startsWith('01-a.md: "## Acceptance" needs')));
});

test('a ticket in progress while its blocker is not done is reported', () => {
  const dir = ticketDir({ '01-a.md': ticket('01'), '02-b.md': ticket('02', { blockedBy: '01', status: 'in-progress' }) });
  assert.deepEqual(checkTickets(dir).errors, ['02-b.md: status is in-progress but blocker 1 is ready']);
});

test('the shipped plugin passes its own checks', () => {
  assert.deepEqual(checkPlugin(root), []);
});

function pluginCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-'));
  for (const p of ['skills', 'agents', 'hooks', '.claude-plugin', 'README.md']) cpSync(join(root, p), join(dir, p), { recursive: true });
  return dir;
}

test('the plugin check catches a long dash, a bare user-invoked reference, and an unlisted skill', () => {
  const dir = pluginCopy();
  const tdd = join(dir, 'skills/tdd/SKILL.md');
  writeFileSync(tdd, readFileSync(tdd, 'utf8') + '\nRed first — always.\nThen run `retro`.\n');
  mkdirSync(join(dir, 'skills/ghost'));
  writeFileSync(join(dir, 'skills/ghost/SKILL.md'), '---\nname: ghost\ndescription: x\n---\n');
  const errors = checkPlugin(dir);
  assert.ok(errors.some((e) => e.startsWith('skills/tdd/SKILL.md:') && e.includes('long dash')));
  assert.ok(errors.some((e) => e.includes('`retro` is user-invoked')));
  assert.ok(errors.includes(`skills/plumb/SKILL.md: router's Skills list does not mention "ghost"`));
});

test('the plugin check catches a hard-coded GLOSSARY.md and a commits-only review diff', () => {
  const dir = pluginCopy();
  const builder = join(dir, 'agents/plumb-builder.md');
  // The line the glossary fix missed in agents/plumb-builder.md.
  writeFileSync(builder, readFileSync(builder, 'utf8') + '\nRead the ticket, the design sketch, `GLOSSARY.md`, and `docs/agents/plumb.md`.\n');
  const review = join(dir, 'skills/review/SKILL.md');
  // The review step that handed reviewers an empty diff for uncommitted work.
  writeFileSync(review, readFileSync(review, 'utf8') + '\nConfirm that `git diff <ref>...HEAD` is not empty.\n');
  const errors = checkPlugin(dir);
  assert.ok(errors.some((e) => e.startsWith('agents/plumb-builder.md:') && e.includes('hard-coded GLOSSARY.md')));
  assert.ok(errors.some((e) => e.startsWith('skills/review/SKILL.md:') && e.includes('review-diff.mjs')));
});

test('the plugin check reads a link destination written in angle brackets as the path inside them', () => {
  const dir = pluginCopy();
  const tdd = join(dir, 'skills/tdd/SKILL.md');
  mkdirSync(join(dir, 'skills/tdd/my notes'));
  writeFileSync(join(dir, 'skills/tdd/my notes/seams.md'), '# Seams\n');
  writeFileSync(tdd, readFileSync(tdd, 'utf8') + '\nSee [the bug lane](<../plumb/lanes/bug.md>), [the seams](<my notes/seams.md#top>), and [old notes](<old notes/gone.md>).\n');
  const links = checkPlugin(dir).filter((e) => e.startsWith('skills/tdd/') && e.includes('broken link'));
  assert.deepEqual(links, ['skills/tdd/SKILL.md: broken link old notes/gone.md']);
});

function repoWithUncommittedWork() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'));
  const g = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'kept.txt'), 'base\n');
  g('add', '.'); g('commit', '-q', '-m', 'base');
  g('checkout', '-q', '-b', 'feature');
  writeFileSync(join(dir, 'kept.txt'), 'base\nedited, not committed\n');
  writeFileSync(join(dir, 'new.txt'), 'brand new file\n');
  return { dir, g };
}

test('review-diff includes uncommitted edits and untracked files that ...HEAD misses', () => {
  const { dir, g } = repoWithUncommittedWork();
  assert.equal(g('diff', 'main...HEAD'), '');
  const diff = reviewDiff('main', { cwd: dir });
  assert.match(diff, /\+edited, not committed/);
  assert.match(diff, /\+brand new file/);
  assert.deepEqual(reviewDiff('main', { cwd: dir, filesOnly: true }).trim().split('\n').sort(), ['kept.txt', 'new.txt']);
});

test('review-diff fails on a bad ref and on an empty change', () => {
  const { dir, g } = repoWithUncommittedWork();
  assert.throws(() => reviewDiff('no-such-ref', { cwd: dir }), /is not a commit/);
  g('checkout', '-q', '--', 'kept.txt');
  execFileSync('rm', [join(dir, 'new.txt')]);
  assert.throws(() => reviewDiff('main', { cwd: dir }), /nothing to review/);
});

function repoWithWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-'));
  const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  g(repo, 'init', '-q');
  g(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'base');
  writeFileSync(join(repo, '.gitignore'), '.env\nnode_modules/\n');
  g(repo, 'add', '.gitignore');
  g(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'ignore');
  const wt = join(dir, 'wt');
  g(repo, 'worktree', 'add', '-q', wt, '-b', 'builder');
  return { wt, g };
}

test('a worktree with nothing of its own has no holds', () => {
  const { wt } = repoWithWorktree();
  mkdirSync(join(wt, 'node_modules'));
  writeFileSync(join(wt, 'node_modules', 'x.js'), '');
  assert.deepEqual(worktreeHolds(wt), []);
});

test('an ignored file outside build and cache directories holds the worktree', () => {
  const { wt } = repoWithWorktree();
  writeFileSync(join(wt, '.env'), 'SECRET=1\n');
  assert.deepEqual(worktreeHolds(wt), ['ignored file that may exist nowhere else: .env']);
});

test('uncommitted work holds the worktree', () => {
  const { wt } = repoWithWorktree();
  writeFileSync(join(wt, 'new.txt'), 'x');
  assert.deepEqual(worktreeHolds(wt), ['uncommitted change: ?? new.txt']);
});

test('a commit only the worktree HEAD reflog reaches holds the worktree', () => {
  const { wt, g } = repoWithWorktree();
  g(wt, 'switch', '-q', '--detach');
  g(wt, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'orphan');
  const orphan = g(wt, 'rev-parse', 'HEAD');
  g(wt, 'switch', '-q', 'builder');
  assert.deepEqual(worktreeHolds(wt), [`commit only this worktree's HEAD reflog reaches: ${orphan}`]);
});
