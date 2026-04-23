# PROJECT — Project Overview

## Purpose
oh-mermory is a system for building personal knowledge bases using LLMs. Instead of traditional RAG (retrieve-then-generate), it incrementally builds and maintains a persistent, compounding wiki. The LLM writes and maintains the wiki; the human curates sources and asks questions.

## Tech Stack
- **Core**: Markdown files, Git version control
- **Viewer**: Obsidian (optional, for graph view and browsing)
- **Search**: qmd (optional, for hybrid BM25/vector search at scale)
- **Presentations**: Marp (optional, for slide decks from wiki content)
- **AI Integration**: AGENTS.md / CLAUDE.md schema-driven LLM agents

## Directory Structure
```
oh-mermory/
├── .ai-context/          # PCP context files (this system)
│   ├── BOOT.md           # Session entry point
│   ├── PROJECT.md        # This file
│   ├── ARCHITECTURE.md   # System architecture
│   ├── DECISIONS.md      # Decision records
│   ├── PATTERNS.md       # Code patterns
│   ├── WORKING.md        # Current work state
│   ├── CHECKPOINT.md     # Session checkpoint
│   ├── GLOSSARY.md       # Term glossary
│   ├── SESSIONS/         # Session lifecycle storage
│   │   ├── INDEX.md      # Session index
│   │   ├── WORKING/      # Active sessions
│   │   ├── ARCHIVED/     # Compressed past sessions
│   │   └── TEMP/         # Ephemeral files (24h TTL)
│   ├── KNOWLEDGE/        # Persistent knowledge
│   │   ├── domain/       # Domain-specific knowledge
│   │   └── tech/         # Technical knowledge
│   └── scripts/          # Automation scripts
├── docs/
│   └── llm_wiki.md       # LLM Wiki concept document
└── openspec/             # Change management
```

## Current Stage
- **Phase**: Concept validation / infrastructure setup
- **Milestone**: PCP (Project Context Protocol) initialization
- **Next**: Core wiki building functionality implementation
