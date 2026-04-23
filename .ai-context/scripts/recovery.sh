#!/usr/bin/env bash
# recovery.sh — PCP Session Recovery Script
# Detects abnormal termination, checks git state, presents recovery options

set -euo pipefail

AI_CONTEXT=".ai-context"
CHECKPOINT="${AI_CONTEXT}/CHECKPOINT.md"
RECOVERY="${AI_CONTEXT}/RECOVERY.md"

echo "=== PCP Recovery Check ==="
echo "Time: $(date -Iseconds)"

# --- Check if CHECKPOINT.md exists ---
if [ ! -f "$CHECKPOINT" ]; then
    echo "No CHECKPOINT.md found. No recovery needed."
    exit 0
fi

# --- Parse checkpoint status ---
checkpoint_status=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')
last_update=$(grep -o '"lastUpdate"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')
session_id=$(grep -o '"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')
current_phase=$(grep -o '"currentPhase"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')
goal=$(grep -o '"goal"[[:space:]]*:[[:space:]]*"[^"]*"' "$CHECKPOINT" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/')

echo "Session ID: ${session_id}"
echo "Status: ${checkpoint_status}"
echo "Last Update: ${last_update}"
echo "Current Phase: ${current_phase}"
echo "Goal: ${goal}"

# --- Check for abnormal termination ---
if [ "$checkpoint_status" != "in-progress" ]; then
    echo ""
    echo "Checkpoint status is '${checkpoint_status}'. No abnormal termination detected."
    exit 0
fi

# Check if last update is stale (> 2 hours)
if [ -n "$last_update" ]; then
    update_epoch=$(date -d "$last_update" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$last_update" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    age_hours=$(( (now_epoch - update_epoch) / 3600 ))

    if [ "$age_hours" -lt 2 ]; then
        echo ""
        echo "Last update was ${age_hours}h ago (within 2h threshold). Session may still be active."
        exit 0
    fi

    echo ""
    echo "⚠ LIKELY ABNORMAL TERMINATION (last update ${age_hours}h ago)"
fi

# --- Check git dirty state ---
echo ""
echo "--- Git Status ---"
git_dirty=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "Branch: ${branch}"

    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        git_dirty=1
        echo "Dirty: YES"
        echo ""
        echo "Uncommitted changes:"
        git status --short 2>/dev/null | while read -r line; do
            echo "  $line"
        done
    else
        echo "Dirty: NO (working tree clean)"
    fi

    last_commit=$(git log -1 --oneline 2>/dev/null || echo "none")
    echo "Last commit: ${last_commit}"
else
    echo "Not a git repository"
fi

# --- Generate RECOVERY.md ---
echo ""
echo "--- Generating RECOVERY.md ---"
cat > "$RECOVERY.md" << EOF
# RECOVERY — Abnormal Termination Detected

## Detection Summary
- **Session ID**: ${session_id}
- **Status**: ${checkpoint_status}
- **Last Update**: ${last_update}
- **Current Phase**: ${current_phase}
- **Goal**: ${goal}

## Assessment
The previous session appears to have terminated abnormally. The checkpoint indicates work was in progress.

## Git State
- **Dirty**: $(if [ $git_dirty -eq 1 ]; then echo "YES — uncommitted changes exist"; else echo "NO — working tree clean"; fi)
- **Last Commit**: ${last_commit:-unknown}

## Last Known State
See CHECKPOINT.md for detailed progress tracking.

## Recovery Options

### Option 1: Continue
Resume the interrupted session. Commit any uncommitted changes and continue from where you left off.
\`\`\`bash
git add -A && git commit -m "wip: checkpoint before recovery"
# Then continue work based on CHECKPOINT.md
\`\`\`

### Option 2: Review
Show all changes made during the interrupted session before deciding.
\`\`\`bash
git diff
git diff --cached
# Review changes, then choose Continue or Discard
\`\`\`

### Option 3: Discard
Revert to the last committed state, discarding all uncommitted changes.
\`\`\`bash
git checkout .
git clean -fd
# All uncommitted changes will be lost
\`\`\`

### Option 4: New Task
Stash current changes and start fresh with a new task.
\`\`\`bash
git stash push -m "abandoned: ${session_id}"
# Start new task
\`\`\`
EOF

echo "RECOVERY.md generated."
echo ""
echo "=== Recovery Options ==="
echo "1. Continue  — Commit and resume interrupted session"
echo "2. Review    — Show changes before deciding"
echo "3. Discard   — Revert to last commit (loses uncommitted work)"
echo "4. New Task  — Stash changes and start fresh"
echo ""
echo "See ${RECOVERY} for details."
