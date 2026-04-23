# GLOSSARY — Term Glossary

| Term | Definition |
|------|-----------|
| PCP | Project Context Protocol — the system for persisting AI context across sessions |
| L1 | Layer 1 — Project Cognition (BOOT.md, PROJECT.md) — always loaded |
| L2 | Layer 2 — Session State (WORKING.md, CHECKPOINT.md) — loaded for active work |
| L3 | Layer 3 — Project Knowledge (ARCHITECTURE.md, DECISIONS.md, PATTERNS.md, KNOWLEDGE/) — loaded on demand |
| ADR | Architecture Decision Record — structured format for recording design decisions |
| Channel | Context organization unit, defaults to git branch name |
| TEMP | Ephemeral session files with 24-hour TTL |
| WORKING | Active session files, compressed after 7 days |
| ARCHIVED | Compressed long-term session files with key info only |
| Ingest | Operation: process a new source into the wiki |
| Query | Operation: search and synthesize from wiki content |
| Lint | Operation: health-check the wiki for consistency |
| RAG | Retrieval-Augmented Generation — traditional approach of retrieving chunks at query time |
| Wiki | The persistent, compounding knowledge artifact maintained by the LLM |
| Schema | The configuration (AGENTS.md) that tells the LLM how to operate on the wiki |
| qmd | Optional local search engine for markdown files with hybrid BM25/vector search |
| MCP | Model Context Protocol — standard for LLM-tool integration |
| mcp-memory-keeper | External MCP-based memory system (optional integration target) |
