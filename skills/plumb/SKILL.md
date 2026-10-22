---
name: plumb
description: Route an engineering task to the right lane and rigor before work starts. Use at the start of any code change, bug, refactor, design question, investigation, or multi-session build, and for /plumb.
---

# Plumb

Every task runs one **lane** at one **rigor**. The lane is the sequence of steps. The rigor sets how heavy each step is. Classify first, then work the lane.

Read `docs/agents/plumb.md` if it exists. It names the issue tracker, the check commands, and how to drive the app. If it is missing and the lane needs one of those, run `/plumb:setup` or infer them from the repo and say what you inferred.

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

Score the task on two axes.

- **Size.** S stays inside one module. M crosses a module boundary or changes a signature that other files call. L spans several subsystems or sessions.
- **Door.** Two-way means a revert undoes it. One-way means it does not: a schema or data migration, a public API or file format, auth, security, money, deleted data, anything published or sent.

| Size | Two-way door | One-way door |
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
lane: Feature · rigor: Standard (M, two-way) · why: adds a field every caller of createOrder reads
```

Re-classify when the evidence changes. A bug whose fix crosses three modules is now M. A refactor that turns out to change behavior is now a Feature. Print the new line and say what changed.

## 3. Open the todolist

Copy the lane's steps into the todolist verbatim before any task-specific item. A step you skip stays with `skip: <reason>`. Use the session's task tool, or a `todo.md` checklist in the work directory if none exists.

## 4. Decide who answers each question

Before you ask the user anything, sort the question.

- **A fact** about the code, the environment, or history. Look it up. Send a subagent for a wide search. Never ask the user.
- **An empirical question.** Does it work, how fast is it, what does it look like, which approach behaves better. Run it, or run the Prototype lane. Never ask the user.
- **A decision the user owns.** Product behavior, scope, naming in the domain, risk appetite, taste. Ask through `align`, with your recommended answer.

If the user is away or said to run unattended, take your recommended answer, record it with `trail`, and keep going.

Always stop and ask before an irreversible action: a force-push to a shared branch, a deploy, a data deletion, a message to a customer or another person, a merge.

## 5. Finish

A task is done when `prove` has evidence from the real artifact and `review` has no open finding at the rigor's level. "It compiles" and "the tests pass" are not proof on their own. At Standard and Strict, `review` is not optional, however small the diff looks.

Before the final reply, walk the todolist. Every lane step is done or carries `skip: <reason>`. A step skipped without a reason is not done, so go back and do it.

Open the final reply with the classification line, then give a short account: what changed for the user of the code, what you chose and why, the proof (paste the output), and any decision still waiting on the user.

## Skills

Model-invoked. The lanes call these.

- `align`: interview the user on decisions, one frontier of questions per round.
- `domain`: keep `GLOSSARY.md` and ADRs current as terms and hard decisions settle.
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

User-invoked. Only the user types these.

- `/plumb:setup`: configure tracker, checks, and the run surface for this repo.
- `/plumb:retro`: turn the session's mistakes into checks and standards.
- `/plumb:handoff`: write a handoff file for another session or person.
