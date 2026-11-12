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
| Review runs once per change: a builder skips `review` when the brief or lane reviews it, and an Epic ticket runs only the Spec axis. | Docs only: `skills/implement/SKILL.md`, the Feature and Epic lanes, `skills/orchestrate/SKILL.md`. An agent applies it from its brief and lane, which no script can see. |
| The parent records each check result, and reviewers reuse one recorded for HEAD, with a matching diff digest on a dirty tree, instead of rerunning it. | Docs only: `skills/review/SKILL.md`, `agents/plumb-reviewer.md`. A reviewer's rerun cannot be seen by a script. |
| A fix's verification scales with its size: `review` again, one reviewer, or none when no behavior or instruction changes. | Docs only: `skills/review/SKILL.md`. Sizing a fix is a judgment call. |
| A lane step run in a lighter or different form is marked `adjusted: <what changed>, <why>`, never done, and the final reply names it. | `hooks/reply-check.mjs` checks that the walked list names every lane step with a status and a reason, and that a step marked done at Standard or Strict whose lane text hands work to `plumb:plumb-builder` or runs `review` has that spawn in the same task. Docs only for any other lighter run of a step: `skills/plumb/SKILL.md`, `hooks/stop-gate.json`, since whether a step ran as written is a judgment call. |
| Align asks only decisions, and the confirmation is a question in its last round, never a round that shows the process for approval. | Docs only: `skills/align/SKILL.md`, `skills/design/SKILL.md`, the Feature lane. Whether a question is a decision or the process is a judgment call. |
