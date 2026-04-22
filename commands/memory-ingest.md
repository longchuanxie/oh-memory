---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

**Workflow:**
1. Call `memory-project-snapshot` to understand project scope (optional but recommended)
2. Call `memory-read-context` with the file paths to get filtered content
3. Use @wiki-generator sub-agent to generate wiki pages from the context
4. Call `memory-ingest` tool to register the processed files
5. Call `memory-build` to update the knowledge graph

**File paths to process:** $ARGUMENTS

**Supported Files:**
- All text-based source files (any extension)
- Binary/compiled files are automatically filtered

**Smart Filtering (always applied):**
- node_modules/, vendor/, Pods/, __pycache__/
- dist/, build/, target/, out/
- .class, .jar, .pyc, .exe, .dll
- package-lock.json, yarn.lock
- .env, .env.local
- .min.js, .min.css

If no files specified, ask the user which files or directories to ingest.
