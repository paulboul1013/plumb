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

This repo ships Plumb for Codex and Claude Code. From the repo root, register this checkout with `codex plugin marketplace add "$PWD"`, install it with `codex plugin add plumb@plumb-local`, then open a new session and select the Plumb help skill. Use `/hooks` to review its hooks in the Codex CLI. For Claude Code, load the checkout with `claude --plugin-dir "$PWD"` and run `/plumb:help`.

- Hooks: run `node --test scripts/test/hooks.test.mjs scripts/test/codex-plugin.test.mjs` to exercise both hosts' stdin payloads.
- Ticket graphs and wayfind maps: `node scripts/check-tickets.mjs <tickets-or-decisions-dir>`.
- Evidence: `node scripts/record.mjs <slug> <name> -- <command>` writes to `.plumb/<slug>/evidence/`.

## Domain docs

Glossary: none. Create `GLOSSARY.md` at the repo root when a term first needs a definition.
ADRs: none. Create `docs/adr/` with the first one.
Layout: single context.
