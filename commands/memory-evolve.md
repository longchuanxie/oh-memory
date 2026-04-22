---
description: Control the evolution engine (auto-update)
agent: build
---

View and control the evolution engine that automatically updates the knowledge base when source files change.

**Steps:**
1. Call `memory-evolve` tool with the specified action
2. Format the result nicely with emojis and sections

**Available actions:**
- `status`: Show evolution engine status (running, watched files, pending changes)
- `pause`: Pause automatic updates
- `resume`: Resume automatic updates
- `history`: Show recent update history

Action: $ARGUMENTS (defaults to "status" if not specified)
