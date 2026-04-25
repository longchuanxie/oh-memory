# AGENTS — AI Context Protocol Instructions

This file instructs AI agents on how to load and maintain project context using the Project Context Protocol (PCP).

Compatible with: OpenCode, Claude Code, Cursor, Trae, and any agent that reads AGENTS.md.

---

## 0. Tool-Specific Loading Hints

### OpenCode
OpenCode reads this file automatically. For on-demand context loading, use `@` references:
- Architecture context: @.ai-context/ARCHITECTURE.md
- Code patterns: @.ai-context/PATTERNS.md
- Current work: @.ai-context/WORKING.md
- Decisions: @.ai-context/DECISIONS.md
- Glossary: @.ai-context/GLOSSARY.md

Load these files lazily based on the task type (see Section 1.4). Do NOT load all at once.

### Claude Code / Trae / Cursor
These tools read this file automatically. Use the Read tool to load context files on demand per Section 1.4.

---

## 1. Pre-Work: Session Startup

### 1.1 Load BOOT.md First
**ALWAYS** read `.ai-context/BOOT.md` before any other file. It contains the project snapshot and context map.

### 1.2 Check for Recovery
Run `pcp recovery --json` to check for stale sessions. If `isStale: true`, present recovery options to the user:
1. **Continue** — Resume from checkpoint state
2. **Review** — Show git diff before deciding
3. **Discard** — Revert uncommitted changes (`git checkout . && git clean -fd`)
4. **New Task** — Stash changes (`git stash`) and start fresh

### 1.3 Start New Session
**ALWAYS** start a session at the beginning of work:

```bash
pcp session start <topic> --goal "<goal description>"
```

This automatically:
- Creates session file in `.ai-context/SESSIONS/WORKING/`
- Updates `SESSIONS/INDEX.md`
- Updates `CHECKPOINT.json`

### 1.4 Load Context by Task Type
Based on the user's request, load additional context files:

| Task Type | Keywords | Files to Load |
|-----------|----------|--------------|
| **Implement** | implement, add, create, feature, function | `PATTERNS.md` + `ARCHITECTURE.md` |
| **Fix** | fix, bug, error, broken, crash | `WORKING.md` + `DECISIONS.md` + 2 most recent sessions |
| **Refactor** | refactor, optimize, restructure | `ARCHITECTURE.md` + `PATTERNS.md` + `DECISIONS.md` |
| **History** | history, why, decision, previously, before | `SESSIONS/INDEX.md` → then only matching session files |

For tasks not matching any type, load only `WORKING.md` for current state.

---

## 2. During Work: Context Maintenance

### 2.1 Update Checkpoint After Each Subtask
**ALWAYS** run after completing a logical subtask:

```bash
pcp checkpoint --completed "item1,item2" --inProgress "current item" --remaining "item3,item4"
```

Or to update created/modified files:

```bash
pcp checkpoint --created "new-file.ts" --modified "existing-file.ts"
```

### 2.2 Record Decisions in DECISIONS.md
When making a design decision, add an ADR entry to `.ai-context/DECISIONS.md`:

```markdown
### D###: [Title]
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Impact of this decision
```

Number sequentially (check existing entries for next number).

### 2.3 Update WORKING.md
When the current task or progress changes significantly, update `.ai-context/WORKING.md`:
- Update `Current Task`
- Update `Progress` checklist
- Update `Next Steps`
- Add any `Known Issues`

---

## 3. Post-Work: Session Completion

### 3.0 Determine Session End
A session is considered complete when ANY of the following conditions is met:

**Code Tasks (Implement/Fix/Refactor):**
- All items in the goal are completed
- Code compiles/builds without errors
- Tests pass (if applicable)
- User confirms the task is done

**Design/Requirements Tasks:**
- Design document or spec is written and reviewed
- User approves the design direction
- Key decisions are recorded in DECISIONS.md

**Discussion/Exploration Tasks:**
- User's questions are answered
- Key insights are recorded

**Interruption:**
- User explicitly says "stop", "done", "that's all", or similar
- Context window is approaching limits
- Task scope changes significantly

### 3.1 End Session
**ALWAYS** end the session when work is complete:

```bash
pcp session end [session-id]
```

If only one active session exists, you can omit the session-id.

### 3.2 Archive Session (Optional)
To archive completed sessions:

```bash
pcp session archive <session-id>
```

This moves the session to `.ai-context/SESSIONS/ARCHIVED/` and updates the index.

### 3.3 Update WORKING.md
Update `.ai-context/WORKING.md` with the final state and `Next Steps` for the next session.

---

## 4. CLI Command Reference

### Session Management
```bash
pcp session start <topic> [--goal "<goal>"]   # Start new session
pcp session end [session-id]                   # End active session
pcp session list [--archived|--all]            # List sessions
pcp session search <query>                     # Search sessions
pcp session archive <session-id>               # Archive session
```

### Checkpoint
```bash
pcp checkpoint [--session <id>] [--status <s>] [--phase <p>] [--goal <g>]
               [--completed "item1,item2"] [--inProgress "item"] [--remaining "item3"]
               [--created "file1"] [--modified "file2"] [--channel <ch>]
```

### Recovery
```bash
pcp recovery              # Human-readable recovery status
pcp recovery --json       # Machine-readable JSON output
```

### Update
```bash
pcp update                # Re-scan project and update context files
pcp update --dry-run      # Preview changes
```

### Status
```bash
pcp status                # Show PCP context status
```

---

## 5. Channel Mechanism

- The default channel is the current git branch name
- Sessions are automatically tagged with the current channel
- Sessions on different channels are isolated in `SESSIONS/INDEX.md`

---

## 6. Important Rules

- **NEVER skip loading BOOT.md** — it is the entry point for all context
- **NEVER load all context files at once** — use task-based loading to save tokens
- **ALWAYS start a session at the beginning of work** — use `pcp session start`
- **ALWAYS update checkpoint after subtasks** — use `pcp checkpoint`
- **ALWAYS end session when work is complete** — use `pcp session end`
- **ALWAYS record decisions in DECISIONS.md** — future sessions need this context
- **NEVER delete or modify ARCHIVED/ files** — they are the permanent record
- **Keep BOOT.md under 500 tokens** — it must be lightweight for fast loading
