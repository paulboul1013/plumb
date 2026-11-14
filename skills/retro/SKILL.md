---
name: retro
description: Look back over a coding session and turn its mistakes into changes to the agent's environment, preferring checks that make the mistake impossible over more instructions. Use after a build, especially one that went sideways.
disable-model-invocation: true
---

# Retro

Improve the environment the next session starts in, not this session's code.

## 1. Read the primary source

The current session by default, or the session log the user names. List each place the agent went wrong, was corrected by the user, wasted many tool calls, or could not find something.

Also read the open entries of the failure log, across all repos:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/failure-log.mjs" list --open
```

Prefer a mistake that recurs across entries or repos over a one-off. Open an entry's `transcript` path only when the entry lacks the detail you need.

## 2. Pick the strongest fix for each

Try these in order and stop at the first that works. A rule that can be enforced by a tool does not also go in prose.

1. **Structure.** Change the code so the mistake cannot be written: a type that forbids the bad state, a module that owns the rule.
2. **A check.** A lint rule whose error names the fix, a pre-commit hook, a CI job, a script like this plugin's `check-tickets.mjs`. Read the repo's existing check commands first. A check that exists but is not wired up is the finding.
3. **A test** that goes red on the past mistake.
4. **A coding standard** in `CODING_STANDARDS.md`, for judgement calls no tool can enforce. The `review` skill reads it, so the implementing agent does not carry it.
5. **A navigation pointer** in `CLAUDE.md` or `AGENTS.md`, only when the agent could not find something. Keep those files short.

Also look for:

- An instruction in a steering file that changed nothing. Delete it.
- An expensive tool call that a cheaper one would replace.
- Information the agent needed and could not reach, such as dev server logs or read-only access to a service.
- A missing correct test seam found by the Bug lane. Point at the module that needs redesign.

## 3. Prove each check

For each check you propose to add, show that it fails on the real past mistake and passes on the fix.

## 4. Present

List the candidates, most severe first, each with the mistake, the fix, and its level from step 2. Apply the ones the user accepts. After applying a fix that came from a failure log entry, mark the entry encoded so the next retro skips it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/failure-log.mjs" encode <id> --by <commit or file>
```
