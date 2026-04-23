# .ai-context — Project Context Protocol (PCP)

This directory contains the AI context persistence layer for the oh-mermory project. It enables cross-session context sharing for AI coding tools (OpenCode, Claude Code, etc.).

## Quick Start

1. **New session**: Read `BOOT.md` first — it's the entry point
2. **Continue work**: Read `BOOT.md` + `WORKING.md` + `CHECKPOINT.md`
3. **Recovery**: If CHECKPOINT.md shows `in-progress` with stale timestamp, run recovery script

## File Guide

| File | Purpose | When to Read |
|------|---------|-------------|
| BOOT.md | Project snapshot, context map, quick answers | Every session start |
| PROJECT.md | Project details, tech stack, roadmap | Need project overview |
| ARCHITECTURE.md | System design, modules, data flow | Architecture questions |
| DECISIONS.md | ADR-format decision records | Understanding past decisions |
| PATTERNS.md | Code patterns, conventions, loading rules | Writing code |
| WORKING.md | Current task, progress, next steps | Continuing work |
| CHECKPOINT.md | Session state (JSON), recovery data | Session recovery |
| GLOSSARY.md | Term definitions | Unfamiliar terms |
| BRANCH_NAMING.md | AI session branch naming convention | Creating branches |
| mcp-bridge.json | MCP extension config (disabled by default) | External memory integration |

## Directory Structure

```
.ai-context/
├── BOOT.md              # Entry point (always load first)
├── PROJECT.md           # Project overview
├── ARCHITECTURE.md      # System architecture
├── DECISIONS.md         # Decision records (ADR)
├── PATTERNS.md          # Code patterns & conventions
├── WORKING.md           # Current work state
├── CHECKPOINT.md        # Session checkpoint (JSON)
├── GLOSSARY.md          # Term glossary
├── BRANCH_NAMING.md     # Branch naming convention
├── mcp-bridge.json      # MCP bridge config (optional)
├── SESSIONS/
│   ├── INDEX.md         # Session index
│   ├── WORKING/         # Active sessions (7-day TTL)
│   ├── ARCHIVED/        # Compressed sessions (long-term)
│   └── TEMP/            # Ephemeral files (24h TTL, git-ignored)
├── KNOWLEDGE/
│   ├── domain/          # Domain-specific knowledge
│   └── tech/            # Technical knowledge
└── scripts/
    ├── cleanup.sh       # TEMP cleanup + WORKING compression (Bash)
    ├── cleanup.ps1      # Same, PowerShell version
    ├── recovery.sh      # Abnormal termination recovery (Bash)
    ├── recovery.ps1     # Same, PowerShell version
    ├── export-context.sh   # Export context archive (Bash)
    ├── export-context.ps1  # Same, PowerShell version
    ├── import-context.sh   # Import context archive (Bash)
    └── import-context.ps1  # Same, PowerShell version
```

## Three-Layer Memory Model

- **L1 — Project Cognition** (BOOT.md, PROJECT.md): Always loaded at session start, < 500 tokens
- **L2 — Session State** (WORKING.md, CHECKPOINT.md): Loaded for active work continuation
- **L3 — Project Knowledge** (ARCHITECTURE.md, DECISIONS.md, PATTERNS.md, KNOWLEDGE/): Loaded on demand by task type

## Session Lifecycle

1. **TEMP** → 24h TTL, auto-deleted by cleanup script
2. **WORKING** → 7-day active period, then compressed to ARCHIVED
3. **ARCHIVED** → Long-term storage, key decisions and patterns only

## Maintenance

Run cleanup periodically:
```bash
# Bash
bash .ai-context/scripts/cleanup.sh

# PowerShell
pwsh .ai-context/scripts/cleanup.ps1
```

Check for abnormal termination:
```bash
# Bash
bash .ai-context/scripts/recovery.sh

# PowerShell
pwsh .ai-context/scripts/recovery.ps1
```

## Rollback

Delete this directory to completely remove PCP. No project code is affected.
