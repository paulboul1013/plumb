---
name: prove
description: Show a change works by checking the real artifact on the surface a user touches, not a proxy, a self-report, or "it compiles". Use before declaring any task done, before a commit or PR, and whenever a lane step says prove.
---

# Prove

Check the real thing directly. Tests show the branches you thought of. A live run shows what the user gets.

## Pick the surface

Read `docs/agents/factory.md` for how to drive the app. Otherwise pick by what changed:

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
- A subagent's "done" is not proof. Re-run its proof yourself or read its output.

## By rigor

- **Light.** One run on the closest surface.
- **Standard.** Every acceptance item checked on the real surface.
- **Strict.** Standard, plus the same scenario on the base branch to show the difference, plus every one-way door exercised on a copy first.

## Output

A short block per acceptance item: the item, the command or steps, the output or screenshot path, and pass or fail.
