# PATTERNS — Code Patterns and Conventions

## File Naming Conventions
- Context files: UPPERCASE.md (e.g., BOOT.md, PROJECT.md)
- Session files: YYYY-MM-DD-topic.md (e.g., 2026-04-23-pcp-init.md)
- Knowledge files: lowercase-with-hyphens.md (e.g., knowledge-graph-patterns.md)
- Scripts: lowercase with extension (e.g., cleanup.sh, recovery.ps1)

## Markdown Conventions
- Use ATX headers (# style)
- Tables for structured data (context maps, indexes)
- YAML frontmatter for session metadata
- One concept per file
- Cross-reference with relative links: `[text](./path/to/file.md)`

## Session File Structure
```markdown
---
channel: <git-branch-name>
date: YYYY-MM-DD
status: working | completed | archived
---

# Session: <Topic>

## Summary
<1-2 sentence overview>

## Goal
<What this session aims to accomplish>

## Key Decisions
- <Decision with rationale>

## Changes
### Created
- <file path>: <brief description>

### Modified
- <file path>: <brief description>

## Insights
- <Discovered patterns or learnings>

## Next Steps
- <What should happen next>

## Detailed Log (Ephemeral)
<Debug details, trial errors — discarded during compression>
```

## Context Loading Rules
| Task Type | Keywords | Files to Load |
|-----------|----------|--------------|
| Implement | implement, add, create, feature | PATTERNS.md, ARCHITECTURE.md |
| Fix | fix, bug, error, broken, crash | WORKING.md, DECISIONS.md, recent 2 sessions |
| Refactor | refactor, optimize, restructure | ARCHITECTURE.md, PATTERNS.md, DECISIONS.md |
| History | history, why, decision, previously | SESSIONS/INDEX.md, then specific sessions |

## Checkpoint Update Triggers
- After file creation or significant modification
- After logical subtask completion
- Before and after risky operations
- At session end

## Compression Rules (WORKING → ARCHIVED)
- **Keep**: Key Decisions, Insights, architecture changes, discovered patterns
- **Discard**: Detailed Log sections, debug entries, formatting changes, trial errors
- **Target**: Archived file ≤ 20% of original size
