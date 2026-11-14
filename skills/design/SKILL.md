---
name: design
description: Shape the code before writing it. Name the data shape, design a deep module with a small interface, and choose the seams tests will use, with competing sketches at Strict rigor. Use when a change crosses a function boundary, adds a module, or when the shape is in question.
---

# Design

Get the data structures and the interface right, and the code that follows becomes obvious.

## Vocabulary

Use these words exactly.

- **Module.** Anything with an interface and an implementation, at any scale.
- **Interface.** Everything a caller must know: types, invariants, ordering, error modes, configuration, performance.
- **Depth.** Behavior per unit of interface. A deep module hides a lot behind a little. A shallow one has an interface almost as big as its body.
- **Seam.** The place where behavior can change without editing there. Tests live at seams.
- **Adapter.** The concrete thing that fills a seam.
- **Leverage.** What callers get from depth: more capability per unit of interface they learn, paid back across every call site and test.
- **Locality.** What maintainers get from depth: change, bugs, and knowledge concentrate in one place instead of spreading across callers.

Principles:

- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If it reappears across callers, it earns its place.
- **The interface is the test surface.** Callers and tests cross the same seam. Needing to test past the interface means the module has the wrong shape.
- **One adapter means a hypothetical seam, two adapters a real one.** Add a seam only when something actually varies across it.

## Steps

1. **Write the caller first.** Sketch the code a caller would write to use the change. The interface comes from that usage, not the other way round.
2. **Name the data shape and its organizing structure.** Pick the structure that removes branches: a state machine instead of scattered booleans, a table or registry instead of an `if` cascade, a typed model instead of a shape assumed across files, a union whose invalid states cannot be built.
3. **Sketch the interface** as types and signatures with bodies left as `not implemented`. Prefer fewer entry points, simpler parameters, and more hidden inside.
4. **Pick the seams.** Prefer existing seams to new ones and the highest seam that reaches the behavior. One seam is ideal. For each seam, write one line on what a test there catches and what it misses.
5. **Screen the sketch.** Reject it if a caller must know the module's internal rules, if the same field cluster travels through many signatures, if it adds a layer that only forwards calls, or if it needs casts or always-set optional fields to compile.

## Competing sketches (Strict)

At Strict rigor, or when the shape has no precedent in the codebase, produce two or three structurally different sketches, not variations of one. Spawn them as parallel subagents on different models (for example `opus` and `sonnet`) with the same brief. Compare them on interface depth and on how many files a typical change would touch. Take the best one, graft in what the others did better, and record the rejected shapes in one line each.

## Scrap signal

During implementation, throw the sketch away when the same workaround shows up in unrelated places, when edge cases each need their own branch, or when types need escape hatches. Redesign as if the new constraint had been there from day one, smaller before it grows.

## Output

The usage sketch, the types and signatures, the seams with their one-line notes, and the rejected shapes. Show the seams to the user at Standard and Strict and get a yes before tests are written. Ask it in `align`'s last round when the seams are clear by then, so the user confirms the plan once. Otherwise ask it as one question, with the seams as the recommended answer.
