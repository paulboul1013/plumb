# Prototype lane

Throwaway code that answers one question. The rigor inverts here: speed over polish, no tests, no abstractions. The rigor goes into asking the right question.

1. **Name the question.** One question, and the decision its answer changes. No question means no prototype. Go back to the router.
2. **Pick the form.** A logic or state question gets one self-contained HTML file or script that drives the state through the hard cases and prints the full state after each step. A look-and-feel question gets two to four radically different variants behind one switcher. A performance or behavior question gets the smallest script that measures it.
3. **Build it in a scratch location** next to where the real code will live, named so a reader sees it is a prototype. One command starts it. State lives in memory unless persistence is the question.
4. **Observe.** Run it. Screenshot each variant, or capture the printed state or the timing. The observation is the test.
5. **Decide.** Present the variants, the evidence, the tradeoffs, and your pick. If the user owns the call, ask through `align`.
6. **Capture.** Fold the decision into the spec or ticket. Keep the prototype on a `prototype/<name>` branch, out of main, and link it from the ticket.

**Reply.** The question, the variants, the evidence, your pick, and the prototype's location. Say plainly that it is throwaway.
