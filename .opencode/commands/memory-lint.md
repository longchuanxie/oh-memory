---
description: Health check and repair the knowledge base
agent: build
---

Perform a health check on the knowledge base.

Please use the `memory-lint-kb` tool to validate the knowledge base.

After validation:
1. Show the user a list of issues found
2. For each issue, provide repair suggestions
3. Ask if the user wants to auto-fix issues
4. If yes, run the tool again with autoFix=true

Use the following arguments: $ARGUMENTS
