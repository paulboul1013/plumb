---
name: spec
description: Turn the aligned conversation into a spec and publish it to the configured issue tracker, without a new interview. Use after align when the work spans sessions, or when the user asks for a spec or PRD.
---

# Spec

Synthesize what the conversation already settled. Do not interview again. If a decision is still open, list it under Open decisions rather than inventing an answer.

Read `docs/agents/plumb.md` for the tracker. If none is configured, write to `.plumb/<feature-slug>/spec.md`.

On GitHub or GitLab, name the config's `Repo` in every issue command that writes, such as create, edit, comment, and close: `gh issue <command> --repo <Repo>` or `glab issue <command> -R <Repo>`. A `gh api` call, such as a sub-issue or blocking link, takes `<Repo>` in its path, never the `{owner}/{repo}` placeholder. Never rely on the default, since in a fork `gh` can default to the upstream parent. If the config has no `Repo` line, run `gh repo view --json nameWithOwner` (or `glab repo view`) once before the first write and confirm it is the user's own repo. The `tickets` and `orchestrate` skills follow this rule too.

Use the glossary's terms throughout and respect the ADRs in the area.

## Template

```markdown
## Problem

The problem, from the user's side.

## Solution

What changes for the user.

## Acceptance

A numbered list. Each item is an observable behavior a test or a live run can check.

## Design

- The data shape and its organizing structure.
- The modules built or changed, and their interfaces.
- The seams under test, with what each catches.
- Schema, API, or format changes. Mark each design door and each one-way change door.

No file paths or code, since they go stale. The exception is a prototype snippet that pins a decision better than prose, such as a state machine or a type. Trim it to the decision and say it came from a prototype.

## Proof plan

How each acceptance item will be shown working on the real surface: the command, the scenario, or the screenshot.

## Out of scope

## Open decisions
```

Apply the tracker's ready label. Report the spec's link or path.
