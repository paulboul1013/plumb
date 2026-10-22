#!/bin/sh
set -eu

if [ "${FACTORY_HOOK:-on}" = off ]; then
  exit 0
fi

cat "${CLAUDE_PLUGIN_ROOT}/hooks/session-start-context.md"
