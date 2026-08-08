#!/usr/bin/env bash
# PreToolUse guard: production.json is mutated through production.mjs, never by
# hand. Hand edits skip the atomic write, the append-only log and the graph
# invariants, and two agents editing it concurrently silently lose a write.
#
# Reads the tool call on stdin; emits a deny decision when the target is a
# production manifest. Everything else passes through untouched.

input=$(cat)
path=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

case "$path" in
  */productions/VID-*/production.json)
    cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "production.json is mutated through plugins/video-guy/scripts/production.mjs, not by hand — hand edits skip the atomic write, the append-only log and the stage-graph invariants. Use: production.mjs stage|set|cost|asset|log."
  }
}
JSON
    ;;
  *)
    exit 0
    ;;
esac
