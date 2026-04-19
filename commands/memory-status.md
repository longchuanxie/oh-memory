---
description: Show knowledge base status
agent: build
---

Show the current status of the knowledge base.

Please use the `memory-status` tool to get the following information:
- Total page counts by category (entities, concepts, sources, synthesis)
- Graph statistics (nodes, edges, connection rate)
- Health score and issues count
- Evolution engine status (running, watched files, pending changes)
- Last update time

After receiving the status:

1. **Format it nicely** using markdown tables and emojis
2. **Highlight any issues** (errors in red, warnings in yellow)
3. **Suggest actions** based on the status:
   - If pending changes > 0: suggest running /memory-ingest
   - If health score < 70: suggest running /memory-lint
   - If evolution is not running: suggest checking evolution config
4. **Keep it concise** - focus on what the user needs to know

Example output format:
```
📊 Knowledge Base Status
━━━━━━━━━━━━━━━━━━━━━━━━
📁 Pages: 45 total (12 entities, 15 concepts, 8 sources, 10 synthesis)
🔗 Graph: 128 connections, 85% connected
💚 Health: 92/100 ✅
🔄 Evolution: Running (watching 23 files)
⏰ Last Update: 2 hours ago

**Pending Changes:** 3 files need to be ingested
Run /memory-ingest to update the knowledge base.
```

Project directory: $ARGUMENTS
