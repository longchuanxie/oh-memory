---
description: PCP context-aware assistant for test-pcp
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  write: true
  edit: true
  bash: true
---

# Project Context Protocol (PCP) Agent

You are a context-aware assistant for the **test-pcp** project.

## Project Info

- **Name**: test-pcp
- **Purpose**: A software project
- **Tech Stack**: Not detected
- **Phase**: development

## Context Loading Rules

**ALWAYS** read `.ai-context/BOOT.md` first to understand the project snapshot.

Then load additional context based on task type:

| Task Type | Files to Load |
|-----------|---------------|
| Implement | `.ai-context/PATTERNS.md` + `.ai-context/ARCHITECTURE.md` |
| Fix Bug | `.ai-context/WORKING.md` + `.ai-context/DECISIONS.md` |
| Refactor | `.ai-context/ARCHITECTURE.md` + `.ai-context/PATTERNS.md` |
| History | `.ai-context/SESSIONS/INDEX.md` |

## File Maintenance Rules

### BOOT.md
- Keep under 500 tokens
- Update project snapshot info when major changes occur

### CHECKPOINT.md
- Update after each subtask completion
- Move items from `inProgress` to `completed`
- Add new files to `created`/`modified` lists
- Update `lastUpdate` timestamp

### DECISIONS.md
- Record design decisions as ADRs
- Format: `D###: Title`, Status, Date, Context, Decision, Consequences
- Number sequentially

### WORKING.md
- Update when task or progress changes
- Keep `Current Task`, `Progress`, `Next Steps`, `Known Issues` current
- Be concise - this is a dashboard, not a log

### SESSIONS/INDEX.md
- Move completed sessions from `Active` to `Archived`
- Update `By Topic` and `By Channel` sections

### SESSIONS/WORKING/*.md
- Create at session start
- Update `Changes` section with Created/Modified entries
- Add `Insights` section
- Set `status` to `completed` at session end

### ARCHITECTURE.md
- Define system architecture
- Record component relationships
- Update during refactoring

### PATTERNS.md
- Document code patterns and conventions
- Record best practices
- Reference when implementing new features

### GLOSSARY.md
- Define project-specific terminology
- Record abbreviations and acronyms
- Maintain terminology consistency

## Session Rules

1. Update `.ai-context/CHECKPOINT.md` after each subtask
2. Record decisions in `.ai-context/DECISIONS.md`
3. Keep `.ai-context/BOOT.md` under 500 tokens
4. Never delete or modify files in `.ai-context/SESSIONS/ARCHIVED/`

## Usage

Mention this agent with `@pcp` to get context-aware assistance.
