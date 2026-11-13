---
name: diagnose
description: Diagnose a hard bug or performance regression by first building one command that goes red on the exact symptom, then minimising, ranking falsifiable hypotheses, and instrumenting until one survives. Use when something is broken, throwing, flaky, or slow, or the user says debug or diagnose.
---

# Diagnose

Read the glossary and the ADRs in the area. Redact every secret in what you show. Write `<REDACTED>` in its place.

## 1. Build the feedback loop

This is the skill. With a tight signal that goes red on this bug, the cause will fall out. Without one, reading code will not save you. Try in roughly this order:

1. A failing test at the seam that reaches the bug.
2. A curl or HTTP script against a running dev server.
3. A CLI run with a fixture input, diffed against a known-good output.
4. A headless browser script that drives the UI and asserts on the DOM, console, or network.
5. A captured request, payload, or event log replayed through the code path.
6. A throwaway harness around the smallest subset of the system.
7. A property or fuzz loop for "sometimes wrong" bugs.
8. A `git bisect run` harness when the bug appeared between two known states.
9. A differential run of the same input through old and new versions.

A comparison (items 3 and 9) proves nothing until it has failed on purpose. Seed one known-bad change for each output it claims to compare, such as one wrong total and, separately, swapped items that keep the same total, and confirm it reports each one. Missing or unread input must make it refuse or say inconclusive, never match. Keep these controls beside the loop and rerun them before you trust a match.

When you force a red by mutating code or a fixture, `diff` the mutated file against a pristine copy and show that the mutation landed before you trust the red. A mutation that never applied leaves the loop red for another reason.

Reproduce it yourself on the surface where the user saw it. Ask the user only for access you cannot get, and only after you went as far as you can.

**Done when** you can name one command, already run and shown, that is red-capable (it asserts the user's exact symptom), deterministic, fast, and runs without a human. For a flaky bug, raise the repro rate (loop it, add load, narrow timing) until it is high enough to debug.

If you cannot build one, stop and say so. List what you tried and ask for an environment, a captured artifact, or permission to add instrumentation. Do not hypothesise without a loop.

## 2. Reproduce and minimise

Confirm the loop shows the user's failure, not a nearby one. Then cut inputs, steps, and config one at a time, re-running after each cut, until every remaining piece is load-bearing.

## 3. Hypothesise

Write three to five ranked hypotheses, each falsifiable: "If X is the cause, changing Y makes it disappear." A hypothesis without a prediction is a guess. Discard it or sharpen it. When something fails only after a restart, rank stale persisted state first: config files, caches, lock files, serialized state. Show the list to the user if they are around, since they may rule some out at once. Do not wait for them.

## 4. Instrument and cut

Test the hypothesis that splits the remaining space most. Change one variable at a time. Prefer a debugger, then targeted logs at the boundaries that tell hypotheses apart. Tag every debug log with one prefix, such as `[DEBUG-a4f2]`. For performance, measure a baseline first, then bisect. When evidence refutes a hypothesis, revert what it motivated.

When two fixes in a row fail on the same assumption, stop. Write the assumption down as one sentence and find an observation that would come out differently if it were false, before the next fix. Look at how the failures are spread (which inputs, hosts, users, or timings), not only how large they are. If the evidence refutes the assumption, look for what the failures share that it did not predict. If it confirms the assumption, ask the next why: the earlier fixes may have treated a consequence. Remove the condition that causes the failure instead of adding a mechanism that cleans up after it.

## 5. Hand back

Return to the Bug lane with the loop command, the minimised repro, the surviving hypothesis and its evidence, and the seam for the regression test, or the finding that no correct seam exists. Add every other place with the same fault, so the fix covers the pattern, not the one instance. If the deciding fact took a deep dig to find, propose the cheap, always-on signal (a log line, a metric, an assertion) that would have shown it at first look.

Before declaring done, remove every tagged log (`grep` the prefix) and delete or clearly mark the throwaway harnesses.
