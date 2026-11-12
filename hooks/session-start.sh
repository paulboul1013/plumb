#!/bin/sh
set -eu

if [ "${PLUMB_HOOK:-on}" = off ]; then
  exit 0
fi

# Save the tree's uncommitted entries, so the finish gate counts only what this session changes.
node "${CLAUDE_PLUGIN_ROOT}/hooks/stop-gate.mjs" record >/dev/null 2>&1 || true

cat "${CLAUDE_PLUGIN_ROOT}/hooks/session-start-context.md"
