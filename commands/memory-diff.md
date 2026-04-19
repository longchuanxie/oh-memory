---
description: Preview changes before ingesting files
agent: build
---

Preview the changes that would be made when ingesting files into the knowledge base.

Please use the `memory-diff` tool to show what would change.

**Arguments:**
- `files`: The files to preview (optional, from user input)
- `projectPath`: The project root directory

If no files are specified, the tool will scan for pending changes from the evolution engine.

After receiving the preview:

1. **Format as a clear change list** using:
   - `+` for new pages (green)
   - `~` for updated pages (yellow)  
   - `-` for deleted pages (red)
   - `=` for unchanged pages (gray)

2. **Show counts** at the top: "X new, Y updated, Z deleted, W unchanged"

3. **Suggest next steps:**
   - If there are changes: "Run `/memory-ingest <files>` to apply these changes"
   - If no changes: "Knowledge base is up to date"

Example output format:
```
📋 Change Preview
━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 2 new, 1 updated, 0 deleted, 5 unchanged

+ New Pages (2):
  - jwt-auth (from src/auth/jwt.ts)
  - auth-middleware (from src/auth/middleware.ts)

~ Updated Pages (1):
  - user-service (content changed)

Run /memory-ingest to apply these changes.
```

Files to preview: $ARGUMENTS
