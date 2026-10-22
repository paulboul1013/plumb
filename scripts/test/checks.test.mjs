import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkTickets } from '../check-tickets.mjs';
import { checkPlugin } from '../check-plugin.mjs';

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
