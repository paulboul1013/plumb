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

## Check the graph

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" --github <Repo> <spec-issue>
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tickets.mjs" --github <Repo> <spec-issue> --frontier
```

The tickets are the spec issue's sub-issues. A closed ticket is done, an open one with an assignee is in progress, and an open unassigned one is ready. The first command prints one error per line, or `ok: N tickets, M ready now`. `--frontier` prints the ready tickets whose blockers are all closed, one `#<n> <title>` per line. A `gh` failure prints its error and exits 2.

Adapted from mattpocock/skills `setup-matt-pocock-skills/issue-tracker-github.md` (MIT).
