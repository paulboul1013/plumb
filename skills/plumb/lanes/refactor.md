# Refactor lane

The structure changes. The behavior does not. If the cleanup finds a bug or a missing feature, split it out and ship the structural change first.

When the target is not known yet, run `improve-codebase-architecture` first.

1. **Pin the behavior.** Before any structure moves, capture current behavior with a characterization test, a snapshot, or an equivalence script. Type checks and lint are not a pin.
2. **Name the target shape.** Use `design`. State the module layout, the interfaces, and the call graph as if you built it today. The new shape must delete branches, layers, or invalid states. A refactor that adds indirection without deleting anything does not earn its place.
3. **Subtract first.** Delete dead code, one-caller wrappers, redundant checks, and stale references before you add the new shape.
4. **Move in small green steps.** Each step keeps the pin green. For an API change, migrate every caller and delete the old API in the same wave. No compatibility shims. A rename that fans across the codebase runs expand, migrate in batches, then contract, as `tickets` describes.
5. **Prove equivalence.** Run the pin, and for a large reshape run a script that diffs old and new outputs on the same inputs.
6. **Keep it only if it reads better.** Count the layers a reader crosses to answer one question, before and after. If nothing got simpler, revert.
7. **Review and deliver.** Run `review`, then `deliver` with a subtraction commit first, then the reshape.

**Reply.** The structure that changed, the pin, the equivalence proof, what got simpler for the next reader, and anything you reverted.
