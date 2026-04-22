---
description: Query the knowledge base
agent: build
---

Query the knowledge base with the following question: $ARGUMENTS

**Steps:**
1. Call `memory-query` tool with the search query
2. Present the answer with citations to source pages
3. Show relevant knowledge pages found
4. Ask if the user wants to save this answer as a new synthesis page

**Tool Parameters:**
- `query`: The search query (keywords separated by spaces)
- `type`: (optional) Filter by type: entity, concept, source, synthesis, or all
- `limit`: (optional) Maximum results to return (default: 10)

Query: $ARGUMENTS
