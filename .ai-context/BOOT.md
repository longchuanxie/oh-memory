# BOOT — Project Quick Snapshot

## Project
- **Name**: oh-mermory
- **Purpose**: LLM-powered personal knowledge base with incremental wiki building
- **Tech Stack**: Markdown, Git, Obsidian (optional)
- **Current Phase**: Early development / concept validation
- **Active Task**: Project Context Protocol (PCP) initialization
- **Progress**: 0%
- **Branch**: main

## Context Map
| File | When to Load |
|------|-------------|
| PROJECT.md | Need project details, goals, roadmap |
| ARCHITECTURE.md | Need system design, module structure |
| DECISIONS.md | Need to understand past decisions |
| PATTERNS.md | Implementing features, writing code |
| WORKING.md | Continuing current work in progress |
| CHECKPOINT.md | Session recovery, resuming interrupted work |
| GLOSSARY.md | Encountering unfamiliar terms |
| SESSIONS/INDEX.md | Querying history, finding past sessions |

## Quick Answers
1. **Architecture pattern**: Three-layer architecture (Raw Sources → Wiki → Schema)
2. **Knowledge building method**: Incremental wiki with LLM-maintained cross-references
3. **Storage format**: Pure Markdown files, git-tracked, zero dependencies
4. **Search strategy**: Index-based at small scale, qmd (optional) at scale

## Channel
- **Default**: main
