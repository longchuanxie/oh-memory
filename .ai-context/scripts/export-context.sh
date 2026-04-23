#!/usr/bin/env bash
# export-context.sh — Export .ai-context/ to a portable archive

set -euo pipefail

AI_CONTEXT=".ai-context"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT="ai-context-export-${TIMESTAMP}.tar.gz"

echo "=== PCP Export ==="

if [ ! -d "$AI_CONTEXT" ]; then
    echo "Error: .ai-context/ directory not found"
    exit 1
fi

tar czf "$OUTPUT" \
    --exclude="${AI_CONTEXT}/SESSIONS/TEMP" \
    --exclude="${AI_CONTEXT}/CHECKPOINT.md.tmp" \
    --exclude="${AI_CONTEXT}/RECOVERY.md" \
    ${AI_CONTEXT}/

echo "Exported to: ${OUTPUT}"
echo "Size: $(du -h "$OUTPUT" | cut -f1)"
