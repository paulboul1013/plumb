---
name: wiki
description: Read and write the repo's wiki of dated, commit-cited pages, so the next session does not re-derive the architecture. Use before answering how or why a part of the repo works, and whenever you learn a durable fact about the repo, such as a subsystem, a runtime flow, a recurring problem, a convention, or a user preference about this repo.
---

# Wiki

## Location

Look for an existing wiki first, in this order:

1. The path after `Wiki:` in `docs/agents/plumb.md`.
2. `docs/wiki/`, then `wiki/`.
3. A folder that `AGENTS.md` or `CLAUDE.md` names and that holds an `index.md` of interlinked pages.

Use the one you find, and follow its conventions where they differ from this skill. If there is none, use `docs/wiki/`, committed so the team sees it. Create it only when you write the first page: no empty scaffold and no up-front map of the whole repo. When you create it and `docs/agents/plumb.md` exists, record `Wiki: docs/wiki/` under its `## Domain docs`.

## Layout

One flat folder: `index.md` plus one `<slug>.md` per page. Categories are only `##` headings inside `index.md`:

```markdown
# Wiki

## Subsystems

- [Retro](retro.md): how retro turns session mistakes into checks.
```

Each entry is exactly that shape: a bullet, the page title linked to `slug.md`, a colon, and a one-line summary.

One page covers one thing: a subsystem, a runtime flow, a recurring problem, a convention, or a user preference about this repo. Link related pages to each other with relative links.

## Boundaries

Term definitions belong in the glossary, and hard-to-reverse decisions belong in ADRs, both kept by the `domain` skill. A page links to them and never copies them. Cite sources such as issues, PRs, transcripts, subagent reports, and code by link, path, or commit. Never paste them in.

## Write history, not the present

A page records what was true at a commit, so each claim is one bullet that starts with its date. A claim about code cites the commit it was true at:

```markdown
- 2026-11-21, as of `abc1234`: retro loads the failure log before it reads the transcript.
```

Never write currently, now, or "is" about code without a date or commit on that line. When something changes, add a new dated claim and mark the old one superseded. Never rewrite it:

```markdown
- ~~2026-11-01, as of `def5678`: the stop gate runs on every reply.~~ superseded 2026-12-01
- 2026-12-01, as of `abc1234`: the stop gate runs only on a final reply.
```

## Query

Before you answer or decide about the repo, read `index.md` and the pages it points to for the question. Treat every claim as a lead to check against the code at HEAD, since it describes a past commit. When the code disagrees, the code wins, and you Ingest the change.

## Ingest

When you learn a durable fact, update every page it touches and the index, not only a new page. Add the claim to the page that owns the topic, supersede any claim it overtakes, add links between pages it connects, and add or update the page's index entry. Skip a fact that only matters to this one task.

## Lint

After every write, run:

```bash
node "${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/check-wiki.mjs" <wiki-dir>
```

Fix each line it prints until it prints `ok`. It checks that every page is in the index, every index entry matches the format and points at a page, every relative link resolves, and every present-tense line carries a date or commit. Then read the pages you touched for what no script sees: two claims that contradict each other, and a claim that a newer source overtook without being superseded.
