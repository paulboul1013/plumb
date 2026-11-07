# Epic lane

Work that one session cannot hold. The thinking stays in one context window. The building starts fresh per ticket.

Keep steps 1 to 4 in one unbroken context. Do not clear or compact until the tickets exist. If the window gets close to full first, compact at the nearest step boundary.

1. **Find the destination.** If you cannot yet say what done looks like, the work is foggy. Run `align` on the destination alone, and turn each open question that blocks the plan into a decision ticket (a ticket whose output is a decision, not code). Resolve decision tickets one at a time, by `align` for preference calls and by the Prototype lane for empirical ones, until the route is clear. If the destination is already clear, skip to step 2.
2. **Align and model the domain.** Run `align` over the whole design tree, with `domain`. Settle runnable questions with the Prototype lane instead of debate.
3. **Write the spec.** Run `spec`.
4. **Cut the tickets.** Run `tickets`. Then run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" <tickets-dir>` for a local tracker and fix every line it prints.
5. **Choose how to build.** For one ticket at a time, run `implement` per ticket and start a fresh session or subagent for each. For the whole graph in one run, run `orchestrate`. Each ticket runs `review` on the Spec axis only, because step 6 covers the other axes.
6. **Review the whole.** Run `review` over the integration branch against the spec.
7. **Deliver.** Run `deliver`.
8. **Look back.** Suggest `/plumb:retro` to the user.

**Reply.** The spec link, the ticket graph with each ticket's state, the proof per ticket, and the decisions still open.
