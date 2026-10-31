---
name: setup
description: Configure this repo for the plumb skills by writing docs/agents/plumb.md with the issue tracker, check commands, run surface, and domain doc layout. Run once per repo.
disable-model-invocation: true
---

# Setup

Write `docs/agents/plumb.md`, which every plumb skill reads. Explore first, propose, confirm, then write.

## 1. Explore

Read what exists. Do not assume.

- `git remote -v`: GitHub, GitLab, or none.
- `CLAUDE.md`, `AGENTS.md`, and any existing `## Agent skills` block.
- The glossary under any name: `GLOSSARY.md`, `GLOSSARY-MAP.md`, `CONTEXT.md`, `docs/glossary*`. Also `docs/adr/`, and monorepo signals such as workspaces or `packages/*`.
- The check commands: `package.json` scripts, `Makefile`, `pyproject.toml`, `Cargo.toml`, the CI workflow. Find typecheck, lint, the single-file test, and the full suite. The full suite is what CI runs. Run each once to confirm it works.
- How the app runs: the dev server command, the port, the CLI entry point, an existing project verify skill.

## 2. Propose

Show a draft with your recommended answer for each section, so the user can accept in one word. Skip a section that exploration already settled.

```markdown
# Plumb config

## Tracker

<GitHub via gh | GitLab via glab | local files under .plumb/<feature>/ | other: one paragraph>
Ready label: <ready-for-agent>

## Checks

- Typecheck: `<command>`
- Lint: `<command>`
- One test file: `<command with a placeholder path>`
- Full suite: `<command>`

## Run surface

<how to start the app and drive it: the command, the URL or entry point, the driver tool>

## Domain docs

Glossary: `<path, such as GLOSSARY.md or CONTEXT.md>`
ADRs: `<docs/adr/ or none>`
Layout: <single context | multi-context via GLOSSARY-MAP.md>
```

## 3. Write

Write `docs/agents/plumb.md`. Then add a pointer to whichever of `CLAUDE.md` or `AGENTS.md` exists, editing an existing `## Agent skills` block in place:

```markdown
## Agent skills

Plumb config: `docs/agents/plumb.md`.
```

If neither file exists, ask which to create. Never create the second one when one exists.

Create the ready label on GitHub or GitLab if it is missing. Tell the user the file can be edited by hand later.
