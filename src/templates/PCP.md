# PCP — Project Context Protocol Instructions

This file contains PCP-specific instructions for AI agents. It should be **included** in your project's AGENTS.md or CLAUDE.md, not replace it.

## Integration Methods

### Method 1: Include in AGENTS.md
Add this line to your existing AGENTS.md:
```
See .ai-context/PCP.md for Project Context Protocol instructions.
```

### Method 2: Include in opencode.json
```json
{
  "instructions": [".ai-context/PCP.md"]
}
```

### Method 3: Reference in CLAUDE.md
Add: `@.ai-context/PCP.md`

---

## PCP Instructions

### 1. Session Startup

#### 1.1 Load BOOT.md First
**ALWAYS** read `.ai-context/BOOT.md` before any other PCP file.

#### 1.2 Check for Recovery
Run `pcp recovery --json` to check for stale sessions. If `isStale: true`, present recovery options:
1. **Continue** — Resume from checkpoint state
2. **Review** — Show git diff before deciding
3. **Discard** — Revert uncommitted changes (`git checkout . && git clean -fd`)
4. **New Task** — Stash changes (`git stash`) and start fresh

#### 1.3 Start New Session
**ALWAYS** start a session at the beginning of work:

```bash
pcp session start <topic> --goal "<goal description>"
```

This automatically creates the session file, updates INDEX.md, and updates CHECKPOINT.json.

#### 1.4 Load Context by Task Type
| Task Type | Keywords | Files to Load |
|-----------|----------|--------------|
| **Implement** | implement, add, create, feature | `PATTERNS.md` + `ARCHITECTURE.md` |
| **Fix** | fix, bug, error, broken, crash | `WORKING.md` + `DECISIONS.md` + 2 recent sessions |
| **Refactor** | refactor, optimize, restructure | `ARCHITECTURE.md` + `PATTERNS.md` + `DECISIONS.md` |
| **History** | history, why, decision, previously | `SESSIONS/INDEX.md` → matching sessions |

### 2. During Work

#### 2.1 Update Checkpoint
**ALWAYS** run after completing a logical subtask:

```bash
pcp checkpoint --completed "item1,item2" --inProgress "current item" --remaining "item3"
```

Or to update created/modified files:

```bash
pcp checkpoint --created "new-file.ts" --modified "existing-file.ts"
```

#### 2.2 Record Decisions
Add ADR entries to `.ai-context/DECISIONS.md`:

```markdown
### D###: [Title]
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Impact of this decision
```

#### 2.3 Update WORKING.md
When task or progress changes significantly, update `.ai-context/WORKING.md`.

### 3. Session Completion

A session ends when:
- **Code Tasks**: Goal completed, code builds, tests pass, user confirms
- **Design Tasks**: Design reviewed, decisions recorded, next steps defined
- **Discussion**: Questions answered, insights recorded
- **Interruption**: User says "stop/done", context limits, scope changes

When session ends:

```bash
pcp session end [session-id]
```

To archive:

```bash
pcp session archive <session-id>
```

### 4. CLI Command Reference

```bash
# Session Management
pcp session start <topic> [--goal "<goal>"]   # Start new session
pcp session end [session-id]                   # End active session
pcp session list [--archived|--all]            # List sessions
pcp session search <query>                     # Search sessions
pcp session archive <session-id>               # Archive session

# Checkpoint
pcp checkpoint [--completed "..."] [--inProgress "..."] [--remaining "..."]
pcp checkpoint [--created "..."] [--modified "..."]

# Recovery
pcp recovery              # Human-readable recovery status
pcp recovery --json       # Machine-readable JSON output

# Update
pcp update                # Re-scan project and update context files

# Status
pcp status                # Show PCP context status
```

### 5. Important Rules

- **NEVER skip loading BOOT.md**
- **NEVER load all context files at once**
- **ALWAYS start a session with `pcp session start`**
- **ALWAYS update checkpoint with `pcp checkpoint`**
- **ALWAYS end session with `pcp session end`**
- **ALWAYS record decisions in DECISIONS.md**
- **NEVER delete or modify ARCHIVED/ files**
