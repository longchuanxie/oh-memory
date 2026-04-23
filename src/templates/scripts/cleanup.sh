#!/usr/bin/env bash
# cleanup.sh — PCP Session Cleanup Script
# Cleans TEMP files older than 24h, compresses WORKING sessions older than 7 days

set -euo pipefail

AI_CONTEXT=".ai-context"
TEMP_DIR="${AI_CONTEXT}/SESSIONS/TEMP"
WORKING_DIR="${AI_CONTEXT}/SESSIONS/WORKING"
ARCHIVED_DIR="${AI_CONTEXT}/SESSIONS/ARCHIVED"
NOW=$(date +%s)

echo "=== PCP Cleanup ==="
echo "Time: $(date -Iseconds)"

temp_count=0
if [ -d "$TEMP_DIR" ]; then
    while IFS= read -r -d '' file; do
        file_mtime=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
        age_hours=$(( (NOW - file_mtime) / 3600 ))
        if [ "$age_hours" -ge 24 ]; then
            echo "  Deleting: $(basename "$file") (age: ${age_hours}h)"
            rm -f "$file"
            temp_count=$((temp_count + 1))
        fi
    done < <(find "$TEMP_DIR" -type f -print0 2>/dev/null)
fi
echo "  Cleaned ${temp_count} TEMP file(s)"

compress_count=0
if [ -d "$WORKING_DIR" ]; then
    while IFS= read -r -d '' file; do
        file_mtime=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
        age_days=$(( (NOW - file_mtime) / 86400 ))
        if [ "$age_days" -ge 7 ]; then
            basename_file=$(basename "$file")
            echo "  Compressing: ${basename_file} (age: ${age_days}d)"
            archive_content=$(sed -n '
                /^---$/,/^---$/p
                /^# Session:/p
                /^## Summary$/,/^##/{ /^## Summary$/p; /^## /!p }
                /^## Goal$/,/^##/{ /^## Goal$/p; /^## /!p }
                /^## Key Decisions$/,/^##/{ /^## Key Decisions$/p; /^## /!p }
                /^## Insights$/,/^##/{ /^## Insights$/p; /^## /!p }
                /^## Next Steps$/,/^## Detailed Log/p{ /^## Next Steps$/p; /^## Detailed Log$/!p }
            ' "$file")
            echo "$archive_content" > "${ARCHIVED_DIR}/${basename_file}"
            rm -f "$file"
            compress_count=$((compress_count + 1))
        fi
    done < <(find "$WORKING_DIR" -name "*.md" -type f -print0 2>/dev/null)
fi
echo "  Compressed ${compress_count} WORKING file(s)"

echo ""
echo "=== Cleanup Complete ==="
echo "TEMP deleted: ${temp_count}"
echo "WORKING compressed: ${compress_count}"
