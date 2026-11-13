---
name: orchestrate
description: Build a whole spec's ticket graph in one run, with parallel builder subagents across the ready frontier merging into one integration branch. Use when the Epic lane chooses a single run, or the user asks to implement a whole spec.
---

# Orchestrate

The tickets are a **task graph**, not a list. The **frontier** is every ticket whose blockers are done. Keep the frontier busy.

Talk to subagents through pointers: the spec path, the ticket path, the notes directory, the commits. Do not paste what a pointer already holds.

1. **Read the graph.** For a local tracker, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" <dir>`. For a GitHub tracker, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" --github <Repo> <spec-issue>`. Stop on any error. Then the same command with `--frontier` lists the tickets ready now.
2. **Explore once (optional).** One Explore subagent writes notes on the relevant code and docs to a directory outside the repo that every builder can read, so builders spend their context on building.
3. **Branch.** Create the integration branch.
4. **Fan out.** Spawn one `plumb:plumb-builder` subagent per frontier ticket, in the background, each in its own worktree on its own branch. Name the integration tip's commit as the base in each brief: a builder's worktree starts from `origin/<default-branch>`, and the builder fast-forwards to the base you name. Each one runs the `implement` skill on its ticket and merges the integration tip into its branch before reporting. Each brief says this is one ticket of an Epic, so `implement` runs `review` on the Spec axis only. Step 8 still reviews the whole.
5. **Split shared state first.** Two frontier tickets that write the same file do not run in parallel. Split the file, or serialize those two, and say which.
6. **Merge as they land.** When a builder reports, check its proof output yourself, then merge its branch into the integration branch. Re-run the full checks on the integration tip unless they are recorded for its SHA, and record each command, result, and SHA, so step 8 can reuse them. A red tip stops new merges until it is green.
7. **Advance.** Each merge can widen the frontier. Spawn builders for the newly ready tickets.
8. **Review the whole.** When every ticket is done, run `review` on the integration branch against the spec. Give all fixes to one fresh builder, whose brief says the parent reviews.
9. **Finish.** Run `deliver`. Close each ticket the way the tracker closes work, naming the config's `Repo` as the `spec` skill says. On GitHub, comment first and then close, as [GITHUB.md](../setup/GITHUB.md) says. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-check.mjs" <worktree>...` on the builder worktrees, then remove only the ones it prints `ok` for. `git worktree remove` exits 0 while it deletes ignored files such as `.env` and commits only the worktree's HEAD reflog reaches. List each held worktree and its holds in the final reply, and never pass `--force`.

When a builder stops without a report (quota, crash, timeout), run `node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-check.mjs" <worktree>` on its worktree and read `git log <base>..<branch>` for its last checkpoint commit. Uncommitted drafts in the worktree are not evidence. Rerun the checkpoint's `Green:` command, then resume the same builder or brief a fresh one from that commit with its `Next:` step.

You own every builder's work. Read each diff before merging. A builder's "done" is a claim, not evidence. Long runs keep a `trail`.
