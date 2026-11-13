import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../check-tickets.mjs', import.meta.url).pathname;
const SPEC = 10;

function body({ acceptance = '- [ ] user sees the total', proof = 'npm test -- cart' } = {}) {
  return `## Build\n\nA slice.\n\n## Acceptance\n\n${acceptance}\n\n## Proof\n\n${proof}\n`;
}

function issue(number, { state = 'open', stateReason = null, assignees = [], blockedBy = [], labels = [], ...sections } = {}) {
  return { number, title: `Ticket ${number}`, body: body(sections), state, state_reason: stateReason, assignees, labels, blockedBy };
}

function decision(number, { type = 'align', question = 'Which store holds the cart?', ...rest } = {}) {
  return { ...issue(number, { labels: [`plumb:${type}`], ...rest }), body: `## Question\n\n${question}\n` };
}

function mapBody({ destination = 'A spec for the cart rewrite.', decided = '', outOfScope = '' } = {}) {
  return `## Destination\n\n${destination}\n\n## Notes\n\n## Decisions so far\n\n${decided}\n\n## Not yet specified\n\n## Out of scope\n\n${outOfScope}\n`;
}

const SPEC_PARENT = { body: 'The spec.', labels: [] };

// A fake gh that answers the three REST reads from fixtures and logs every call.
function run(issues, args = [], env = {}, parent = SPEC_PARENT) {
  const dir = mkdtempSync(join(tmpdir(), 'check-tickets-gh-'));
  const log = join(dir, 'gh.log');
  writeFileSync(log, '');
  writeFileSync(join(dir, 'subs.jsonl'), issues.map(({ blockedBy, ...i }) => JSON.stringify(i)).join('\n') + '\n');
  writeFileSync(join(dir, 'parent.json'), JSON.stringify(parent) + '\n');
  for (const i of issues) writeFileSync(join(dir, `blocked-${i.number}.txt`), i.blockedBy.map((n) => `${n}\n`).join(''));
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash
echo "$*" >> "${log}"
[ -n "$STUB_FAIL" ] && { echo 'HTTP 404: Not Found' >&2; exit 1; }
case "$*" in
  *"issues/${SPEC}/sub_issues"*) cat "${dir}/subs.jsonl" ;;
  *"repos/o/r/issues/${SPEC} "*) cat "${dir}/parent.json" ;;
  *"/dependencies/blocked_by"*) n="$*"; n=\${n#*issues/}; n=\${n%%/*}; cat "${dir}/blocked-$n.txt" 2>/dev/null ;;
  *) echo "unexpected: $*" >&2; exit 1 ;;
esac
`);
  chmodSync(join(dir, 'gh'), 0o755);
  const result = spawnSync('node', [script, '--github', 'o/r', String(SPEC), ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ...env },
  });
  return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n') };
}

test('a valid graph passes and the frontier excludes assigned and blocked tickets', () => {
  const issues = [
    issue(11, { state: 'closed' }),
    issue(12, { blockedBy: [11] }),
    issue(13, { blockedBy: [11, 12] }),
    issue(14, { assignees: ['someone'] }),
    issue(15),
  ];
  const check = run(issues);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.equal(check.stdout, 'ok: 5 tickets, 2 ready now\n');
  assert.ok(check.calls.every((c) => c.includes('--paginate')), check.calls.join('\n'));

  const frontier = run(issues, ['--frontier']);
  assert.equal(frontier.status, 0, frontier.stderr);
  assert.equal(frontier.stdout, '#12 Ticket 12\n#15 Ticket 15\n');
});

test('a missing Proof and an empty Acceptance are reported', () => {
  const check = run([issue(11, { proof: '', acceptance: 'nothing checkable' })]);
  assert.equal(check.status, 1);
  assert.match(check.stdout, /^#11 Ticket 11: "## Acceptance" needs/m);
  assert.match(check.stdout, /^#11 Ticket 11: "## Proof" is empty/m);
});

test('a blocker that is not a sub-issue of the spec issue is reported', () => {
  const check = run([issue(11, { blockedBy: [3] })]);
  assert.equal(check.status, 1);
  assert.equal(check.stdout, `#11 Ticket 11: blocker #3 is not a sub-issue of #${SPEC}\n`);
});

test('a closed ticket with an open blocker is reported', () => {
  const check = run([issue(11), issue(12, { state: 'closed', blockedBy: [11] })]);
  assert.equal(check.status, 1);
  assert.equal(check.stdout, '#12 Ticket 12: status is done but blocker #11 is ready\n');
});

test('a blocker with a higher number is reported', () => {
  const check = run([issue(11, { blockedBy: [12] }), issue(12)]);
  assert.equal(check.status, 1);
  assert.equal(check.stdout, '#11 Ticket 11: blocker #12 must have a lower number than #11: number tickets blockers-first\n');
});

test('a gh failure prints its stderr and exits 2', () => {
  const check = run([issue(11)], [], { STUB_FAIL: '1' });
  assert.equal(check.status, 2);
  assert.match(check.stderr, /HTTP 404: Not Found/);
});

test('a decision ticket needs a Question and exactly one known plumb type label', () => {
  const check = run([
    decision(11, { question: '' }),
    { ...decision(12), labels: ['plumb:research', 'plumb:align'] },
    { ...decision(13), labels: ['plumb:grilling', 'bug'] },
  ]);
  assert.equal(check.status, 1);
  assert.equal(check.stdout, [
    '#11 Ticket 11: "## Question" is empty: state the decision this ticket resolves',
    '#12 Ticket 12: more than one plumb type label: plumb:research, plumb:align',
    '#13 Ticket 13: label "plumb:grilling" is not one of plumb:research, plumb:prototype, plumb:align, plumb:task',
    '',
  ].join('\n'));
});

test('a valid map passes and a ticket closed as not planned unblocks like a done one', () => {
  const issues = [
    decision(11, { type: 'research', state: 'closed', stateReason: 'completed' }),
    decision(12, { type: 'prototype', state: 'closed', stateReason: 'not_planned' }),
    decision(13, { blockedBy: [11, 12] }),
    decision(14, { type: 'task', blockedBy: [12], assignees: ['someone'] }),
  ];
  const map = { body: mapBody({ decided: '- [Store choice](https://github.com/o/r/issues/11) (#11): Postgres.', outOfScope: '- Mobile (#12): a later effort.' }), labels: ['plumb:map'] };
  const check = run(issues, [], {}, map);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.equal(check.stdout, 'ok: 4 tickets, 1 ready now\n');
  assert.ok(check.calls.some((c) => c.startsWith(`api --paginate repos/o/r/issues/${SPEC} `)), check.calls.join('\n'));
  assert.equal(run(issues, ['--frontier'], {}, map).stdout, '#13 Ticket 13\n');
});

test('a map needs a Destination and a pointer to every closed decision ticket', () => {
  const issues = [
    decision(11, { state: 'closed', stateReason: 'completed' }),
    decision(12, { state: 'closed', stateReason: 'not_planned' }),
  ];
  const map = { body: mapBody({ destination: '', decided: '- Something (#111): unrelated.', outOfScope: '- Decided (#11)' }), labels: ['plumb:map'] };
  const check = run(issues, [], {}, map);
  assert.equal(check.status, 1);
  assert.equal(check.stdout, [
    `#${SPEC}: "## Destination" is empty: say what reaching the end of this map looks like`,
    `#${SPEC}: "## Decisions so far" does not mention done ticket #11: append a pointer to it`,
    `#${SPEC}: "## Out of scope" does not mention out-of-scope ticket #12: add one line for it`,
    '',
  ].join('\n'));
});

test('a spec parent skips the map checks and a build ticket closed as not planned is still done', () => {
  const check = run([issue(11, { state: 'closed', stateReason: 'not_planned' }), issue(12, { blockedBy: [11] })]);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.equal(check.stdout, 'ok: 2 tickets, 1 ready now\n');
});
