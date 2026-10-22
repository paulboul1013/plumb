# Bug lane

A reported defect. Every shipped line traces to runtime evidence. A change that "might help" is a hypothesis, not a fix, and it does not ship.

1. **Diagnose.** Run `diagnose`. No hypothesis before one command goes red on the user's exact symptom.
2. **Re-classify.** Now that the cause is known, score size and door again. A cause that crosses module boundaries raises the rigor. Print the new line.
3. **Fix at the root.** Fix where the cause lives, not where the symptom shows. A guard that hides the crash is not a fix. If the fix crosses a function boundary, run `design` first.
4. **Lock it.** Land the regression test before the fix in history when a correct seam exists. If no correct seam exists, write that down as a finding for `/factory:retro`.
5. **Prove.** Re-run the original, un-minimised loop from step 1 and show red then green.
6. **Review.** Run `review` with the bug report as the spec.
7. **Deliver.** Run `deliver`. The PR body names the hypothesis that turned out true.

**Reply.** What was broken, the root cause, the fix, and the failing-then-passing output pasted verbatim.
