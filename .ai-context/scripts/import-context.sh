#!/usr/bin/env bash
# import-context.sh — Import .ai-context/ from a portable archive

set -euo pipefail

AI_CONTEXT=".ai-context"

echo "=== PCP Import ==="

if [ $# -lt 1 ]; then
    echo "Usage: ./import-context.sh <archive.tar.gz> [--force]"
    echo "  --force: Overwrite existing files without prompting"
    exit 1
fi

ARCHIVE="$1"
FORCE="${2:-}"

if [ ! -f "$ARCHIVE" ]; then
    echo "Error: Archive not found: ${ARCHIVE}"
    exit 1
fi

if [ -d "$AI_CONTEXT" ] && [ "$FORCE" != "--force" ]; then
    echo "Warning: .ai-context/ already exists."
    echo "Existing files will be preserved. Newer files from archive will be skipped."
    echo "Use --force to overwrite."
fi

if [ "$FORCE" == "--force" ]; then
    tar xzf "$ARCHIVE" --overwrite
else
    tar xzf "$ARCHIVE" --keep-old-files
fi

echo "Import complete from: ${ARCHIVE}"
echo "Verify context with: cat ${AI_CONTEXT}/BOOT.md"
