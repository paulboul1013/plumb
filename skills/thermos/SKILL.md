---
name: thermos
description: "Launch both thermo-nuclear review subagents in parallel, then synthesize their findings. Use for thermos, double thermo review, or combined bug/security and code-quality branch audits."
---

# Thermos

Run the two thermo review passes as async background subagents in parallel, then synthesize their results.

## Workflow

1. Determine the review scope from the user request, PR, current branch, or relevant changed files.
2. Gather the diff with `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-diff.mjs" <base>`, which includes uncommitted and untracked work, and any file/context excerpts needed for reviewers to evaluate the change without guessing.
3. Launch both subagents in the same message with `run_in_background: true`:
   - `subagent_type: "plumb:thermo-nuclear-review-subagent"` for bugs, breakages, security, devex regressions, feature-flag leaks, and other branch-audit risks.
   - `subagent_type: "plumb:thermo-nuclear-code-quality-review-subagent"` for maintainability, structure, file-size growth, spaghetti, abstractions, and codebase-health risks.

   Set `model` on both to the thermos reviewers model in [Models](#models). If the `Agent` tool rejects a model, use the closest valid slug of the same family from its error. Only when there is none, omit `model` so the subagent runs on the parent model. Say so either way. Set each subagent's `effort` field for the job, and keep the model. Start from the session's level. Raise it one step for the hardest or subtlest work, lower it one step for judgment, and lower it two or more steps for routine work. Verification keeps the session's level. If the `Agent` tool rejects a level, omit `effort` and say so.
4. Pass each subagent the same scoped diff/file context and ask it to return prioritized findings with file references and evidence.
5. After both finish, synthesize the results with findings first, deduplicated across reviewers. Weight overlapping findings more heavily, resolve disagreements with your own judgment, and keep summaries brief.

If individual background summaries are already visible to the user, do not restate them wholesale. Surface the unified verdict, the highest-signal findings, and any remaining uncertainty.

## Models

- thermos reviewers: `opus`

Otherwise pass a different model only when the user names one.
