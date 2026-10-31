# Plumb plugin: agent rules

Run `node scripts/check-plugin.mjs` and `node --test scripts/test/*.test.mjs` before every commit.

When a correction repeats, enforce it with a check, a script, or a hook, and add a row here. Drop a row once its mistake cannot happen.

| Rule | Enforced by |
| --- | --- |
| No long dashes in skill prose. | `scripts/check-plugin.mjs` |
| Refer to a user-invoked skill as `/plumb:<name>`. | `scripts/check-plugin.mjs` |
| The router's Skills list names every skill, and only those. | `scripts/check-plugin.mjs` |
| Say "the glossary", never a hard-coded `GLOSSARY.md`, outside the files that describe how it is found. | `scripts/check-plugin.mjs` |
| Reviews see uncommitted and untracked work: use `scripts/review-diff.mjs <ref>`, never a commits-only `git diff <ref>...HEAD`. | `scripts/review-diff.mjs`, plus a `scripts/check-plugin.mjs` lint |
| A builder never stashes, resets, restores, or cleans a shared checkout. | `isolation: worktree` in `agents/plumb-builder.md`, plus the PreToolUse hook `hooks/builder-git-guard.mjs` |
| Remove a builder worktree only after `scripts/worktree-check.mjs` prints `ok` for it. | `scripts/worktree-check.mjs`, called from `skills/orchestrate/SKILL.md` |
| Ticket graphs: blockers numbered lower, every ticket has Acceptance and Proof. | `scripts/check-tickets.mjs` |
| Classify each full-suite failure as yours, pre-existing, or flaky, with the command that showed it. | Docs only: `skills/implement/SKILL.md`. It is a judgment call that no script can make. |
