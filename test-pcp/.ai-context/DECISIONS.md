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

### D001: Project Context Protocol Adoption
- **Status**: Accepted
- **Date**: 2026-04-23
- **Context**: Need cross-session context persistence for AI coding tools
- **Decision**: Adopt PCP with `.ai-context/` directory structure
- **Consequences**: All AI sessions share project context automatically
