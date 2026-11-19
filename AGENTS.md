# Plumb plugin: agent rules

Run `node scripts/check-plugin.mjs` and `node --test scripts/test/*.test.mjs` before every commit.

When a correction repeats, enforce it with a check, a script, or a hook, and add a row here. Drop a row once its mistake cannot happen.

| Rule | Enforced by |
| --- | --- |
| No long dashes in skill prose. | `scripts/check-plugin.mjs` |
| Refer to a user-invoked skill as `/plumb:<name>`. | `scripts/check-plugin.mjs` |
| User-invoked skills have matching invocation policies on Claude Code and Codex. | `scripts/check-plugin.mjs` |
| The router's Skills list names every skill, and only those. | `scripts/check-plugin.mjs` |
| Say "the glossary", never a hard-coded `GLOSSARY.md`, outside the files that describe how it is found. | `scripts/check-plugin.mjs` |
| Reviews see uncommitted and untracked work: use `scripts/review-diff.mjs <ref>`, never a commits-only `git diff <ref>...HEAD`. | `scripts/review-diff.mjs`, plus a `scripts/check-plugin.mjs` lint |
| A builder never stashes, resets, restores, or cleans a shared checkout. | Claude Code uses `isolation: worktree` and `hooks/builder-git-guard.mjs`. In Codex the parent creates a separate worktree and the builder verifies it before editing, as described in `skills/plumb/CODEX.md`. |
| Remove a builder worktree only after `scripts/worktree-check.mjs` prints `ok` for it. | `scripts/worktree-check.mjs`, called from `skills/orchestrate/SKILL.md` |
| Entry files check `isMain(import.meta.url)` and paths use `fileURLToPath`, so a symlinked or spaced path still runs them. | `scripts/check-plugin.mjs` |
| Ticket graphs: blockers numbered lower, every ticket has Acceptance and Proof. | `scripts/check-tickets.mjs` |
| Classify each full-suite failure as yours, pre-existing, or flaky, with the command that showed it. | Docs only: `skills/implement/SKILL.md`. It is a judgment call that no script can make. |
| Review runs once per change: a builder skips `review` when the brief or lane reviews it, and an Epic ticket runs only the Spec axis. | Docs only: `skills/implement/SKILL.md`, the Feature and Epic lanes, `skills/orchestrate/SKILL.md`. An agent applies it from its brief and lane, which no script can see. |
| The parent records each check result, and reviewers reuse one recorded for HEAD, with a matching diff digest on a dirty tree, instead of rerunning it. | Docs only: `skills/review/SKILL.md`, `agents/plumb-reviewer.md`. A reviewer's rerun cannot be seen by a script. |
| A fix's verification scales with its size: `review` again, one reviewer, or none when no behavior or instruction changes. | Docs only: `skills/review/SKILL.md`. Sizing a fix is a judgment call. |
| A lane step run in a lighter or different form is marked `adjusted: <what changed>, <why>`, never done, and the final reply names it. | `hooks/reply-check.mjs` checks lane steps, statuses, and reasons. In Claude Code it also verifies the required builder or reviewer spawn in the same task at Standard and Strict. The agent judges other adjustments using `skills/plumb/SKILL.md` and `hooks/stop-gate.json`. |
| Align asks only decisions, and the confirmation is a question in its last round, never a round that shows the process for approval. | Docs only: `skills/align/SKILL.md`, `skills/design/SKILL.md`, the Feature lane. Whether a question is a decision or the process is a judgment call. |

## Agent skills

Plumb config: `docs/agents/plumb.md`.
