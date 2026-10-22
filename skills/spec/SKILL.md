---
name: spec
description: Turn the aligned conversation into a spec and publish it to the configured issue tracker, without a new interview. Use after align when the work spans sessions, or when the user asks for a spec or PRD.
---

# Spec

Synthesize what the conversation already settled. Do not interview again. If a decision is still open, list it under Open decisions rather than inventing an answer.

Read `docs/agents/plumb.md` for the tracker. If none is configured, write to `.plumb/<feature-slug>/spec.md`.

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
- Schema, API, or format changes. Mark each one-way door.

No file paths or code, since they go stale. The exception is a prototype snippet that pins a decision better than prose, such as a state machine or a type. Trim it to the decision and say it came from a prototype.

## Proof plan

How each acceptance item will be shown working on the real surface: the command, the scenario, or the screenshot.

## Out of scope

## Open decisions
```

Apply the tracker's ready label. Report the spec's link or path.
