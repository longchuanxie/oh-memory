---
description: Control the evolution engine (auto-update)
agent: build
---

View and control the evolution engine that automatically updates the knowledge base when source files change.

Please use the `memory-evolve` tool with the specified action: $ARGUMENTS

**Available actions:**
- `status`: Show evolution engine status (running, watched files, pending changes, config)
- `pause`: Pause automatic updates
- `resume`: Resume automatic updates  
- `history`: Show recent update history

**If no action specified, use "status"**

After receiving the result:

1. **Format the status nicely** with emojis and sections
2. **If paused:** Remind the user that automatic updates are disabled
3. **If history:** Show the most recent updates with timestamps
4. **If errors:** Explain what went wrong and suggest fixes

**Example output format for status:**
```
🔄 Evolution Engine Status
━━━━━━━━━━━━━━━━━━━━━━━━
Status: Running ✅
Watching: 23 files (src/**/*.ts, docs/**/*.md)
Pending Changes: 2 files
Require Approval: Yes

**Configuration:**
- Watch patterns: src/**/*.ts, docs/**/*.md
- Ignore patterns: **/*.test.ts, **/node_modules/**

**Pending Files:**
- src/auth/jwt.ts
- src/utils/helpers.ts

Run /memory-diff to preview changes, or /memory-ingest to apply them.
```

**Example output format for history:**
```
📜 Update History
━━━━━━━━━━━━━━━━━━━━━━━━
Last 5 updates:

1. 2026-04-19 10:30:00
   Files: src/auth/jwt.ts
   Created: 1 page, Updated: 0 pages

2. 2026-04-19 09:15:00
   Files: src/utils/helpers.ts
   Created: 0 pages, Updated: 1 page
```
