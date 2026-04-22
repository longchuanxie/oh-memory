---
description: Ingest source files into the knowledge base
agent: build
---

Ingest the specified source files into the knowledge base.

**Recommended workflow:**
1. Call `memory-project-snapshot` to understand project scope
2. Call `memory-read-context` to get file contents as LLM-ready context
3. Use @wiki-generator sub-agent to generate wiki pages
4. Call `memory-ingest` to register processed files
5. Call `memory-build` to rebuild the knowledge graph

Files or directories to ingest: $ARGUMENTS

If no files are specified, ask the user which files or directories they want to ingest.
