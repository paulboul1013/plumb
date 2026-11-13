---
name: wayfind
description: Chart a foggy destination as a map of decision tickets, then resolve them one at a time until the way is clear. Use when the Epic lane's first step says wayfind, or when a large effort cannot yet say what done looks like.
---

# Wayfind

Some work is too big for one session and wrapped in fog: the way from here to the **destination** is not visible yet. Wayfinding finds that way. It does not charge at the destination.

The output is decisions, not code. A **map** lists the decisions made so far. Each open question is a **decision ticket**: a ticket whose output is a decision, not a slice of a build. The map is done when nothing is left to decide, and the Epic lane goes on to its step 2.

The pull to just do the work is the sign you have reached the edge of the map. Stop and hand off.

## Two modes

- **Chart the map.** The user brings a loose idea. Name the destination, chart the questions, and create the map and its first tickets. Charting resolves nothing.
- **Work through the map.** The user brings a map, and maybe a ticket. Resolve one ticket, record it, and update the map.

Never resolve more than one ticket per session. Research tickets are the exception: they run in subagents, so several can resolve in parallel.

## Refer by name

Every map and ticket has a name: its title. In everything the user reads, refer to it by that name, never by a bare id, number, or file name. Put the id inside the link: the text is the name, such as "Pick the cart store", and the target is the ticket's file or issue URL. A list of `#42, #43, #44` is hard to read. Names read at a glance.

## The map

The map is an **index**, not a store. A decision lives in one place only: its ticket. The map gives a one-line gist and a link, and never restates the decision. Open tickets are not listed on the map. They are found by query, or by the check script's `--frontier`.

The map has five sections:

```markdown
## Destination

<what reaching the end of this map looks like: the spec, the decision, or the change. One or two lines.>

## Notes

<the domain, the skills every session should run, and standing preferences for this effort>

## Decisions so far

- [<ticket title>](<link>): <one-line gist of the answer>

## Not yet specified

<the fog: in-scope questions you can see coming but cannot state precisely yet>

## Out of scope

- [<ticket title>](<link>): <gist, and why it is past the destination>
```

## Fog or ticket?

The test is whether you can state the question precisely now. It is not whether you can answer it now.

- **Ticket** when the question is sharp, even if it is blocked and nobody can act on it yet.
- **Not yet specified** when you cannot phrase it that sharply yet. Do not cut the fog into ticket-sized pieces. One patch of fog may become several tickets, or none, once the frontier reaches it.

Not yet specified never holds what is already decided, what is already a ticket, or what is out of scope.

## Out of scope

The destination fixes the scope. Work past it is out of scope, not fog. When an existing ticket turns out to sit past the destination, close it as out of scope and add one line to the map's Out of scope section: the gist, why it is out, and a link to the ticket. Keep it out of Decisions so far, which records only the route you walked. An out-of-scope ticket never comes back. If the destination changes, start a new effort.

## Ticket types

Each ticket is **HITL** (worked with the user, who speaks for themselves) or **AFK** (driven by the agent alone). A HITL ticket resolves only through that live exchange. The agent never answers the user's side.

- **research** (AFK). A fact that a decision waits on, found in docs, third-party APIs, or other sources outside the repo. Spawn a subagent with a fresh context window that runs the `research` skill. When it reports, record the resolution and update the map as steps 5 to 7 of Work through the map say. On GitHub its comment is the resolution comment, so close the issue without a second one.
- **prototype** (HITL). A question about how something should look or behave. Run the Prototype lane and link the prototype from the ticket.
- **align** (HITL). A decision the user owns. Run `align` with `domain`. This is the default type.
- **task**. Manual work that must happen before a decision can be made, such as signing up for a service to judge its API, or getting access. Do it yourself where you can. Otherwise give the user a precise checklist. The resolution records what was done and any facts later tickets need, such as where the credentials live.

## Local layout

The map is `.plumb/<slug>/map.md`. Decision tickets are files at `.plumb/<slug>/decisions/<NN>-<slug>.md`, numbered from `01` with blockers first, so every blocker has a lower number.

```markdown
# 03: <title>

**Type:** research | prototype | align | task
**Blocked by:** 01, 02
**Status:** ready | in-progress | done | out-of-scope

## Question

<the decision this ticket resolves>

## Resolution

<written when done: the answer, and links to assets>
```

`**Blocked by:**` is `None` for a ticket that can start now. An out-of-scope ticket unblocks the tickets behind it, as a done one does.

## GitHub layout

The map is an issue labelled `plumb:map`. Each ticket is a sub-issue of the map, labelled with exactly one of `plumb:research`, `plumb:prototype`, `plumb:align`, or `plumb:task`. The body holds `## Question`. The tracker holds the title, the blocking links, and the state. A closed ticket is done, and one closed as not planned is out of scope.

Follow [GITHUB.md](../setup/GITHUB.md) for every command: creating the labels once, creating and attaching issues, blocking links, labels, claiming, and closing. Name the config's `Repo` in every command that writes, as the `spec` skill says.

## Check the map

After every change to the map or its tickets, run the check and fix every line it prints:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" .plumb/<slug>/decisions
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" --github <Repo> <map-issue>
```

It checks each ticket's type, Question, and Resolution, the blocking order, and that the map has a Destination and a pointer to every done and every out-of-scope ticket. `--frontier` lists the tickets ready to start.

## Chart the map

1. **Name the destination.** Run `align` with `domain` on the destination alone. The destination fixes the scope, so it is settled first.
2. **Chart the questions.** Run `align` again, breadth-first: fan out across the whole space rather than deep on one thread. Sort what surfaces into tickets and fog with the test above.
3. **No fog, no map.** If the way to the destination is already clear, stop. Say the Epic lane can go straight to step 2.
4. **Create the map.** Destination and Notes filled in, Decisions so far empty, and the fog in Not yet specified.
5. **Create the tickets** you can state now. On GitHub, create every issue first, then wire the blocking links in a second pass, because a link needs a real id. Write cross-references in that pass too, with real ids: a placeholder `#<n>` links to an unrelated issue.
6. **Start the research.** For each research ticket, claim it and spawn its subagent now, in parallel. Record each one as it reports.
7. Run the check, then stop. Charting resolves no other ticket.

## Work through the map

1. **Load the map.** Read the map, not every ticket body.
2. **Choose a ticket.** Use the one the user named. Otherwise take the first ticket on the frontier.
3. **Claim it before any work.** Set a local ticket's status to `in-progress`. On GitHub, assign it to yourself. Other sessions may work the map at the same time, and the claim makes them skip it.
4. **Resolve it** as its type says. On GitHub, read the type from the label: the body never states it. Read any related ticket in full when you need it, and run the skills the map's Notes name.
5. **Record the resolution.** On a local tracker, write the answer under `## Resolution` and set the status to `done`. On GitHub, post the answer as a comment, then close the issue. Link assets, such as a research file or a prototype branch. Do not paste them in.
6. **Update the map.** Append a pointer to Decisions so far. Graduate any fog the answer made sharp into new tickets, and delete that patch from Not yet specified. Create new tickets, then wire their blockers. Rule out of scope any ticket the answer pushed past the destination. Update or delete tickets the answer made wrong.
7. Run the check and fix every line it prints.

When nothing is left to decide (no open tickets, nothing in Not yet specified), the map is done. Hand off to the Epic lane's step 2, with the map as the source of the settled decisions.

Adapted from mattpocock/skills `wayfinder` (MIT).
