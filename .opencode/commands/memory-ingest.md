---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

Please use the `memory-ingest-files` tool to process the following files or directories: $ARGUMENTS

**Git Version Control (IMPORTANT)**:
- By default, only files tracked by git are processed
- Untracked files are automatically skipped for security
- To include untracked files, the user must explicitly set includeUntracked=true
- Always check if files are tracked before processing

**Smart Filtering**: The command automatically filters out:
- Compiled files (.class, .jar, .pyc, .exe, .dll, etc.)
- Dependencies (node_modules/, vendor/, Pods/, etc.)
- Build outputs (dist/, build/, target/, out/, etc.)
- Lock files (package-lock.json, yarn.lock, etc.)
- Environment files (.env, .env.local, etc.)
- Minified files (.min.js, .min.css, etc.)

After ingestion:
1. Show the user a summary of created and updated pages
2. Show which files were filtered and why (including git status)
3. Generate a review interface for human approval
4. Update the index.md and log.md files

If no files are specified, ask the user which files or directories they want to ingest.
