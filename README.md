# oh-mermory

LLM-powered personal knowledge base with incremental wiki building.

Instead of traditional RAG (retrieve-then-generate), oh-mermory incrementally builds and maintains a persistent, compounding wiki. The LLM writes and maintains the wiki; you curate sources and ask questions.

## Core Idea

Most LLM knowledge tools use RAG: upload files, retrieve chunks at query time, generate answers. Nothing compounds. Every question starts from scratch.

oh-mermory is different. The LLM **incrementally builds a persistent wiki** — a structured, interlinked collection of markdown files. When you add a source, the LLM reads it, extracts key information, and integrates it into the existing wiki — updating entity pages, revising summaries, flagging contradictions. Knowledge is compiled once and kept current, not re-derived on every query.

**The wiki is a persistent, compounding artifact.** Cross-references are already there. Contradictions are already flagged. The synthesis reflects everything you've read. It keeps getting richer with every source and every question.

## Architecture

Three layers:

```
┌─────────────────────────────────────────┐
│           Schema Layer (AGENTS.md)       │
│  Defines how the LLM operates on the wiki│
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

- **Raw Sources** — Your curated collection. Immutable. Source of truth.
- **Wiki** — LLM-generated markdown files. Summaries, entity pages, concept pages, comparisons. The LLM owns this layer.
- **Schema** — `AGENTS.md` tells the LLM how the wiki is structured and what workflows to follow.

## Operations

**Ingest** — Drop a source, tell the LLM to process it. The LLM reads the source, discusses key takeaways, writes a summary page, updates the index, updates relevant entity/concept pages, and appends to the log.

**Query** — Ask questions against the wiki. The LLM searches for relevant pages, reads them, and synthesizes an answer with citations. Good answers can be filed back into the wiki as new pages — your explorations compound.

**Lint** — Periodically health-check the wiki: find contradictions, stale claims, orphan pages, missing cross-references. The LLM suggests new questions and sources.

## Project Context Protocol (PCP)

oh-mermory uses PCP for cross-session AI context persistence. Any AI coding tool (OpenCode, Claude Code, Cursor, Trae) can pick up where the last session left off.

### Quick Start

```bash
# Initialize PCP in any project
npx pcp init

# Or use standalone scripts (no Node.js required)
curl -sL <url> | bash     # Bash
iwr <url> | iex           # PowerShell
```

### PCP Features

- **Three-layer memory model**: L1 (Project Cognition) → L2 (Session State) → L3 (Project Knowledge)
- **Session lifecycle**: TEMP (24h) → WORKING (7d) → ARCHIVED (long-term)
- **Checkpoint recovery**: Detect abnormal termination, present 4 recovery options
- **Channel mechanism**: Context isolated by git branch
- **MCP extension**: Optional bridge for external memory systems

### Supported AI Tools

| Tool | Mechanism |
|------|-----------|
| **OpenCode** | `opencode.json` instructions + `@` references in AGENTS.md |
| **Claude Code** | Reads AGENTS.md automatically |
| **Trae** | Reads AGENTS.md + Trae Skills |
| **Cursor** | Reads AGENTS.md automatically |

### Supported Project Types

| Language | Detection File | Tech Stack Tag |
|----------|---------------|----------------|
| Node.js | `package.json` | Node.js + top deps |
| Python | `pyproject.toml` | Python |
| Rust | `Cargo.toml` | Rust |
| Go | `go.mod` | Go |
| Java (Maven) | `pom.xml` | Java, Maven |
| Java (Gradle) | `build.gradle` / `build.gradle.kts` | Java, Gradle |

### CLI Commands

```bash
npx pcp init              # Initialize PCP (auto-detect project type)
npx pcp init -i           # Interactive mode
npx pcp init --dry-run    # Preview without writing
npx pcp status            # Check context status
npx pcp cleanup           # Clean up old session files
npx pcp recovery          # Check for interrupted sessions
npx pcp export            # Export context to archive
npx pcp import <archive>  # Import context from archive
```

## Directory Structure

```
oh-mermory/
├── .ai-context/              # PCP context files
│   ├── BOOT.md               # Session entry point (always load first)
│   ├── PROJECT.md            # Project overview
│   ├── ARCHITECTURE.md       # System architecture
│   ├── DECISIONS.md          # Decision records (ADR)
│   ├── PATTERNS.md           # Code patterns & conventions
│   ├── WORKING.md            # Current work state
│   ├── CHECKPOINT.md         # Session checkpoint (JSON)
│   ├── GLOSSARY.md           # Term glossary
│   ├── SESSIONS/             # Session lifecycle storage
│   │   ├── INDEX.md          # Session index
│   │   ├── WORKING/          # Active sessions
│   │   ├── ARCHIVED/         # Compressed past sessions
│   │   └── TEMP/             # Ephemeral files (24h TTL)
│   ├── KNOWLEDGE/            # Persistent knowledge
│   │   ├── domain/           # Domain-specific
│   │   └── tech/             # Technical
│   └── scripts/              # Automation scripts
├── docs/
│   └── llm_wiki.md           # LLM Wiki concept document
├── src/                      # pcp-cli source code
│   ├── cli.ts                # CLI entry point
│   ├── commands/             # CLI command implementations
│   ├── scanner.ts            # Project type scanner
│   ├── renderer.ts           # Template rendering engine
│   ├── templates/            # Parameterized templates
│   └── standalone/           # Standalone init scripts
├── AGENTS.md                 # AI agent instructions
└── opencode.json             # OpenCode configuration
```

## Tips

- **Obsidian** is the best viewer for the wiki — graph view, backlinks, search
- **Obsidian Web Clipper** converts web articles to markdown for quick ingestion
- **Marp** generates slide decks from wiki content
- **qmd** adds hybrid BM25/vector search at scale
- The wiki is just a git repo of markdown files — version history, branching, and collaboration for free

## Why This Works

The tedious part of maintaining a knowledge base is the bookkeeping — updating cross-references, keeping summaries current, noting contradictions. Humans abandon wikis because maintenance grows faster than value. LLMs don't get bored, can touch 15 files in one pass, and the cost of maintenance is near zero.

Your job: curate sources, direct analysis, ask good questions. The LLM does everything else.

## License

MIT
