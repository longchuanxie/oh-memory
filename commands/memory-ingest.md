---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

Please use the `memory-ingest-files` tool to process the following files or directories: $ARGUMENTS

After ingestion:
1. Show the user a summary of created and updated pages
2. Generate a review interface for human approval
3. Update the index.md and log.md files

If no files are specified, ask the user which files or directories they want to ingest.
