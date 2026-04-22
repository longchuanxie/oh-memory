---
description: Show knowledge base status
agent: build
---

Show the current status of the knowledge base.

**Steps:**
1. Call `memory-status` tool to get current state
2. Format the result nicely using markdown tables
3. Highlight any issues (errors in red, warnings in yellow)
4. Suggest actions based on status:
   - If pending changes > 0: suggest running /memory-ingest
   - If graph is empty: suggest running /memory-build

Project directory: $ARGUMENTS
