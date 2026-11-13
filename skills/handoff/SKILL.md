---
name: handoff
description: Write a handoff file so another session, harness, directory, or person can continue the work, or so work can pause safely. Use when moving work out of this session.
argument-hint: "What will the next session do?"
disable-model-invocation: true
---

# Handoff

## Pick the right boundary first

At a phase boundary, the cheapest move that keeps the context you need wins:

1. **Continue** when the next phase needs this context.
2. **Clear** when nothing here matters to what comes next.
3. **A subagent** for a tightly scoped side task that should report back.
4. **Compact** when the window is getting full and the next phase still needs the gist.
5. **Handoff** when the work moves to a new harness, a new directory, another person, or must survive a pause.

Only option 5 needs this file. Say which option you picked.

## Write the file

Save it to `.plumb/handoffs/<YYYY-MM-DD>-<slug>.md` in the repo. Keep `.plumb/` out of git: if `.plumb/` is not a line in the file `git rev-parse --git-path info/exclude` names, append it, as `record.mjs` does. Include:

- **Goal.** One paragraph, plus the user's argument if they gave one.
- **State.** The lane, the rigor, which lane steps are done, the branch and its last commit, and uncommitted changes.
- **Pointers.** The spec, tickets, ADRs, PRs, the trail file, prototype branches. Link them. Do not copy what they hold.
- **Decisions.** Each decision taken and who made it. Mark the ones the user has not confirmed.
- **Next steps.** The next three actions, in order.
- **Suggested skills.** Which plumb skills the next agent should run first.

Redact keys, passwords, and personal data. Print the file's full path.
