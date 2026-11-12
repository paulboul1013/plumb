---
name: align
description: Interview the user about a plan, feature, or design until every decision they own is settled. Use before building anything whose intent is unclear, when the user says "grill me", or when a lane step says align.
---

# Align

Reach a shared understanding before code. Map the work as a **design tree**: each decision branches into the decisions that depend on it.

## Sort every question first

- **Fact** (what the code does, what exists, what changed). Look it up yourself. Send a subagent for a wide search. Only the questions that depend on that fact wait for it.
- **Empirical** (does it work, how fast, how it looks). Run it, or hand it to the Prototype lane in [../plumb/lanes/prototype.md](../plumb/lanes/prototype.md).
- **Decision** (product behavior, scope, domain naming, risk, taste). This is the user's. Ask it.

Only decisions reach the user.

## Ask in rounds

The **frontier** is every open decision whose prerequisites are settled. Ask the whole frontier in one round, numbered, each with your recommended answer. Word each question so "yes" accepts the recommendation. A question that depends on another open question in the same round waits for the next round.

```
**Q1. <title>.** <the question, with the options if there are any>

Recommended: <your answer, and the reason in one sentence>
```

If the session has an interactive question tool, such as `AskUserQuestion`, ask each round through it so the user picks instead of typing question numbers and answers:

- One question per decision, with a short header.
- Two to four options. Put the recommended option first and add "(Recommended)" to its label.
- Each option's description says what happens if the user picks it.
- Use multi-select only when the options do not exclude each other, such as a list of features to include.
- Respect the tool's limit per call. Split a larger frontier over several calls, prerequisites first.

Fall back to the numbered text format above only when no such tool exists.

After each round, recompute the frontier and ask the next one.

## Ask decisions, never the process

A round holds only decisions. Do not put the lane, its steps, the todolist, or which skills will run into a round, and do not ask the user to approve them. Running them is yours. When the request, a spec, or notes in the repo already settle a decision, state it as settled in the goal paragraph instead of asking it again.

## Depth by rigor

- **Light.** One sentence restating the goal. Ask only if the restatement could be wrong in a way that changes the code.
- **Standard.** Only the decisions the change actually forks on.
- **Strict.** The whole tree. A branch the request, a spec, or notes in the repo already settle counts as visited when the goal paragraph states it with its source. Call the `domain` skill alongside, so each term and hard decision is written down as it settles.

## When the user is away

If the user said to run unattended, take each recommended answer, record it with the `trail` skill, and continue. Flag those answers in the final reply so the user can overturn them.

## Done

The frontier is empty: every branch visited, nothing silently assumed. Write the result as a goal paragraph, a numbered acceptance list, and an out-of-scope list. Confirm it with the user before building, unless they are away. Make the confirmation a question in the last round, not a round of its own: show the three parts with that round's questions, and ask "Build this?" with yes as the recommended answer. When the request already settles every decision, that question is the only round. When the lane also needs the user's yes on the seams, ask it in that same round, as the `design` skill says.
