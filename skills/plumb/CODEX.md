# Run Plumb on Codex

Use Codex's skill picker or mention the skill by name, for example `$plumb:help`. The `/plumb:help` form in shared instructions is Claude Code syntax. Treat a direct request for the named skill as an invocation. Use the interactive question and plan tools when the session provides them.

## Scripts

The plugin root is two directories above any loaded `skills/<name>/SKILL.md`. Use the installed skill's path, or the root printed by SessionStart, to resolve it. If the shell does not have `PLUGIN_ROOT` or `CLAUDE_PLUGIN_ROOT`, substitute the quoted absolute plugin path in command examples. Keep the shell's working directory in the project being worked on.

## Subagents

- Treat the lane's agent names as role descriptions. Use Codex's subagent tool with a fresh context and include an absolute path to the matching role file under the plugin's `agents/` directory (for example `agents/plumb-reviewer.md`) in the brief. Use the Markdown body as role instructions. Include the skill file if the worker needs to run a skill. For a generic worker use the normal default role. Follow the session's delegation rules and record any adjustments.
- For build work, the parent creates a dedicated branch and linked worktree from the exact base commit before spawning. Pass the absolute worktree path, branch, and base in the brief. The builder must verify its worktree and base before writing, and use that worktree for every command and file edit. Apply the builder's Git restrictions from its role file. If a distinct worktree cannot be used, keep the work in the parent and mark the lane step adjusted. Follow the lane's merge and worktree cleanup rules.
- Use Codex's available model and reasoning settings. When a step calls for different models, choose distinct available Codex models if the session permits model overrides. Otherwise use the defaults and report any reduced model coverage. Start workers and wait with the tools available in the session.
- Codex's Stop hook validates a final reply that includes the lane and rigor line. Use commentary for the initial classification and repeat it with the checklist when the task is complete. Report adjustments and skipped steps there. Codex's hook checks checklist entries. Claude Code also checks the role names in its transcript.
