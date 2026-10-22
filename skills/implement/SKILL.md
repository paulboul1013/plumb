---
name: implement
description: Build one ticket or one feature test-first at the agreed seams, then prove and review it before committing. Use when a lane step says implement, or the user asks to implement a ticket or spec item.
---

# Implement

If given a ticket reference, fetch it and state its title before starting. If the reference is ambiguous, ask. Set a local ticket's status to `in-progress`.

1. Confirm the seams. They come from `design` or the ticket. If none were agreed, propose them and get a yes at Standard and Strict.
2. Run `tdd` at those seams, one vertical slice per cycle.
3. Run the typecheck and the touched test file after each slice. Run the full suite once at the end. The commands are in `docs/agents/factory.md`, or the repo's own scripts.
4. Run `prove` against the ticket's Proof line, or the acceptance list.
5. Run `review` with the ticket or acceptance list as the spec. Fix each finding and prove again.
6. Commit to the current branch. Set a local ticket's status to `done`.

When a parent agent delegated this to you, report the branch, the commits, the proof output, and any deviation from the design sketch. Do not babysit a PR unless the brief says so.
