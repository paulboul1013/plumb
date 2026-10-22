---
name: trail
description: Keep a decision log for long, autonomous, or Strict-rigor work, one row per decision with its reason and evidence. Use when the user steps away, says to run unattended, or the router sets Strict rigor.
---

# Trail

Append one row per decision to `.factory/trail.tsv`. Create it with this header if it does not exist:

```
time	decision	why	evidence	result
```

- **time.** ISO 8601.
- **decision.** What you chose, in a few words.
- **why.** The reason, or "recommended answer, user away" for an `align` default.
- **evidence.** A command and its result, a file and line, a commit, or a screenshot path.
- **result.** `kept`, `reverted`, or `pending`.

Log a decision when you take a default the user could overturn, pick between designs, revert a hypothesis, re-classify the lane or rigor, or skip a lane step. Do not log routine edits.

Keep the file local by default (add `.factory/trail.tsv` to `.git/info/exclude`). Commit it only when a reviewer needs the record to trust the result.

In the final reply, list every `pending` row and every user-away default.
