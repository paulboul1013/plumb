# Plumb config

## Tracker

Local files under `.plumb/<feature>/`. The directory is excluded through `.git/info/exclude`, so specs, tickets, maps, research notes, and evidence never land in a commit.

Ready label: none.

## Checks

- Typecheck: none. The scripts are plain `.mjs` with no TypeScript.
- Lint: `node scripts/check-plugin.mjs`
- One test file: `node --test scripts/test/<name>.test.mjs`
- Full suite: `node scripts/check-plugin.mjs && node --test scripts/test/*.test.mjs`

Run the full suite before every commit, as `AGENTS.md` says. Pass the test glob, not the `scripts/test/` directory.

## Run surface

This repo is a Claude Code plugin. Load the working tree with `claude --plugin-dir /home/paulboul/matt_pstack`, then type a skill such as `/plumb:help`, or describe a task and let the router classify it.

- Hooks: drive them with `node --test scripts/test/hooks.test.mjs`, which feeds each hook its stdin payload.
- Ticket graphs and wayfind maps: `node scripts/check-tickets.mjs <tickets-or-decisions-dir>`.
- Evidence: `node scripts/record.mjs <slug> <name> -- <command>` writes to `.plumb/<slug>/evidence/`.

## Domain docs

Glossary: none. Create `GLOSSARY.md` at the repo root when a term first needs a definition.
ADRs: none. Create `docs/adr/` with the first one.
Layout: single context.
