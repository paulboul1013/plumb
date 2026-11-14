#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { isMain } from './entry.mjs';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  return Object.fromEntries(m[1].split('\n').map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
}

export function checkPlugin(root) {
  const errors = [];
  const rel = (p) => relative(root, p);
  const skillsDir = join(root, 'skills');
  const skills = new Map();

  for (const name of readdirSync(skillsDir)) {
    const file = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(file)) { errors.push(`skills/${name}: missing SKILL.md`); continue; }
    const fm = frontmatter(readFileSync(file, 'utf8'));
    if (!fm) { errors.push(`${rel(file)}: missing frontmatter`); continue; }
    if (fm.name !== name) errors.push(`${rel(file)}: name "${fm.name}" does not match directory "${name}"`);
    if (!fm.description) errors.push(`${rel(file)}: missing description`);
    skills.set(name, { userInvoked: fm['disable-model-invocation'] === 'true' });
  }

  const markdown = [...walk(join(root, 'skills')), ...walk(join(root, 'agents')), ...walk(join(root, 'hooks')), join(root, 'README.md')]
    .filter((p) => p.endsWith('.md') && existsSync(p));

  // Only these files describe how the glossary is found; everything else says "the glossary".
  const glossaryFinders = new Set(['skills/plumb/SKILL.md', 'skills/domain/SKILL.md', 'skills/domain/GLOSSARY-FORMAT.md', 'skills/setup/SKILL.md', 'README.md']);

  for (const file of markdown) {
    const text = readFileSync(file, 'utf8');
    const prose = text.replace(/^```[\s\S]*?^```/gm, '');
    text.split('\n').forEach((line, i) => {
      if (line.includes('—')) errors.push(`${rel(file)}:${i + 1}: long dash; rewrite the sentence with a period, comma, or colon`);
      if (/\.\.\.HEAD\b/.test(line) && !/review-diff|commits only|misses uncommitted/.test(line)) {
        errors.push(`${rel(file)}:${i + 1}: \`...HEAD\` diff misses uncommitted and untracked work; use \`node "\${CLAUDE_PLUGIN_ROOT}/scripts/review-diff.mjs" <ref>\``);
      }
      if (line.includes('GLOSSARY.md') && !glossaryFinders.has(rel(file))) {
        errors.push(`${rel(file)}:${i + 1}: hard-coded GLOSSARY.md; write "the glossary", which the plumb router resolves to the repo's real file (GLOSSARY.md, CONTEXT.md, ...)`);
      }
    });
    // A destination in angle brackets, as in `[x](<my notes.md>)`, may hold spaces; the brackets are not part of the path.
    for (const [, bracketed, bare] of prose.matchAll(/\]\((?:<([^>#]+)(?:#[^>]*)?>|([^)#\s]+)(?:#[^)]*)?)\)/g)) {
      const target = bracketed ?? bare;
      if (/^[a-z]+:/.test(target)) continue;
      if (!existsSync(resolve(dirname(file), target))) errors.push(`${rel(file)}: broken link ${target}`);
    }
    for (const [, slash, name] of text.matchAll(/`(\/?)(?:plumb:)?([a-z][a-z-]*)`/g)) {
      const skill = skills.get(name);
      if (!skill) continue;
      if (skill.userInvoked && !slash && !file.endsWith(join(name, 'SKILL.md'))) {
        errors.push(`${rel(file)}: \`${name}\` is user-invoked; refer to it as \`/plumb:${name}\` so the model suggests it instead of running it`);
      }
    }
  }

  const router = readFileSync(join(skillsDir, 'plumb', 'SKILL.md'), 'utf8');
  const listed = new Set([...router.split('## Skills')[1].matchAll(/^- `\/?(?:plumb:)?([a-z-]+)`/gm)].map((m) => m[1]));
  for (const name of skills.keys()) {
    if (name !== 'plumb' && !listed.has(name)) errors.push(`skills/plumb/SKILL.md: router's Skills list does not mention "${name}"`);
  }
  for (const name of listed) if (!skills.has(name)) errors.push(`skills/plumb/SKILL.md: router lists "${name}" but no such skill exists`);

  const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  for (const a of manifest.agents ?? []) if (!existsSync(join(root, a))) errors.push(`.claude-plugin/plugin.json: agent ${a} does not exist`);

  return errors;
}

if (isMain(import.meta.url)) {
  const errors = checkPlugin(resolve(process.argv[2] ?? join(dirname(new URL(import.meta.url).pathname), '..')));
  for (const e of errors) console.log(e);
  if (errors.length) process.exit(1);
  console.log('ok: plugin checks pass');
}
