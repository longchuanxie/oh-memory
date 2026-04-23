# DECISIONS — Architecture Decision Records

## Format
Each decision follows the ADR (Architecture Decision Record) format:

```
### D###: [Title]
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Impact of this decision
```

---

### D001: File System as Persistence Medium
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: Need a way to persist AI context across sessions without external dependencies
- **Decision**: Use `.ai-context/` directory with Markdown files for all context storage
- **Consequences**: Zero dependencies, human-readable, git-friendly, but limited query capabilities

### D002: Three-Layer Memory Model with On-Demand Loading
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: Loading all context at session start wastes LLM context window
- **Decision**: L1 (Project Cognition / BOOT.md), L2 (Session State / WORKING+CHECKPOINT), L3 (Project Knowledge / KNOWLEDGE+ARCHITECTURE). Load BOOT.md first, then load by task type.
- **Consequences**: Startup < 500 tokens, but requires keyword-based task detection logic

### D003: Checkpoint + Git Dual Safety Net
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: Need to recover from abnormal session termination
- **Decision**: CHECKPOINT.md for real-time state, Git for code change safety net
- **Consequences**: Two recovery mechanisms complement each other; checkpoint may corrupt, Git is always reliable

### D004: Session Tiered Storage with Periodic Compression
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: Session files accumulate over time, creating noise
- **Decision**: TEMP (24h TTL) → WORKING (7-day active) → ARCHIVED (compressed long-term)
- **Consequences**: Controlled file growth, but requires cleanup automation scripts

### D005: AGENTS.md as Integration Entry Point
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: Need automatic context loading without user prompting
- **Decision**: Define context protocol instructions in AGENTS.md at project root
- **Consequences**: Works with OpenCode/Claude Code natively, but depends on LLM compliance

### D006: MCP Extension Interface Reserved
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: May want to integrate with external memory systems like mcp-memory-keeper in the future
- **Decision**: Reserve mcp-bridge.json interface, disabled by default
- **Consequences**: Future-proof without adding initial complexity
