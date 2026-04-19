---
description: Query the knowledge base
agent: build
---

Query the knowledge base with the following question: $ARGUMENTS

**IMPORTANT**: Use the `memory-query-kb` tool with these parameters:
- `query`: The user's question
- `projectPath`: The current project directory
- `type`: (optional) Filter by type: entity, concept, source, synthesis, or all
- `mode`: Query mode - see below

**Query Mode Options:**
- `detailed` (default): Returns page IDs + content summaries - use this for comprehensive answers
- `quick`: Returns only page IDs - use this for fast lookups
- `content`: Full-text search with code context - use this when you need to find specific code or detailed content

**When to use each mode:**
- Use `quick` for fast ID lookups
- Use `detailed` for answering questions with page summaries
- Use `content` when you need to find specific code, functions, or detailed content in the pages

**After receiving the query result:**

1. **Review the results** based on mode:
   - If `detailed`: Use the `pageSummaries` array for comprehensive answers
   - If `quick`: Show only the matching page IDs
   - If `content`: Use the matches with context to find specific details

2. **Synthesize an answer** based on the results. Do NOT just list pages - provide a helpful, comprehensive answer.

3. **Cite your sources** - Use wiki-style links like `[[page-id]]` when referencing specific pages

4. **Show related pages** - List the `relatedPages` that might contain more details

5. **Ask if the user wants to save** this answer as a new synthesis page

**If no results are found:**
- Explain that the knowledge base doesn't contain relevant information
- Suggest running `/memory-ingest` to add source files
- Offer to create a new synthesis page with the user's knowledge

**Example response format:**
```
Based on the knowledge base:

[Your synthesized answer here, with [[citations]]]

**Related pages:**
- [[page-1]] - Brief description
- [[page-2]] - Brief description

Would you like me to save this as a new synthesis page?
```
