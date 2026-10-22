---
name: tdd
description: Test-driven development as a red-green loop at agreed seams, one vertical slice at a time, with tests that catch real defects. Use when building or fixing behavior test-first, when the user mentions TDD or red-green, or when implement calls it.
---

# TDD

Red, then green, one slice at a time. Read `GLOSSARY.md` so test names use the domain's words.

## Test only at agreed seams

A **seam** is the public interface where behavior is observable. Write tests only at seams the user has agreed to, which come from the `design` skill or the ticket. If none were agreed, propose them with one line each on what they catch and miss, and wait for a yes.

## The loop

1. **Red.** Write one test for the next behavior. Run it. Watch it fail for the reason you expect. A test that passes before the code exists proves nothing.
2. **Green.** Write only enough code to pass it. No speculative features.
3. **Repeat** with the next behavior. Let each cycle's lesson shape the next test.

Do not write all the tests first. Bulk tests describe imagined behavior and lock in structure before you understand it. Refactoring happens in review, not inside the loop.

## Is the test worth keeping

Judge each test against two imagined edits.

- **Break the behavior.** Return a wrong value, skip an effect, or do it twice. The test must fail. If it still passes, its assertion is looser than the contract, or its expected value came from the code under test.
- **Change the internals.** Keep every observable result and restructure underneath. The test must still pass. If it fails, it is pinned to the implementation.

Keep tests that pass both checks. Take expected values from the requirement or a worked example, never from a run of the code. Mock only at system boundaries, such as the network, the clock, or a third-party API.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking rules.
