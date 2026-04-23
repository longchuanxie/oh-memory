#!/usr/bin/env bash
# import-context.sh — Import .ai-context/ from a portable archive

set -euo pipefail

AI_CONTEXT=".ai-context"

echo "=== PCP Import ==="

if [ $# -lt 1 ]; then
    echo "Usage: ./import-context.sh <archive.tar.gz> [--force]"
    exit 1
fi

ARCHIVE="$1"
FORCE="${2:-}"

if [ ! -f "$ARCHIVE" ]; then
    echo "Error: Archive not found: ${ARCHIVE}"
    exit 1
fi

if [ "$FORCE" == "--force" ]; then
    tar xzf "$ARCHIVE" --overwrite
else
    tar xzf "$ARCHIVE" --keep-old-files
fi

echo "Import complete from: ${ARCHIVE}"
