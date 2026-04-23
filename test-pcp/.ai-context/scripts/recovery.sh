#!/usr/bin/env bash
# recovery.sh — PCP Session Recovery Script

set -euo pipefail

AI_CONTEXT=".ai-context"
CHECKPOINT="${AI_CONTEXT}/CHECKPOINT.md"
RECOVERY="${AI_CONTEXT}/RECOVERY.md"

echo "=== PCP Recovery Check ==="

if [ ! -f "$CHECKPOINT" ]; then
    echo "No CHECKPOINT.md found. No recovery needed."
    exit 0
fi

checkpoint_status=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')
last_update=$(grep -o '"lastUpdate"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')
session_id=$(grep -o '"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')

echo "Session: ${session_id}, Status: ${checkpoint_status}"

if [ "$checkpoint_status" != "in-progress" ]; then
    echo "No abnormal termination detected."
    exit 0
fi

if [ -n "$last_update" ]; then
    update_epoch=$(date -d "$last_update" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$last_update" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    age_hours=$(( (now_epoch - update_epoch) / 3600 ))
    if [ "$age_hours" -lt 2 ]; then
        echo "Last update ${age_hours}h ago. Session may still be active."
        exit 0
    fi
    echo "LIKELY ABNORMAL TERMINATION (last update ${age_hours}h ago)"
fi

echo ""
echo "--- Git Status ---"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git status --short 2>/dev/null || echo "Unable to check git status"
else
    echo "Not a git repository"
fi

echo ""
echo "Recovery Options:"
echo "1. Continue  — Commit and resume"
echo "2. Review    — Show changes"
echo "3. Discard   — Revert to last commit"
echo "4. New Task  — Stash and start fresh"
