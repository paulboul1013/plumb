---
name: sharpen
description: Make a task deeper, not bigger, then rewrite the prompt. Names what a top professional would do, the raw material they would start from, their methods, and an outside check, and does not do the task. Use when the user asks to sharpen a prompt or task.
argument-hint: "The task or prompt to sharpen"
disable-model-invocation: true
---

# Sharpen

Make the task deeper, not bigger. Do not start the task. The output is a better prompt.

Before you rewrite it, answer four questions about the task as given:

1. **The professional.** What would a top professional in this field do here that the prompt does not ask for?
2. **The raw material.** What is the rawest source they would start from, instead of what has already been digested? Logs over a summary of logs, the spec over a ticket that paraphrases it, the data over a chart of it.
3. **The methods.** Which specific methods and tools would they use?
4. **The outside check.** What, other than you or the user, would show the result is right? A test, a measurement, a second source, a real user. This becomes the proof that `prove` checks later.

Look facts up before you answer: read the code, the docs, and the history the task touches. Do not guess what the repo already says.

Then rewrite the prompt to ask for exactly that. Keep it about the same size: depth replaces breadth, so drop any part the four answers show is beside the point.

Leave the user's choices open. Where the rewrite meets a decision the user owns, such as scope, product behavior, risk, or taste, name the decision and the options instead of picking one.

## Output

The four answers, a few lines each. Then the rewritten prompt in one fenced block, ready to paste into `/plumb:plumb`. Then the open decisions, one line each.
