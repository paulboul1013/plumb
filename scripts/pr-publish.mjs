#!/usr/bin/env node
// Update a PR body, read it back, and only then post the comment that refers to it.
// Usage: pr-publish.mjs --repo owner/name --pr N --body file [--comment file]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isMain } from './entry.mjs';

const ATTRIBUTION = /Co-Authored-By:.*|Generated with \[?Claude.*/i;

export function textProblems(name, text) {
  const problems = [];
  const placeholder = text.match(/<[A-Z][A-Z_]+>/);
  if (placeholder) problems.push(`${name}: fill in the placeholder ${placeholder[0]}`);
  const han = text.match(/\p{Script=Han}+/u);
  if (han) problems.push(`${name}: publish the English text, found "${han[0]}"`);
  const credit = text.match(ATTRIBUTION);
  if (credit) problems.push(`${name}: remove the attribution line "${credit[0]}"`);
  return problems;
}

export async function imageProblems(text) {
  const urls = [...text.matchAll(/!\[[^\]]*\]\((https?:[^)\s]+)\)/g)].map((match) => match[1]);
  const statuses = await Promise.all(urls.map(async (url) => [url, (await fetch(url, { method: 'HEAD' })).status]));
  return statuses.filter(([, status]) => status !== 200).map(([url, status]) =>
    `image returned ${status}, push it first (a gitignored path needs git add -f): ${url}`);
}

function stop(message) {
  console.error(`pr-publish: ${message}\nNothing after this step ran.`);
  process.exit(1);
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function main() {
  const { values: opts } = parseArgs({
    options: { repo: { type: 'string' }, pr: { type: 'string' }, body: { type: 'string' }, comment: { type: 'string' } },
  });
  if (!opts.repo || !opts.pr || !opts.body) {
    console.error('usage: pr-publish.mjs --repo owner/name --pr N --body file [--comment file]');
    process.exit(2);
  }

  const body = readFileSync(opts.body, 'utf8');
  const comment = opts.comment ? readFileSync(opts.comment, 'utf8') : null;
  const problems = [
    ...textProblems('body', body),
    ...(comment === null ? [] : textProblems('comment', comment)),
    ...(await imageProblems(body)),
  ];
  if (problems.length) stop(`checks failed before any write:\n- ${problems.join('\n- ')}`);

  const pull = `repos/${opts.repo}/pulls/${opts.pr}`;
  const credit = gh('api', `${pull}/commits`, '--paginate', '--jq', '.[].commit.message').match(ATTRIBUTION);
  if (credit) stop(`a pushed commit has the attribution line "${credit[0]}"; amend it and push first`);

  // REST, not `gh pr edit`: gh 2.45 fails there on the retired Projects (classic) field.
  try {
    gh('api', '-X', 'PATCH', pull, '-F', `body=@${opts.body}`, '--silent');
  } catch (error) {
    stop(`updating the body failed: ${error.stderr || error.message}`);
  }
  if (gh('api', pull, '--jq', '.body').trim() !== body.trim()) {
    stop('the body on GitHub differs from the file after the update');
  }
  console.log(`body updated and read back: ${opts.repo}#${opts.pr}`);

  if (comment !== null) {
    try {
      console.log(gh('api', `repos/${opts.repo}/issues/${opts.pr}/comments`, '-F', `body=@${opts.comment}`, '--jq', '.html_url').trim());
    } catch (error) {
      stop(`posting the comment failed: ${error.stderr || error.message}`);
    }
  }
}

if (isMain(import.meta.url)) await main();
