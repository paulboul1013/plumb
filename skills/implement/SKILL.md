---
name: implement
description: Build one ticket or one feature test-first at the agreed seams, then prove it and review it as far as the brief or lane sets, before committing. Use when a lane step says implement, or the user asks to implement a ticket or spec item.
---

# Implement

If given a ticket reference, fetch it and state its title before starting. If the reference is ambiguous, ask. Set a local ticket's status to `in-progress`. On a GitHub tracker, claim the ticket by assigning it to yourself, as [GITHUB.md](../setup/GITHUB.md) says.

1. Confirm the seams. They come from `design` or the ticket. If none were agreed, propose them and get a yes at Standard and Strict.
2. Run `tdd` at those seams, one vertical slice per cycle.
3. Run the typecheck and the touched test file after each slice. Run the full suite once at the end. The commands are in `docs/agents/plumb.md`. Without it, use what the router inferred, and make the full-suite run the command CI runs. If the full suite fails, classify every failure before you report it:
   - **Yours.** It fails only with your change. Fix it.
   - **Pre-existing.** It also fails on the base. Check the base out with `git worktree add <tmp-dir> <base>` and run the same test there.
   - **Flaky.** It passes when run alone or rerun, or a different test fails on each full run.

   Report the counts, then each failure with its class and the command that showed it. Never edit, skip, or delete an unrelated test to turn the suite green.
4. Run `prove` against the ticket's Proof line, or the acceptance list.
5. Run `review` with the ticket or acceptance list as the spec, unless the brief or lane limits it. For a ticket from a spec's ticket graph, whichever lane runs this skill, run only the Spec axis, because the Epic reviews the whole integration branch. Say in your reply that this whole-branch review, with the other axes and any panel, is still owed, and how many tickets are left. Otherwise, when the brief says the parent reviews, or a lane with its own Review step runs this skill, do not run `review`, because that review runs once. Report as usual. Fix each finding and prove again. Skipping is the exception: any other `implement` request still runs `review` at the task's rigor.
6. Commit to the current branch. Set a local ticket's status to `done`. On a GitHub tracker, close the ticket as [GITHUB.md](../setup/GITHUB.md) says: comment first, then close. When the ticket is part of an `orchestrate` run, leave it open, because `orchestrate` closes it when it merges your branch.

When a parent agent delegated this to you, report the branch, the commits, the proof output, and any deviation from the design sketch. Do not babysit a PR unless the brief says so.
