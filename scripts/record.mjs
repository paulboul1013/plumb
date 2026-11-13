#!/usr/bin/env node
// Saves a proof command's output, or a note from stdin, under .plumb/<slug>/evidence/ with the commit and
// diff digest it ran against, so the evidence outlives a cleared temp dir and a reviewer can match it to HEAD.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { constants } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { reviewDiff } from './review-diff.mjs';

const USAGE = 'usage: record.mjs <slug> <name> -- <command> [args...]\n       record.mjs <slug> <name> --note   (text on stdin)';

function usage(message) {
  console.error(`error: ${message}\n${USAGE}`);
  process.exit(2);
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function excludePlumb(root) {
  const file = resolve(root, git(['rev-parse', '--git-path', 'info/exclude'], root));
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (text.split('\n').includes('.plumb/')) return;
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}.plumb/\n`);
}

function diffState(root) {
  try {
    return `sha256:${createHash('sha256').update(reviewDiff('HEAD', { cwd: root })).digest('hex')}`;
  } catch (error) {
    if (/nothing to review/.test(error.message)) return 'clean';
    throw error;
  }
}

function shellQuote(arg) {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`;
}

function run(argv, cwd) {
  return new Promise((done, fail) => {
    const chunks = [];
    const child = spawn(argv[0], argv.slice(1), { cwd, stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { chunks.push(chunk); process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { chunks.push(chunk); process.stderr.write(chunk); });
    child.on('error', fail);
    child.on('close', (code, signal) => done({ code: code ?? 128 + constants.signals[signal], output: Buffer.concat(chunks) }));
  });
}

const [slug, name, mode, ...command] = process.argv.slice(2);
for (const [label, value] of [['slug', slug], ['name', name]]) {
  if (!value || /[/\s]|\.\./.test(value)) usage(`bad ${label} "${value ?? ''}": no "/", "..", or spaces`);
}
if (mode !== '--' && mode !== '--note') usage('expected "--" before the command, or --note');
if (mode === '--' && !command.length) usage('missing command after "--"');

const root = git(['rev-parse', '--show-toplevel'], process.cwd());
excludePlumb(root);
const sha = git(['rev-parse', 'HEAD'], root);
const diff = diffState(root);
const now = new Date();

let body;
let exit = 0;
const head = [];
if (mode === '--note') {
  body = readFileSync(0);
} else {
  const result = await run(command, root).catch((error) => {
    console.error(`error: cannot run ${command[0]}: ${error.message}`);
    process.exit(127);
  });
  body = result.output;
  exit = result.code;
  head.push(`# cmd: ${command.map(shellQuote).join(' ')}`);
}
head.push('# cwd: .', `# sha: ${sha}`, `# diff: ${diff}`);
if (mode === '--') head.push(`# exit: ${exit}`);
head.push(`# time: ${now.toISOString()}`);

const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const dir = join(root, '.plumb', slug, 'evidence');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${stamp}-${name}.log`);
writeFileSync(file, Buffer.concat([Buffer.from(`${head.join('\n')}\n\n`), body]));
console.error(`recorded: ${file}`);
process.exit(exit);
