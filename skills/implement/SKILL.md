---
name: implement
description: Build one ticket or one feature test-first at the agreed seams, then prove and review it before committing. Use when a lane step says implement, or the user asks to implement a ticket or spec item.
---

# Implement

If given a ticket reference, fetch it and state its title before starting. If the reference is ambiguous, ask. Set a local ticket's status to `in-progress`.

1. Confirm the seams. They come from `design` or the ticket. If none were agreed, propose them and get a yes at Standard and Strict.
2. Run `tdd` at those seams, one vertical slice per cycle.
3. Run the typecheck and the touched test file after each slice. Run the full suite once at the end. The commands are in `docs/agents/plumb.md`. Without it, use what the router inferred, and make the full-suite run the command CI runs. If the full suite fails, classify every failure before you report it:
   - **Yours.** It fails only with your change. Fix it.
   - **Pre-existing.** It also fails on the base. Check the base out with `git worktree add <tmp-dir> <base>` and run the same test there.
   - **Flaky.** It passes when run alone or rerun, or a different test fails on each full run.

   Report the counts, then each failure with its class and the command that showed it. Never edit, skip, or delete an unrelated test to turn the suite green.
4. Run `prove` against the ticket's Proof line, or the acceptance list.
5. Run `review` with the ticket or acceptance list as the spec. Fix each finding and prove again.
6. Commit to the current branch. Set a local ticket's status to `done`.

When a parent agent delegated this to you, report the branch, the commits, the proof output, and any deviation from the design sketch. Do not babysit a PR unless the brief says so.
