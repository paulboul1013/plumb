---
name: deliver
description: Shape finished work into small ordered commits and a PR body that shows the change, the evidence, and the merge danger. Use when committing a finished change, opening a PR, or writing a PR description.
---

# Deliver

## Commits

Rebase into small, ordered commits that each leave the build green and tell the story in order: subtraction first, then the reshape or the failing test, then the fix or the feature. Use Conventional Commits, `type(scope): subject`, imperative, no trailing period. The body says why, not what the diff already shows.

Before the commit, delete debug logs, dead code, and comments that narrate the code. Keep a comment that states a rule of a dependency, platform, vendor, or protocol, unless that system's docs or source show the rule is wrong.

## PR

Work on a branch, never the default branch. Open the PR ready for review, not as a draft. Prefer several narrow PRs to one large one. A stack is a chain where each PR targets its parent's branch.

Write the body in the glossary's language. No preamble.

```markdown
## Summary

<the smallest view that makes the change clear: pseudocode, a call tree, a component tree, or a shallow file tree>

## Evidence

- **Before:** <failing test, output, or screenshot>
- **After:** <passing test, output, or screenshot>

## Merge danger

**Change door:** <one-way or two-way>. <why, in one sentence>

**Design door:** <none, or the shape that is hard to change later>

**Blast radius:** <who or what this touches, and why that is safe or risky>

## Scope

<what this leaves out on purpose>
```

For a bug, the Summary names the hypothesis that turned out true. For a one-way change door, the Merge danger section names the rollback.

Opening a PR does not mean watching it. Post the link and carry on. Never merge without the user's go.
