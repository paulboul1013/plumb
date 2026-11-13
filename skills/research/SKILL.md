---
name: research
description: Investigate a question against primary sources in a background subagent and save the cited findings as one Markdown file. Use when a wayfind research ticket or the Investigate lane needs facts from outside the repo, such as official docs or third-party APIs, or when the user asks for a topic to be researched.
---

# Research

Spawn a background subagent to do the reading, so you keep working while it reads. Start it with a fresh context window, never a fork of this session.

Give it the question, the decision that waits on the answer, and the file to write. Its job:

1. **Read primary sources.** Official docs, source code, specs, and first-party APIs. Not a blog post or an answer that summarizes them.
2. **Follow every claim to its owner.** When a page cites another source, read that source. A claim is settled by the source that owns it: the spec for a protocol, the code for a library's behavior, the vendor's docs for an API.
3. **Write one Markdown file** at `.plumb/<slug>/research/<name>.md`. Lead with a short answer to the question. Cite each claim with a link to its source, and the version or date it applies to. Label anything inferred as inferred, and list what it could not confirm.
4. **Post the findings when it resolves a GitHub decision ticket.** Post one resolution comment on the ticket, as [GITHUB.md](../setup/GITHUB.md) shows: the short answer, then the file's content or its key cited claims. Name the config's `Repo` in the command, as the `spec` skill says. It does not close the ticket.

It never pushes a branch and never opens a PR.

When it reports, read the file and check that each claim the decision rests on carries a citation. Report the file's path and the short answer. When the research resolves a decision ticket, the `wayfind` session records the resolution and updates the map.

Adapted from mattpocock/skills `research` (MIT).
