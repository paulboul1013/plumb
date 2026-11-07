---
name: review
description: Review a diff since a fixed point on separate axes (Standards, Spec, Proof), each in its own subagent, with an adversarial multi-model panel at Strict rigor. Use after implementing, before a PR, or when the user asks to review a branch, PR, or work in progress.
---

# Review

Each axis runs in its own subagent so one axis cannot mask another. Code that follows every standard can still build the wrong thing.

## 1. Pin the fixed point

Use the ref the user or lane gave (a SHA, branch, tag, or `main`). The diff command is always:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-diff.mjs" <ref>
```

It covers commits since `<ref>`, staged and unstaged edits, and new untracked files, so work that is not committed yet still gets reviewed. Do not hand reviewers `git diff <ref>...HEAD`: it sees commits only, and returns nothing for uncommitted work. Run the command once here. It fails on a bad ref or an empty change, so the problem shows up now, not inside the subagents. Add `--files` for the list of changed paths. Note `git log <ref>..HEAD --oneline`.

## 2. Gather the sources

- **Spec.** The ticket, the spec, or the acceptance list. Look in commit messages for issue refs, then the lane's context, then `.plumb/` and `docs/`. If there is none, the Spec axis reports "no spec" and skips.
- **Standards.** Every file in the repo that says how code is written: `CODING_STANDARDS.md`, `CONTRIBUTING.md`, lint configs, ADRs. Plus the smell baseline below.
- **Proof.** The `prove` output for this change.
- **Check results.** Before spawning reviewers, the parent runs each of the repo's checks once at HEAD and records each check's exact command, its result, and the commit SHA it ran on. Skip a check already recorded for that command and SHA. If the tree is dirty, run the checks on it and also record the digest of the step 1 diff: `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-diff.mjs" <ref> | sha256sum`. Give this source to every axis. A recorded check result is evidence, unlike the verdicts step 3 forbids.

## 3. Run the axes in parallel

Run the axes the router's rigor table names, or the axes the caller limits this review to. With neither, run all three. At Light rigor, read your own diff instead of spawning reviewers. Spawn one `plumb:plumb-reviewer` subagent per axis in the same message. If subagents are not allowed, run each axis in a fresh context that sees only the diff, that axis's sources, and the rules in `${CLAUDE_PLUGIN_ROOT}/agents/plumb-reviewer.md`, as the plumb skill's Subagents section says. Give each the `review-diff.mjs` command from step 1, the commit list, and only its own sources. Do not add your own verdict: no "this looks fine", no "I already handled X", no list of what you think is risky. The reviewer judges the diff from the sources alone. Each report stays under 400 words and quotes the hunk or spec line for every finding.

- **Standards.** Every breach of a documented standard, citing the file and rule. Every baseline smell, labelled as a judgement call. A documented repo standard overrides the baseline. Skip what tooling already enforces.
- **Spec.** Requirements missing or partial. Behavior nobody asked for. Requirements that look done but are done wrong.
- **Proof.** Acceptance items with no evidence. Evidence from the wrong surface. Evidence that could not have gone red. Tests that would still pass with the behavior broken.

## 4. Strict rigor: the adversarial panel

Skip this panel when the caller limits the review to named axes. Otherwise add two more `plumb:plumb-reviewer` subagents on different models, with the step 2 check results, (for example `opus` and `sonnet`), each told to find the strongest reason this change should not merge: a broken caller outside the diff, a race, a one-way change door without a rollback, a security hole, a change to how developers run or build the code (where secrets are read from, environment variable names, ports, a new script that must run), or a feature that leaks past its flag or internal-only check. A finding both models raise is high-signal. A finding only one raises needs evidence before it counts.

Each adversary runs at most 30 probes and stops after 10 in a row that find nothing new. A probe is one small program or command, and any file it writes goes outside the repo. Report only findings a run proved, unless the change cannot be run, such as prose, and then mark the finding as inferred from reading. Leave style to the Standards axis. Say how many probes ran and what went unprobed.

## Smell baseline

Each is a hint, never a hard rule.

- **Mysterious name.** The name does not say what it holds or does. Rename it.
- **Duplicated code.** The same shape in two hunks. Extract it.
- **Feature envy.** A function that uses another module's data more than its own. Move it there.
- **Data clump.** The same fields travel together. Make them one type.
- **Primitive obsession.** A string or number stands in for a domain concept. Give it a type.
- **Repeated switch.** The same branch on the same type in several places. One table or one polymorphic call.
- **Shotgun surgery.** One change forces edits across many files. Gather what changes together.
- **Speculative generality.** Parameters, hooks, or layers no requirement needs. Delete them.
- **Middle man.** A module that only forwards. Call the target directly.
- **Comment as apology.** A comment that explains confusing code instead of the code being clear, or narrates what the next line does. Fix the code and delete the comment. Keep only comments that give a reason the code cannot show. A comment that states a rule of a dependency, platform, vendor, or protocol is such a reason, even when it reads like narration, because the rule lives in that system's docs, not in this repo. Flag it for deletion only with the documentation page or source file that refutes the rule. Otherwise report it as `HOLD`, name where to check, and leave it in place.

## 5. Report

Show each axis under its own heading, lightly cleaned. Do not merge or rerank across axes. End with one line per axis: the count and the worst finding.

Then fix. Every finding is fixed, or dismissed with a concrete reason.

## 6. Verify fixes

Run `prove` again. At Light rigor, read your own diff and stop there. If the repo has a build, first confirm it succeeds at the new head: a failed build can leave an old artifact in place that still passes. Then match the verification to the fix, measured since the reviewed commit:

- New behavior, a redesign, or a large new diff gets `review` again.
- A minor fix, including a rename, gets one `plumb:plumb-reviewer` on `review-diff.mjs <reviewed commit>`, given the findings the fix claims to close as claims to check. If the reviewed work was uncommitted, give the verifier the whole diff.
- A change that alters no behavior or instruction, such as a typo or a comment, gets no reviewer.
