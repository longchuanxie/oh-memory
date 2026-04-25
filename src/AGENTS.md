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

Load these files lazily based on the task type (see Section 1.3). Do NOT load all at once.

### Claude Code / Trae / Cursor
These tools read this file automatically. Use the Read tool to load context files on demand per Section 1.3.

---

## 1. Pre-Work: Session Startup

### 1.1 Load BOOT.md First
**ALWAYS** read `.ai-context/BOOT.md` before any other file. It contains the project snapshot and context map.

### 1.2 Create Session File
If no active session file exists in `.ai-context/SESSIONS/WORKING/`, create one:
- Filename format: `YYYY-MM-DD-<brief-topic>.md`
- Use the template below
- Update `SESSIONS/INDEX.md` to add it to the Active Sessions table

**Session File Template:**
```markdown
---
sessionId: YYYY-MM-DD-<topic>
date: YYYY-MM-DD
channel: <branch-name>
status: in-progress
---

# Session: <Topic>

## Summary
<Brief description of what this session is about>

## Goal
<What needs to be accomplished>

## Progress
- Current: <What you're working on now>
- Completed: <What's been done>
- Remaining: <What's left>

## Changes
### Created
- <New files>

### Modified
- <Modified files>

## Insights
- <Key learnings or decisions>

## Next Steps
- <What should happen next>

## Detailed Log (Ephemeral)
<Debug details, will be removed during archiving>
```

### 1.3 Check for Recovery
Read `.ai-context/CHECKPOINT.md`. If `status` is `"in-progress"` and `lastUpdate` is older than 2 hours, an abnormal termination likely occurred. Follow the Recovery procedure in Section 4.

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

### 2.1 Update CHECKPOINT.md After Each Subtask
After completing a logical subtask:
- Move the item from `inProgress` to `completed` in the progress section
- Add new files to `created` or `modified` lists
- Update `lastUpdate` timestamp
- **Use `pcp checkpoint` CLI command** to save checkpoint, OR write directly:
  - Write to `CHECKPOINT.md.tmp` first, then rename to `CHECKPOINT.md` (atomic write)

### 2.2 Record Decisions in DECISIONS.md
When making a design decision:
- Add a new ADR entry with format: `D###: Title`, Status, Date, Context, Decision, Consequences
- Number sequentially

### 2.3 Update Session File
When making code changes:
- Add entries to the `Changes` section
- Add insights to the `Insights` section
- Place debug details in `Detailed Log (Ephemeral)` section

### 2.4 Update WORKING.md
When the current task or progress changes:
- Update `Current Task`, `Progress`, `Next Steps`, and `Known Issues`

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
- Next implementation steps are defined

**Discussion/Exploration Tasks:**
- User's questions are answered
- Key insights are recorded
- Action items (if any) are identified

**Interruption:**
- User explicitly says "stop", "done", "that's all", or similar
- Context window is approaching limits
- Task scope changes significantly (end current session, start new one)

When session ends, follow Sections 3.1–3.4 below.

### 3.1 Finalize Session File
- Set frontmatter `status` to `completed`
- Fill in all sections

### 3.2 Update WORKING.md
- Reflect the final state of work
- Set `Next Steps` for the next session

### 3.3 Update SESSIONS/INDEX.md
- Move the session from `Active Sessions` to `Recent Archives` table
- Update `By Topic` and `By Channel` sections

### 3.4 Mark CHECKPOINT.md as Completed
- Set `status` to `"completed"`
- Update `lastUpdate` timestamp

---

## 4. Recovery: Abnormal Termination

### 4.1 Detection
If CHECKPOINT.md has `status: "in-progress"` and `lastUpdate` is older than 2 hours, report to the user:
> "Previous session appears to have terminated abnormally."

### 4.2 Check Git State
Run `git status` and `git diff --stat` to identify uncommitted changes.

### 4.3 Present Recovery Options
1. **Continue** — Commit current changes and resume
2. **Review** — Show all changes, then decide
3. **Discard** — Revert all uncommitted changes
4. **New Task** — Stash changes and start fresh

### 4.4 After Recovery
- Update CHECKPOINT.md with new session info
- Create a new session file in WORKING/
- Update SESSIONS/INDEX.md

---

## 5. Channel Mechanism

- The default channel is the current git branch name
- Record the channel in session file frontmatter: `channel: <branch-name>`
- Sessions on different channels are isolated in the INDEX.md `By Channel` section

---

## 6. Important Rules

- **NEVER skip loading BOOT.md** — it is the entry point for all context
- **NEVER load all context files at once** — use task-based loading to save tokens
- **ALWAYS update CHECKPOINT.md after subtasks** — this is your safety net
- **ALWAYS record decisions in DECISIONS.md** — future sessions need this context
- **NEVER delete or modify ARCHIVED/ files** — they are the permanent record
- **Keep BOOT.md under 500 tokens** — it must be lightweight for fast loading
