---
name: plumb
description: Route an engineering task to the right lane and rigor before work starts. Use at the start of any code change, bug, refactor, design question, investigation, or multi-session build, and for /plumb.
---

# Plumb

Every task runs one **lane** at one **rigor**. The lane is the sequence of steps. The rigor sets how heavy each step is. Classify first, then work the lane.

Read `docs/agents/plumb.md` if it exists. It names the issue tracker, the check commands, how to drive the app, and where the glossary lives.

If it is missing, infer what the lane needs from the repo: `package.json` scripts or the build file, the CI workflow, and `AGENTS.md` or `CLAUDE.md`. For checks, run what CI runs. When CI does not settle it, run the most complete command, such as `npm test`, never a subset of it. Print each inferred value on the line after the classification, with its source, for example `checks (from .github/workflows/ci.yml): npm test`. Suggest `/plumb:setup` once in the final reply so the next run does not have to guess.

**The glossary** is the repo's existing domain-language file, whatever its name. Look for `GLOSSARY-MAP.md`, `GLOSSARY.md`, `CONTEXT.md`, `docs/glossary*`, and a glossary path in `docs/agents/plumb.md`, `AGENTS.md`, or `CLAUDE.md`. Use the first one that defines domain terms. Create `GLOSSARY.md` only when none exists. Every skill below that says "the glossary" means this file.

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

Score the task on size, then ask the three door questions. Each door decides something different, so answer each one on its own.

- **Size.** S stays inside one module. M crosses a module boundary or changes a signature that other files call. L spans several subsystems or sessions.
- **Change door.** Does reverting this change restore the old state? Two-way means yes. One-way means no: a schema or data migration that has run, a file format or public API that others already read, anything published or sent by the shipped code, or code for auth, security, or money, where a bug can leak or lose something a revert cannot bring back. Only this door sets the rigor in the table below.
- **Design door.** Is the shape hard to change later, even though the code reverts? A schema, a public API, a file format, a permission model, or a name other teams will depend on. A design door runs `design` with two or three competing shapes at any rigor, and offers an ADR through `domain`.
- **Action door.** Will you take an irreversible action while doing the task? Deleting data, deploying, force-pushing a shared branch, merging, or sending a message. An action door does not raise the rigor. It adds a gate: stop and ask before that action (section 4). Prefer a copy, such as test data you created yourself.

Code that only calls an existing destructive operation is not a one-way change door. A delete button on an existing, permission-checked delete API reverts cleanly, so it scores two-way. Deleting real data while you prove it is an action door.

| Size | Two-way change door | One-way change door |
| --- | --- | --- |
| S | Light | Standard |
| M | Standard | Strict |
| L | Strict | Strict |

Each lane step names a skill. The rigor decides how that skill runs.

| Dial | Light | Standard | Strict |
| --- | --- | --- | --- |
| Align | Restate the goal in one sentence. | `align` on the open decisions only. | `align` over the whole design tree, with `domain`. |
| Design | Name the data shape. | `design` with one shape. | `design` with two or three competing shapes. |
| Tests | Run the closest existing check. | `tdd` at the agreed seams. | `tdd`, plus a characterization pin before any edit. |
| Proof | Run it once and show the output. | `prove` on the real surface. | `prove`, plus the same scenario on the base branch. |
| Review | Read your own diff. | `review` on the Standards and Spec axes. | `review` on all axes, plus the adversarial panel. |
| Trail | None. | None. | `trail` records each decision. |

Your first output after reading this skill is the call, as one line, before any edit:

```
lane: Feature · rigor: Standard (M, two-way) · design door: no · action door: none · why: adds a field every caller of createOrder reads
```

Name the design door when there is one (`design door: new orders table`) and each action door (`action door: deletes a test note during prove`).

Re-classify when the evidence changes. A bug whose fix crosses three modules is now M. A refactor that turns out to change behavior is now a Feature. Print the new line and say what changed.

### Joining a task already in progress

When plumb starts after work has begun, earlier choices are not settled just because they were made. Before the lane's first step, list every choice made so far and sort each one:

- **A fact or an empirical result** already checked. Keep it, and cite the evidence.
- **A decision the user made outside plumb.** Ask it again through `align`, with the earlier answer as the recommended option, so the user confirms it with plumb's later questions in view.
- **A decision you made on your own**, such as a default, a scope cut, or a design choice. Ask it as well. It never had the user's yes.
- **Code already written.** Treat it as a draft that the Design and Review steps may change.

Show the user the sorted list, then ask the decisions in one `align` round. Mark a lane step `done-before-plumb: <evidence>` only after the user confirms its decisions.

## 3. Open the todolist

Copy the lane's steps into the todolist verbatim before any task-specific item. A step you skip stays with `skip: <reason>`.

Use the session's task tool. If none exists, write a `todo.md` checklist outside the repo, in the session's scratch or work directory, so it never lands in a commit. Give its full path in your reply so the user can open it. When a lane step finishes, say so in one line: the step, and what is next.

### Subagents

Some steps hand work to subagents: `plumb:plumb-builder` writes the code at Standard and Strict, and `plumb:plumb-reviewer` runs each review axis. The point is separation: the agent that wrote the code does not judge it.

When the user asks for plumb, that request covers the subagents its steps name. Do not ask again. If the environment or the user forbids subagents, do the step in the main session and keep the separation another way: write the code yourself, then run each review axis in a fresh context that sees only the diff, its sources, and the rules in `${CLAUDE_PLUGIN_ROOT}/agents/plumb-reviewer.md`, such as a new session. Say in the final reply which steps ran without a subagent and why.

## 4. Decide who answers each question

Before you ask the user anything, sort the question.

- **A fact** about the code, the environment, or history. Look it up. Send a subagent for a wide search. Never ask the user.
- **An empirical question.** Does it work, how fast is it, what does it look like, which approach behaves better. Run it, or run the Prototype lane. Never ask the user.
- **A decision the user owns.** Product behavior, scope, naming in the domain, risk appetite, taste. Ask through `align`, with your recommended answer.

If the user is away or said to run unattended, take your recommended answer, record it with `trail`, and keep going.

Always stop and ask before an irreversible action: a force-push to a shared branch, a deploy, a data deletion, a message to a customer or another person, a merge.

## 5. Finish

A task is done when `prove` has evidence from the real artifact and `review` has no open finding at the rigor's level. "It compiles" and "the tests pass" are not proof on their own. At Standard and Strict, `review` is not optional, however small the diff looks. A fix made after a review is verified as the `review` skill's Verify fixes section says.

Before the final reply, walk the todolist. Every lane step is done or carries `skip: <reason>`. A step skipped without a reason is not done, so go back and do it. Paste the walked list into the final reply, so the user can check it without opening a file.

Open the final reply with the classification line, then give a short account: what changed for the user of the code, what you chose and why, the proof (paste the output), and any decision still waiting on the user.

## Skills

Model-invoked. The lanes call these.

- `align`: interview the user on decisions, one frontier of questions per round.
- `domain`: keep the glossary and ADRs current as terms and hard decisions settle.
- `design`: shape the module (data shape, interface, seam) before code.
- `spec`: write the agreed design as a spec on the tracker.
- `tickets`: split a spec into tracer-bullet tickets with blocking edges.
- `implement`: build one ticket or one feature, test-first, then prove and review.
- `orchestrate`: build a whole ticket graph with parallel builders on one integration branch.
- `tdd`: the red-green loop at agreed seams.
- `diagnose`: a feedback loop that goes red on the bug, then hypotheses, then the fix.
- `prove`: show the change works on the real surface.
- `review`: review a diff on separate axes in separate subagents.
- `deliver`: shape the commits and the PR body.
- `trail`: a decision log for long or unattended work.
- `help`: tell the user which lane, skill, or command fits, and how to steer a run. No lane calls it; it runs when the user asks how to use plumb or types `/plumb:help`.

Also model-invoked. No lane calls these six. They run when the user asks for them or the request matches their description.

- `arena`: run parallel candidates at the same task, pick a base, and graft the strongest parts of the rest.
- `interrogate`: adversaries try to break a change or design, and only findings proven by a run survive.
- `swarm`: fan out parallel workers, drain them, and return one report.
- `thermos`: run both thermo-nuclear reviews in parallel and synthesize their findings.
- `thermo-nuclear-review`: a security and correctness audit of a branch diff.
- `thermo-nuclear-code-quality-review`: a strict maintainability audit of abstractions, giant files, and spaghetti growth.

User-invoked. Only the user types these.

- `/plumb:setup`: configure tracker, checks, and the run surface for this repo.
- `/plumb:retro`: turn the session's mistakes into checks and standards.
- `/plumb:handoff`: write a handoff file for another session or person.
- `/plumb:sharpen`: make a task deeper, not bigger, and rewrite its prompt.
- `/plumb:ketchup`: catch the user up since their last message and list what waits on them.
