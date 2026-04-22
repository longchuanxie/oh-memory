---
description: Build or rebuild the knowledge graph
agent: build
---

Build or rebuild the knowledge graph from existing wiki pages in .memory/ directory.

**Steps:**
1. Call `memory-build` tool to scan all wiki pages and create graph index
2. Show the user the build statistics (nodes, edges, counts by type)
3. If errors occur, explain what went wrong

This command scans all .md files in .memory/entities/, .memory/concepts/, .memory/sources/, and .memory/synthesis/ directories.
