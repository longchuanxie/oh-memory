# ARCHITECTURE — System Architecture

## System Overview
oh-mermory implements a three-layer knowledge architecture:

```
┌─────────────────────────────────────────┐
│           Schema Layer (AGENTS.md)       │
│  Defines how LLM operates on the wiki   │
├─────────────────────────────────────────┤
│           Wiki Layer (Markdown)          │
│  LLM-generated, interlinked pages       │
│  Summaries, entities, concepts, etc.    │
├─────────────────────────────────────────┤
│           Raw Sources Layer              │
│  Immutable source documents             │
│  Articles, papers, data files           │
└─────────────────────────────────────────┘
```

## Module Responsibilities

### Schema Layer
- **AGENTS.md**: Instructs the LLM on wiki structure, conventions, and workflows
- **PCP (Project Context Protocol)**: Manages cross-session context persistence
- Defines ingest, query, and lint operations

### Wiki Layer
- **index.md**: Content-oriented catalog of all wiki pages
- **log.md**: Chronological append-only record of operations
- **Entity pages**: People, organizations, concepts
- **Topic pages**: Thematic summaries and syntheses
- **Comparison pages**: Side-by-side analyses

### Raw Sources Layer
- Immutable documents (articles, papers, images)
- Never modified by the LLM
- Source of truth for all wiki content

## Data Flow

### Ingest Flow
1. User drops source into raw collection
2. LLM reads source, discusses key takeaways
3. LLM writes summary page, updates index
4. LLM updates relevant entity/concept pages
5. LLM appends entry to log

### Query Flow
1. User asks question
2. LLM reads index to find relevant pages
3. LLM reads specific pages for detail
4. LLM synthesizes answer with citations
5. Valuable answers filed back as new pages

### Lint Flow
1. LLM scans for contradictions between pages
2. LLM identifies stale claims superseded by newer sources
3. LLM finds orphan pages without inbound links
4. LLM suggests new questions and sources

## Key Design Principles
- **Incremental**: Knowledge compounds over time
- **Human-curated sources, LLM-maintained wiki**: Division of labor
- **Persistent artifact**: Wiki is built once, kept current
- **Zero dependencies**: Pure Markdown + Git
