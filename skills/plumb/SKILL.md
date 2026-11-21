---
name: plumb
description: Route an engineering task to the right lane and rigor before work starts. Use at the start of any code change, bug, refactor, design question, investigation, or multi-session build, and for /plumb.
---

# Plumb

Every task runs one **lane** (the steps) at one **rigor** (how heavy each step is). Classify first, then work the lane. On Codex, read [CODEX.md](CODEX.md) for skill invocation, script paths, and subagent setup.

Read `docs/agents/plumb.md` if it exists: tracker, check commands, how to drive the app, glossary location. Its state claims (a count, a phase, a "now") are leads to check against the repo. A claim dated with a commit older than HEAD is history.

If it is missing, infer from `package.json` scripts or the build file, the CI workflow, and `AGENTS.md` or `CLAUDE.md`. For checks, run what CI runs, else the most complete command, such as `npm test`, never a subset of it. Print each inferred value with its source on the line after the classification, such as `checks (from .github/workflows/ci.yml): npm test`, and suggest `/plumb:setup` once in the final reply.

**The glossary** is the repo's existing domain-language file, whatever its name. Look for `GLOSSARY-MAP.md`, `GLOSSARY.md`, `CONTEXT.md`, `docs/glossary*`, and a glossary path in `docs/agents/plumb.md`, `AGENTS.md`, or `CLAUDE.md`, and use the first one that defines domain terms. Create `GLOSSARY.md` only when none exists. Every skill that says "the glossary" means this file.

## 1. Pick the lane

Take the first row that matches.

| Signal | Lane | Steps |
| --- | --- | --- |
| A question. No change wanted. | Investigate | [lanes/investigate.md](lanes/investigate.md) |
| A design question that running code can settle. | Prototype | [lanes/prototype.md](lanes/prototype.md) |
| Something is broken, wrong, slow, or flaky. | Bug | [lanes/bug.md](lanes/bug.md) |
| The structure changes and the behavior must not. | Refactor | [lanes/refactor.md](lanes/refactor.md) |
| New or changed behavior that one session can hold. | Feature | [lanes/feature.md](lanes/feature.md) |
| More than one session of work, or the destination is not clear yet. | Epic | [lanes/epic.md](lanes/epic.md) |
| One file, an obvious check, no design choice. | Direct | Make the change, run the closest check, show its output. |

## 2. Set the rigor

Score the size, then answer each door question on its own.

- **Size.** S stays inside one module. M crosses a module boundary or changes a signature other files call. L spans several subsystems or sessions.
- **Change door.** Two-way if reverting restores the old state. One-way if not: a migration that has run, a file format or public API others already read, anything the shipped code publishes or sends, or auth, security, or money code. Only this door sets the rigor.
- **Design door.** A shape hard to change later even though the code reverts: a schema, public API, file format, permission model, or a name other teams depend on. Run `design` with two or three competing shapes at any rigor, and offer an ADR through `domain`.
- **Action door.** An irreversible action during the task (section 4). It does not raise the rigor. It adds a stop-and-ask gate before that action. Prefer a copy, such as test data you created.

Calling an existing destructive operation is not a one-way change door: a delete button on an existing, permission-checked delete API is two-way. Deleting real data while you prove it is an action door.

A pull request to a repo you do not own runs `review` at Standard or above, even at Light rigor.

| Size | Two-way change door | One-way change door |
| --- | --- | --- |
| S | Light | Standard |
| M | Standard | Strict |
| L | Strict | Strict |

Each lane step names a skill. The rigor decides how it runs.

| Dial | Light | Standard | Strict |
| --- | --- | --- | --- |
| Align | Restate the goal in one sentence. | `align` on the open decisions only. | `align` over the whole design tree, with `domain`. |
| Design | Name the data shape. | `design` with one shape. | `design` with two or three competing shapes. |
| Tests | Run the closest existing check. | `tdd` at the agreed seams. | `tdd`, plus a characterization pin before any edit. |
| Proof | Run it once and show the output. | `prove` on the real surface. | `prove`, plus the same scenario on the base branch. |
| Review | Read your own diff. | `review` on the Standards and Spec axes. | `review` on all axes, plus the adversarial panel. |
| Trail | None. | None. | `trail` records each decision. |

Your first output after reading this skill is the call, as one line, before any edit. Name the design door (`design door: new orders table`) and each action door (`action door: deletes a test note during prove`) when there is one.

```
lane: Feature · rigor: Standard (M, two-way) · design door: no · action door: none · why: adds a field every caller of createOrder reads
```

Re-classify when the evidence changes: a bug fix that crosses three modules is now M, a refactor that changes behavior is now a Feature. Print the new line and say what changed.

### Joining a task already in progress

Earlier choices are not settled just because they were made. Before the lane's first step, list every choice so far and sort each one:

- **A fact or empirical result** already checked: keep it and cite the evidence.
- **A decision the user made outside plumb:** ask it again through `align`, with the earlier answer recommended, so the user confirms it with plumb's later questions in view. If the user wrote it down (request, spec, repo notes), list it as settled with its source in align's goal paragraph instead, so the last round's "Build this?" confirms it.
- **A decision you made on your own** (a default, a scope cut, a design choice): ask it too.
- **Code already written:** a draft that Design and Review may change.

Show the sorted list, then ask the decisions in one `align` round. Mark a step `done-before-plumb: <evidence>` only after the user confirms its decisions.

## 3. Open the todolist

Copy the lane's steps into the todolist verbatim, before any task-specific item. A skipped step stays with `skip: <reason>`. A step run in a lighter or different form carries `adjusted: <what changed>, <why>`, such as `adjusted: deliver stopped at a local commit, the user asked for no PR`.

Use the session's task tool, or else a `todo.md` checklist outside the repo in the scratch or work directory, and give its full path in your reply. When a step finishes, say so in one line: the step and what is next. Show the lane steps as a checklist only in the final reply, because the reply check reads any such checklist as the walked list.

### Subagents

`plumb:plumb-builder` writes the code at Standard and Strict, and `plumb:plumb-reviewer` runs each review axis, so the writer never judges its own code. Every subagent starts with a fresh context, never a fork of the parent session.

A builder commits each green slice with `Green:` and `Next:` in the body. When a builder stops without a report, run `node "${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/worktree-check.mjs" <worktree>` and read `git log <base>..<branch>` for its last checkpoint. Uncommitted drafts are not evidence. Rerun the checkpoint's `Green:` command, then resume that builder or brief a fresh one from the commit with its `Next:` step.

A request for plumb covers the subagents its steps name, so do not ask again. If the environment or the user forbids subagents, write the code yourself and run each review axis in a fresh context, such as a new session, that sees only the diff, its sources, and `${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/agents/plumb-reviewer.md`. Name those steps and why in the final reply.

## 4. Decide who answers each question

- **A fact** about the code, the environment, or history: look it up, with a subagent for a wide search. Never ask the user.
- **An empirical question** (does it work, how fast, how it looks, which approach behaves better): run it, or run the Prototype lane. Never ask the user.
- **A decision the user owns** (product behavior, scope, domain naming, risk appetite, taste): ask through `align`, with your recommended answer.

If the user is away or said to run unattended, take your recommended answer, record it with `trail`, and keep going.

Always stop and ask before an irreversible action: a force-push to a shared branch, a deploy, a data deletion, a message to a customer or another person, a merge.

## 5. Finish

Done means `prove` has evidence from the real artifact and `review` has no open finding at the rigor's level. "It compiles" and "the tests pass" are not proof. At Standard and Strict, `review` always runs, however small the diff. Verify a post-review fix as the `review` skill's Verify fixes section says.

Before the final reply, walk the todolist: every lane step is done, or `adjusted:` or `skip:` with its reason. A step skipped or adjusted without a reason is not done, so go back and do it. Never mark an adjusted step done. Paste the walked list into the final reply.

Open the final reply with the classification line, then: what changed for the user of the code, what you chose and why, the proof (paste the output), the evidence directory (`.plumb/<slug>/evidence/`, written by `record.mjs` as `prove` says), each adjusted or skipped step that lowers confidence, and any decision still waiting on the user.

Builders write no evidence in their worktree, since removing it deletes ignored files. After merging a builder's branch, record its proof in the main checkout: rerun the proof through `record.mjs`, or save the builder's pasted output with `record.mjs <slug> <name> --note`, and say which each log is.

## 6. Log your own failures

When you fix a mistake you made, log it right then:

```bash
node "${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/failure-log.mjs" add --context "..." --cause "..." --fix "..." --lane <lane> --skill <skill> --tag <kind>
```

Log it when the user corrects you, when a check, `prove`, or `review` catches an error you introduced, or when you throw away and redo an approach you chose. Do not log a pre-existing failure, a flaky test, or the user changing their mind. Context is what you were doing and what went wrong, cause is why (a wrong assumption, missing information), fix is what you changed. Write it in the user's language. The script fills in the time, repo, branch, commit, and session. The log is local, outside every repo, so it needs no approval. `/plumb:retro` reads it later.

## Skills

Model-invoked. The lanes call these.

- `align`: interview the user on decisions, one frontier per round.
- `domain`: keep the glossary and ADRs current.
- `design`: shape the module (data shape, interface, seam) before code.
- `improve-codebase-architecture`: find deepening opportunities, report them as HTML, align on one for the Refactor lane.
- `wayfind`: chart a foggy destination as decision tickets and resolve them one at a time.
- `research`: read primary sources outside the repo in a background subagent and save cited findings.
- `wiki`: read and file dated, commit-cited pages about the repo, so the next session does not re-derive it.
- `spec`: write the agreed design as a spec on the tracker.
- `tickets`: split a spec into tracer-bullet tickets with blocking edges.
- `implement`: build one ticket or feature test-first, then prove and review.
- `orchestrate`: build a ticket graph with parallel builders on one integration branch.
- `tdd`: the red-green loop at agreed seams.
- `diagnose`: a loop that goes red on the bug, then hypotheses, then the fix.
- `prove`: show the change works on the real surface.
- `review`: review a diff on separate axes in separate subagents.
- `deliver`: shape the commits and the PR body.
- `trail`: a decision log for long or unattended work.
- `help`: which lane, skill, or command fits, and how to steer a run. No lane calls it; it runs when the user asks how to use plumb or types `/plumb:help`.

Also model-invoked. No lane calls these six; they run when the user asks or the request matches.

- `arena`: parallel candidates at one task, pick a base, graft the best of the rest.
- `interrogate`: adversaries try to break a change or design; only findings proven by a run survive.
- `swarm`: fan out parallel workers and return one report.
- `thermos`: both thermo-nuclear reviews in parallel, synthesized.
- `thermo-nuclear-review`: security and correctness audit of a branch diff.
- `thermo-nuclear-code-quality-review`: strict maintainability audit of abstractions, giant files, and spaghetti growth.

User-invoked. Only the user types these.

- `/plumb:setup`: configure tracker, checks, and the run surface for this repo.
- `/plumb:retro`: turn the session's mistakes into checks and standards.
- `/plumb:handoff`: write a handoff file for another session or person.
- `/plumb:sharpen`: make a task deeper, not bigger, and rewrite its prompt.
- `/plumb:ketchup`: catch the user up and list what waits on them.
