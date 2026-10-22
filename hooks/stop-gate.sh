#!/bin/sh
set -eu

if [ "${FACTORY_HOOK:-on}" = off ]; then
  exit 0
fi

input=$(cat)
# A stop that this hook already blocked once goes through, so the gate never loops.
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
[ -f docs/agents/factory.md ] || [ -d .factory ] || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -n "$(git status --porcelain 2>/dev/null)" ] || exit 0

# Block once per working-tree state, so waiting on background reviewers does not re-trigger it.
marker="$(git rev-parse --git-dir)/factory-stop-gate"
state=$({ git status --porcelain; git diff HEAD; } 2>/dev/null | cksum)
if [ -f "$marker" ] && [ "$(cat "$marker")" = "$state" ]; then
  exit 0
fi
printf '%s\n' "$state" > "$marker"

cat "${CLAUDE_PLUGIN_ROOT}/hooks/stop-gate.json"
