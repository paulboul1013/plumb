# GitHub tracker commands

The commands the plumb skills use on a GitHub tracker. They work on `gh` 2.45 and later. Newer `gh` (2.94+) also has `--parent` and `--blocked-by` flags, but these REST forms work on both, so use them.

Every command names `<Repo>`, the config's `Repo:` line, as the `spec` skill's Repo rule says.

## Create an issue

```
gh issue create --repo <Repo> --title "<title>" --body-file <file>
```

It prints the issue URL. The number at its end is `<n>`.

## Find an issue's database id

The sub-issue and blocking endpoints take the database id, not the issue number.

```
gh api repos/<Repo>/issues/<n> --jq .id
```

## Attach a ticket to the spec issue

```
gh api -X POST repos/<Repo>/issues/<spec-issue>/sub_issues -F sub_issue_id=<ticket db id>
```

## Mark a ticket blocked by another

```
gh api -X POST repos/<Repo>/issues/<ticket>/dependencies/blocked_by -F issue_id=<blocker db id>
```

`<ticket>` is the blocked issue's number. `<blocker db id>` is the blocker's database id.

## Claim a ticket

```
gh issue edit <n> --repo <Repo> --add-assignee @me
```

An open ticket with an assignee is in progress. The frontier skips it.

## Close a ticket

Post the comment first, then close:

```
gh issue comment <n> --repo <Repo> --body-file <file>
gh issue close <n> --repo <Repo>
```

Do not use `gh issue close --comment`. On an issue that is already closed it drops the comment and still exits 0.

## Create the plumb labels

A `wayfind` map and its decision tickets carry these labels. Create them once per repo. `--force` updates a label that already exists, so running it again is safe.

```
gh label create plumb:map --repo <Repo> --force --description "wayfind map"
gh label create plumb:research --repo <Repo> --force --description "decision ticket: research"
gh label create plumb:prototype --repo <Repo> --force --description "decision ticket: prototype"
gh label create plumb:align --repo <Repo> --force --description "decision ticket: align"
gh label create plumb:task --repo <Repo> --force --description "decision ticket: task"
```

## Add a label to an issue

```
gh issue edit <n> --repo <Repo> --add-label <label>
```

A decision ticket carries exactly one `plumb:<type>` label.

## Close an issue as not planned

A decision ticket ruled out of scope closes as not planned. Post the comment first, then close:

```
gh issue comment <n> --repo <Repo> --body-file <file>
gh issue close <n> --repo <Repo> --reason "not planned"
```

Do not use `--comment` here either, for the same reason as above.

## Check the graph

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" --github <Repo> <spec-issue>
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" --github <Repo> <spec-issue> --frontier
```

The tickets are the spec issue's sub-issues. A closed ticket is done, an open one with an assignee is in progress, and an open unassigned one is ready. The first command prints one error per line, or `ok: N tickets, M ready now`. `--frontier` prints the ready tickets whose blockers are all closed, one `#<n> <title>` per line. A `gh` failure prints its error and exits 2.

Pass a `plumb:map` issue in place of the spec issue to check a `wayfind` map. A sub-issue with a `plumb:<type>` label is a decision ticket, and one closed as not planned is out of scope. The map's body needs a Destination and a pointer to every closed decision ticket: a link to its issue URL or a `#<n>` reference.

Adapted from mattpocock/skills `setup-matt-pocock-skills/issue-tracker-github.md` (MIT).
