---
name: domain
description: Build and sharpen the project's domain language in the repo's glossary (GLOSSARY.md, CONTEXT.md, or whatever the repo already uses) and record hard decisions as ADRs. Use when a term is fuzzy or overloaded, when code and talk disagree on a concept, or when writing a GLOSSARY.md or ADR.
---

# Domain

A shared language makes every later step shorter: questions, specs, ticket titles, names in code. Reading the glossary for vocabulary is a habit every skill has. This skill is for changing it.

## Layout

Use the glossary file the router found (see the plumb skill), whatever its name. Never start a second glossary beside an existing one. With no existing file, one context means `GLOSSARY.md` and `docs/adr/` at the repo root. Several contexts: a root `GLOSSARY-MAP.md` that points at each context's own `GLOSSARY.md` and `docs/adr/`. Create a file only when you have the first thing to put in it.

## During the work

- **Challenge.** When the user uses a term against its glossary meaning, say so at once. "The glossary says a Cancellation voids the whole Order. You seem to mean one line item. Which is it?"
- **Sharpen.** When a word does two jobs ("account" for both Customer and User), propose one canonical term per job.
- **Stress-test.** Invent a concrete edge case that forces the boundary between two concepts.
- **Check the code.** When the user states how something works, read the code. Surface a contradiction.
- **Write it now.** Update the glossary the moment a term settles. Use [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md). The glossary holds definitions only, never implementation detail or plans.

## ADRs

Offer an ADR only when all three hold: the choice is hard to reverse, a future reader would wonder why, and there was a real alternative. Use [ADR-FORMAT.md](ADR-FORMAT.md). A design door or a one-way change door from the router almost always qualifies.
