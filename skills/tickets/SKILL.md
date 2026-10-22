---
name: tickets
description: Split a spec or plan into tracer-bullet tickets, each a thin vertical slice with blocking edges and its own proof, published to the configured tracker. Use after spec, or when the user asks to break work into tickets or issues.
---

# Tickets

Break the work into **tracer bullets**: thin slices that each cut through every layer and end in something a person can see working.

## Rules for a slice

- It cuts a narrow, complete path through every layer it needs (schema, logic, API, UI, tests). Not one layer at a time.
- It is provable on its own. It names the command or scenario that shows it working.
- It fits one fresh context window.
- Prefactoring comes first, in its own ticket. Make the change easy, then make the easy change.
- It lists its **blockers**: the tickets that must finish before it starts. No blockers means it can start now.

**Wide refactors break the slicing rule.** One mechanical change that fans across the codebase (rename a column, retype a shared symbol) runs as expand, migrate, contract. Expand adds the new form beside the old. Each migrate batch (per package or directory) is a ticket blocked by expand. Contract deletes the old form and is blocked by every batch.

## Steps

1. Read the spec and the code it touches. Use the glossary's terms.
2. Draft the slices with their blockers.
3. Show the user a numbered list: title, blocked by, and what it delivers. Ask whether the granularity is right, whether each blocker truly gates its ticket, and whether any should merge or split. Iterate until approved. If the user is away, publish your draft and record that with `trail`.
4. Publish.

## Local tracker

One file per ticket at `.plumb/<feature-slug>/tickets/<NN>-<slug>.md`, numbered from `01` with blockers first, so every blocker has a lower number. Then run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" .plumb/<feature-slug>/tickets
```

Fix every line it prints. The same script with `--frontier` lists the tickets ready to start.

```markdown
# 03: <title>

**Blocked by:** 01, 02
**Status:** ready

## Build

The end-to-end behavior this ticket makes work, from the user's side.

## Acceptance

- [ ] <observable behavior>

## Proof

<the command, scenario, or screenshot that shows it working>
```

`**Blocked by:**` is `None` for a ticket that can start now. `**Status:**` is one of `ready`, `in-progress`, or `done`.

## Real tracker

One issue per ticket, blockers first, so later tickets can reference real ids. Use the tracker's native blocking link where it has one. If the source was an issue, make each ticket its sub-issue. Do not close or edit the parent.

In either form, leave out file paths and code, except a prototype snippet that pins a decision.
