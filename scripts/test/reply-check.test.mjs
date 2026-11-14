import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classification, laneEvidence, laneSteps, problems, replyText, stepStatuses, taskEntries, toolUses } from '../../hooks/reply-check.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const hook = join(root, 'hooks/reply-check.mjs');
const steps = laneSteps(root);
const evidence = laneEvidence(root);

const user = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const toolResult = () => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } });
const say = (text) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const spawn = (subagent_type) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Agent', input: { subagent_type, prompt: 'x' } }] } });

const featureReply = (rigor, lines) => `lane: Feature · rigor: ${rigor} (M, two-way) · design door: yes · action door: none · why: x\n\nDone.\n\n${lines.join('\n')}`;
const allFeature = (overrides = {}) => steps.Feature.map((s) => overrides[s] ?? `- [x] ${s}`);

const check = (entries) => {
  const c = classification(entries);
  if (!c) return [];
  const s = steps[c.lane] ?? [];
  return problems({ text: replyText(entries), lane: c.lane, rigor: c.rigor, steps: s, evidence: evidence[c.lane], toolUses: toolUses(taskEntries(entries, s)) });
};

test('laneSteps reads every lane file, with multi-word steps', () => {
  for (const lane of ['Bug', 'Epic', 'Feature', 'Investigate', 'Prototype', 'Refactor']) {
    assert.ok(steps[lane]?.length > 0, lane);
  }
  assert.ok(steps.Feature.includes('Plan the throughput'));
  assert.ok(steps.Bug.includes('Fix at the root'));
  assert.ok(steps.Bug.includes('Re-classify'));
});

test('Build marked done at Strict with no builder spawn is a problem', () => {
  const entries = [user('add the hook'), say(featureReply('Strict', allFeature()))];
  const found = check(entries);
  assert.ok(found.some((p) => /Build/.test(p) && /plumb-builder/.test(p) && /adjusted:/.test(p)), found.join('\n'));
});

test('Build done with a builder spawn, or marked adjusted, passes', () => {
  const withBuilder = [user('go'), spawn('plumb:plumb-builder'), toolResult(), spawn('plumb:plumb-reviewer'), toolResult(), say(featureReply('Strict', allFeature()))];
  assert.deepEqual(check(withBuilder), []);
  const adjusted = [user('go'), spawn('plumb:plumb-reviewer'), toolResult(),
    say(featureReply('Strict', allFeature({ Build: '- [x] Build — adjusted: parent wrote it, prose only' })))];
  assert.deepEqual(check(adjusted), []);
});

test('Review done needs a reviewer spawn at Standard, not at Light', () => {
  const standard = [user('go'), spawn('plumb:plumb-builder'), toolResult(), say(featureReply('Standard', allFeature()))];
  const found = check(standard);
  assert.equal(found.length, 1, found.join('\n'));
  assert.match(found[0], /Review.*plumb-reviewer/);
  const light = [user('go'), say(featureReply('Light', allFeature()))];
  assert.deepEqual(check(light), []);
});

test('a missing step and an open step without a reason are reported; a full-width skip passes', () => {
  const lines = allFeature({ Deliver: '- [ ] Deliver' }).filter((l) => !/Plan the throughput/.test(l));
  const found = check([user('go'), say(featureReply('Light', lines))]);
  assert.ok(found.some((p) => /Plan the throughput/.test(p) && /missing/.test(p)), found.join('\n'));
  assert.ok(found.some((p) => /Deliver/.test(p) && /open/.test(p)), found.join('\n'));
  assert.equal(found.length, 2);
  const skipped = allFeature({ Deliver: '- [ ] Deliver：skip，使用者還沒要求 commit' });
  assert.deepEqual(check([user('go'), say(featureReply('Light', skipped))]), []);
});

test('an adjusted or skipped step with an empty reason is reported', () => {
  const lines = allFeature({ Deliver: '- [ ] Deliver: skip:', Prove: '- [x] **Prove** adjusted:' });
  const found = check([user('go'), say(featureReply('Light', lines))]);
  assert.equal(found.length, 2, found.join('\n'));
});

test('stepStatuses reads markers and reasons', () => {
  const s = stepStatuses('- [X] **Ground**: read it\n- [ ] Align, skip: no questions\n- [x] Design — adjusted: one sketch, Light', ['Ground', 'Align', 'Design', 'Build']);
  assert.deepEqual(s, {
    Ground: { status: 'done', reason: '' },
    Align: { status: 'skip', reason: 'no questions' },
    Design: { status: 'adjusted', reason: 'one sketch, Light' },
    Build: { status: 'missing', reason: '' },
  });
  assert.equal(stepStatuses('- [x] Builder ran', ['Build']).Build.status, 'missing');
});

test('laneEvidence reads the builder and reviewer steps from the lane text', () => {
  assert.deepEqual(evidence.Feature, { Build: 'plumb-builder', Review: 'plumb-reviewer' });
  assert.deepEqual(evidence.Bug, { Review: 'plumb-reviewer' });
  assert.deepEqual(evidence.Refactor, { 'Review and deliver': 'plumb-reviewer' });
  assert.deepEqual(evidence.Epic, { 'Review the whole': 'plumb-reviewer' });
});

test('a Refactor at Strict that reports Review and deliver done with no reviewer is a problem', () => {
  const lines = steps.Refactor.map((s) => `- [x] ${s}`).join('\n');
  const found = check([user('go'), say(`lane: Refactor · rigor: Strict · why: x\n\n${lines}`)]);
  assert.equal(found.length, 1, found.join('\n'));
  assert.match(found[0], /Review and deliver.*plumb-reviewer/);
});

test('subagents spawned for an earlier task in the session do not back this one', () => {
  const entries = [
    user('task 1'), spawn('plumb:plumb-builder'), toolResult(), spawn('plumb:plumb-reviewer'), toolResult(),
    say(featureReply('Strict', allFeature())),
    user('task 2'), say(featureReply('Strict', allFeature())),
  ];
  const found = check(entries);
  assert.ok(found.some((p) => /Build/.test(p)) && found.some((p) => /Review/.test(p)), found.join('\n'));
  const sameTask = [user('task 1'), spawn('plumb:plumb-builder'), toolResult(), user('a hand-back'), spawn('plumb:plumb-reviewer'), toolResult(),
    say(featureReply('Strict', allFeature()))];
  assert.deepEqual(check(sameTask), []);
  // A stop the finish gate blocked, then the same reply rewritten: the spawns before the block still count.
  const feedback = { type: 'user', isMeta: true, message: { role: 'user', content: 'Stop hook feedback:\nplumb finish gate' } };
  const rewritten = [user('task 1'), spawn('plumb:plumb-builder'), toolResult(), spawn('plumb:plumb-reviewer'), toolResult(),
    say(featureReply('Strict', allFeature())), feedback, say(featureReply('Strict', allFeature()))];
  assert.deepEqual(check(rewritten), []);
});

test('a reply with no walked list, a Direct lane, or no classification passes', () => {
  assert.deepEqual(check([user('go'), say('lane: Feature · rigor: Strict (L) · why: x\n\nQuestion 1: which shape?')]), []);
  assert.deepEqual(check([user('go'), say('lane: Direct · rigor: Light\n\n- [x] Build\n- [x] Review')]), []);
  assert.deepEqual(check([user('go'), say('- [x] Build\n- [x] Review')]), []);
});

test('only the reply after the last real user turn counts, and sidechains are ignored', () => {
  const entries = [
    user('first'), say(featureReply('Strict', allFeature())),
    user('thanks'), toolResult(), say('lane: Feature · rigor: Strict · why: x\n\nAnswer without a list.'),
    { ...spawn('plumb:plumb-builder'), isSidechain: true },
  ];
  assert.match(replyText(entries), /Answer without a list/);
  assert.doesNotMatch(replyText(entries), /\[x\]/);
  assert.equal(toolUses(entries).length, 0);
  assert.deepEqual(classification(entries), { lane: 'Feature', rigor: 'Strict' });
});

test('CLI blocks once per state, still checks after stop_hook_active, and passes on an unreadable transcript', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reply-check-'));
  const session = `test-${process.pid}-${Date.now()}`;
  try {
    const path = join(dir, 't.jsonl');
    writeFileSync(path, [user('go'), say(featureReply('Strict', allFeature()))].map((e) => JSON.stringify(e)).join('\n') + '\n');
    const run = (input, env = {}) => execFileSync('node', [hook], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, PLUMB_HOOK: '', ...env } });
    const first = run({ transcript_path: path, session_id: session });
    const out = JSON.parse(first);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /^plumb reply check: .*Build/);
    assert.equal(run({ transcript_path: path, session_id: session }), '');
    assert.equal(JSON.parse(run({ transcript_path: path, session_id: `${session}-b`, stop_hook_active: true })).decision, 'block');
    assert.equal(run({ transcript_path: path, session_id: `${session}-c` }, { PLUMB_HOOK: 'off' }), '');
    assert.equal(run({ transcript_path: join(dir, 'nope.jsonl'), session_id: `${session}-d` }), '');
    writeFileSync(join(dir, 'bad.jsonl'), '{not json\n');
    assert.equal(run({ transcript_path: join(dir, 'bad.jsonl'), session_id: `${session}-e` }), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const s of ['', '-b', '-c', '-d', '-e']) rmSync(join(tmpdir(), `plumb-reply-check-${session}${s}`), { force: true });
  }
});
