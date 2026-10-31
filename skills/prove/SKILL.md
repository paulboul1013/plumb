---
name: prove
description: Show a change works by checking the real artifact on the surface a user touches, not a proxy, a self-report, or "it compiles". Use before declaring any task done, before a commit or PR, and whenever a lane step says prove.
---

# Prove

Check the real thing directly. Tests show the branches you thought of. A live run shows what the user gets.

## Pick the surface

Read `docs/agents/plumb.md` for how to drive the app. Otherwise pick by what changed:

- A library or pure logic: the tests at the agreed seams, plus one call through the public interface with a real input.
- A CLI: run the command with real input and show stdout, stderr, and the exit code.
- A server or API: start it and hit the endpoint with curl. Show the response.
- A UI: drive it in a browser (the `run` skill, Playwright, or the repo's own driver) and take a screenshot of the changed state.
- Data or a migration: run it on a copy and read the rows back.

## Rules

- Show the command and its output. A claim without output is a guess.
- Script the check when you can, so a reviewer can re-run it. A one-off eyeball is weaker.
- Wrong surface or inconclusive is not a pass. Say so plainly.
- When the check fails, suspect the check before the system. Confirm it can go red.
- A comparison, such as old against new or the base branch against yours, counts only after it has caught a known-bad change for each output it compares, and only when it refuses on missing input instead of reporting a match. The `diagnose` skill describes these controls.
- Red is a colour, not a measurement. An exception, an empty result, and a real mismatch all fail a check, so quote the failure's content, such as the assertion's diff, and confirm it is the disagreement you predicted.
- Before you report an action done (committed, pushed, merged, started, sent), read the real state back and check the exit code. Output cut by `| tail` or `| head`, and text you echoed yourself, prove nothing.
- Verify the process, not only the result. For each fact the proof relies on, name the record it came from, and confirm that record is the one the project's rules point at, not a paste or a file you never read.
- A subagent's "done" is not proof. Re-run its proof yourself or read its output.

## By rigor

At every rigor, an action door runs on a copy. Delete, deploy, or send only things you created for the proof. Touching anything else is an irreversible action, so stop and ask first.


- **Light.** One run on the closest surface.
- **Standard.** Every acceptance item checked on the real surface.
- **Strict.** Standard, plus the same scenario on the base branch to show the difference, plus every one-way change door exercised on a copy first.

## Output

A short block per acceptance item: the item, the command or steps, the output or screenshot path, and pass or fail.
