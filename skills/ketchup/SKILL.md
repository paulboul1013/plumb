---
name: ketchup
description: Catch the user up on what changed in this chat since their last message, in plain words, and list every decision waiting on them with enough to make it from the reply alone. Read-only. Use when the user asks to be caught up, or what is waiting on them.
disable-model-invocation: true
---

# Ketchup

Catch the user up on what changed since the last message they wrote before `/plumb:ketchup`. Notifications and subagent reports are not their messages. Assume they remember that message and nothing after it.

Use plain words and short sentences, like one person catching up another. Say what changed for them, not how you did it: "the tests pass", not "CI is green". Leave out hashes, file paths, commands, and test counts unless they need one to act. Call each branch, PR, or agent by a name they would know.

## Gather

Stay read-only. Do not change code, start a job, push, or post anything. The one exception is a picture file written outside the repo.

Collect your own work since that message, every subagent report, and the lane's todolist. Check the live state of each branch, PR, and background agent the chat touched, rather than trusting what you said earlier. Check every number you will show against its source, and say so when you correct one.

A **decision** is something only the user can do: a decision they own in the plumb router's sense (scope, product behavior, risk, taste, naming), an approval, an irreversible action the router stops for, or access you lack. Include one still waiting from before their last message. A choice the user named as theirs and has not made yet, such as "whether to do X is my call, don't do it yet", is a decision waiting on them, not something that happened. Work you can do yourself is not a decision. Never invent one to fill the reply.

## Write the reply

1. **One sentence** naming what waits on them, or saying nothing does. If nothing happened and nothing waits, say so and stop.
2. **What happened**, under 100 words, shorter when less happened. One line per thing they asked for: what came of it, and whether it is done, still running, failed, or not checked. Write it the way you would say it out loud. Never mark something done that still waits on them. Name any bug found and fixed on the way. Then one line for work left that you can do yourself.
3. **Decisions**, about 30 words each. Each holds the decision, your pick, what it changes for them, the evidence behind your pick, and its risk, even when low ("Low risk: only the wording changes"). For a choice between options, give each option what it gets them and what it costs instead of a separate risk. When several items share one decision, write the decision and your pick once, then one line per item, riskiest first. Never shrink the list to save words: the reply alone must be enough to decide.

## Pictures

Draw only when a picture is easier to grasp than a sentence: how a change works, a chain of branches and their state, a before and after, options side by side. Never draw a status list or the list of decisions, and never repeat a fact the text already gives.

Keep each picture readable at a glance: at most six boxes, at most eight plain words in each. Draw from facts you have, never an invented number or a screen you did not capture.

Write it as an SVG file outside the repo, in the session's scratch or temp directory, with a white background so it reads in both themes. Show it with the host's tool for sending files to the user when one exists, so it renders beside the reply. Otherwise give its full path, and keep the reply complete without it.
