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

After each round, recompute the frontier and ask the next one.

## Depth by rigor

- **Light.** One sentence restating the goal. Ask only if the restatement could be wrong in a way that changes the code.
- **Standard.** Only the decisions the change actually forks on.
- **Strict.** The whole tree. Call the `domain` skill alongside, so each term and hard decision is written down as it settles.

## When the user is away

If the user said to run unattended, take each recommended answer, record it with the `trail` skill, and continue. Flag those answers in the final reply so the user can overturn them.

## Done

The frontier is empty: every branch visited, nothing silently assumed. Write the result as a goal paragraph, a numbered acceptance list, and an out-of-scope list. Confirm it with the user before building, unless they are away.
