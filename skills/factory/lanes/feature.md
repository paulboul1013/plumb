# Feature lane

New or changed behavior that one session can hold. You own the design. Delegate the typing, keep the judgment.

1. **Ground.** Read `GLOSSARY.md` and the ADRs in the area. Map the entry points, the callers, the tests that cover them, and the check commands. Send an Explore subagent when the map needs more than a few files.
2. **Align.** Run `align` at the rigor's depth. The output is one paragraph of goal, a numbered acceptance list, and an out-of-scope list. Run `domain` when a term was resolved or a hard-to-reverse choice was made.
3. **Design.** Run `design`. Name the data shape and its organizing structure, the module interface, and the seams the tests will use. Get the user's yes on the seams at Standard and Strict.
4. **Plan the throughput.** Write four lines: the blocking first steps, the workstreams that touch disjoint files, the shared state and how you split it, and the smallest safe decomposition. One builder is often right. Say why.
5. **Build.** Run `implement` with the acceptance list and the seams. At Standard and Strict, give the code-writing to a `factory:factory-builder` subagent with file paths, the data shape, the seams, and the success criteria. Review separation is the point, so do not skip it to save lines.
6. **Prove.** Run `prove` on the surface a user touches.
7. **Review.** Run `review` against the acceptance list as the spec. Fix each finding, then prove again.
8. **Deliver.** Run `deliver`.

**Reply.** What the user of the code can now do, the shape you chose and the one you rejected, the proof output, and open decisions.
