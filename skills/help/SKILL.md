---
name: help
description: Tell the user which plumb lane, skill, or command fits what they want to do, with one example prompt, and how to steer a plumb run that went wrong. Use for /plumb:help, or when the user asks how to use plumb or which plumb skill to use.
argument-hint: "What do you want to do?"
---

# Help

Answer the user's question about plumb. Do not start their task: when they describe one, say how plumb will handle it and stop.

## Read the map first

Do not answer from memory. Read these before you reply, since they change:

- [the router](../plumb/SKILL.md): the lanes, the rigor table, the door questions, and the Skills list, which names every skill and says which ones only the user can type.
- The lane file that fits, under [lanes](../plumb/lanes/).
- [The README](../../README.md), for setup, hooks, and living beside pstack.

Then check this repo's setup: whether `docs/agents/plumb.md` exists. If it does not, say once that `/plumb:setup` saves plumb from guessing the checks and the tracker.

## Find what they need

- **A task they want done.** Name the lane and the likely rigor, the way the router would classify it, and the skills that lane will run. Say they can just describe the task: the router runs without a command.
- **One step on its own**, such as only a review or only a debug loop. Name the skill and how to call it, such as `/plumb:review` for the branch since `main`.
- **A command only they can type.** These are the user-invoked skills in the router's Skills list. Say what each does and when it pays off.
- **A run that went wrong.** Give the one-line steer that fixes it. Common ones:
  - It skipped the classification line: "Run `plumb:plumb` first and print the lane line."
  - The lane or rigor looks wrong: "Re-classify: this is a Bug, M, two-way." The router re-classifies when evidence changes.
  - It declared done without evidence: "Show the proof output from the real surface."
  - It skipped review at Standard or Strict: "Run `review` before you finish."
  - It asked you something it could look up or run: "That is a fact, look it up," or "That is empirical, run it."
  - plumb gets in the way for a session: set `PLUMB_HOOK=off` to turn off its SessionStart hook and its stop gate.
- **What plumb is, or how it differs from pstack.** Answer from the README.

## Reply

Lead with the answer in one or two sentences. Then at most one example prompt in a code block, written for their case. For depth, point to the router, the lane, or the README section instead of copying it. Those files live in the plumb plugin, not in the user's repo, so name them ("the Bug lane", "the README's Hooks section"). If you add a path, make it absolute: the plugin root is two levels above this skill's base directory, so the Bug lane is `<plugin root>/skills/plumb/lanes/bug.md` with the root filled in. Never write a path relative to the user's repo. Keep it short unless they asked for the whole map.
