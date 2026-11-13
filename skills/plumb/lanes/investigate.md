# Investigate lane

Read-only. The output is a cited answer or a recommendation, not a change.

1. **Find the primary sources.** Code, tests, git history, ADRs, the issue tracker, docs. Send subagents for wide sweeps and keep only their conclusions and file pointers in the main context. When the primary source lives outside the repo, such as official docs or a third-party API, run `research`.
2. **Answer.** For "how does X work": the key terms, the runtime flow, where things live, and the traps. For "why is it like this": the decision, its evidence, and the tradeoff. For "should we do X or Y": a table of the options and your recommendation.
3. **Cite.** Every claim names its file and line, commit, or document. Label anything inferred as inferred.
4. **Push back.** If the question rests on a wrong premise, say so.

If the answer leads to a change, stop and re-route through the router.

**Reply.** The answer with citations.
