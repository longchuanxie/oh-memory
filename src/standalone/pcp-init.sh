#!/usr/bin/env bash
# pcp-init.sh — Standalone PCP initializer (no Node.js required)
# Usage: curl -sL <url> | bash
#        or: bash pcp-init.sh [--yes]

set -euo pipefail

INTERACTIVE=true
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
    INTERACTIVE=false
fi

echo "=== PCP Init (Standalone) ==="
echo ""

PROJECT_NAME=$(basename "$(pwd)")
PROJECT_PURPOSE="A software project"
TECH_STACK="Not detected"
BRANCH="main"
DATE=$(date +%Y-%m-%d)

if [ -f "package.json" ]; then
    PROJECT_NAME=$(node -e "console.log(require('./package.json').name || '$PROJECT_NAME')" 2>/dev/null || echo "$PROJECT_NAME")
    PROJECT_PURPOSE=$(node -e "console.log(require('./package.json').description || '')" 2>/dev/null || echo "")
    TECH_STACK="Node.js"
elif [ -f "pyproject.toml" ]; then
    TECH_STACK="Python"
elif [ -f "Cargo.toml" ]; then
    TECH_STACK="Rust"
elif [ -f "go.mod" ]; then
    TECH_STACK="Go"
elif [ -f "pom.xml" ]; then
    TECH_STACK="Java, Maven"
elif [ -f "build.gradle.kts" ]; then
    TECH_STACK="Java, Gradle (Kotlin DSL)"
elif [ -f "build.gradle" ]; then
    TECH_STACK="Java, Gradle"
fi

BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

if $INTERACTIVE; then
    read -p "Project name [$PROJECT_NAME]: " input
    PROJECT_NAME="${input:-$PROJECT_NAME}"
    read -p "Project purpose [$PROJECT_PURPOSE]: " input
    PROJECT_PURPOSE="${input:-$PROJECT_PURPOSE}"
    read -p "Tech stack [$TECH_STACK]: " input
    TECH_STACK="${input:-$TECH_STACK}"
fi

if [ -d ".ai-context" ]; then
    echo "⚠ .ai-context/ already exists. Skipping existing files."
fi

mkdir -p .ai-context/SESSIONS/{WORKING,ARCHIVED,TEMP}
mkdir -p .ai-context/KNOWLEDGE/{domain,tech}
mkdir -p .ai-context/scripts

touch .ai-context/SESSIONS/WORKING/.gitkeep
touch .ai-context/SESSIONS/ARCHIVED/.gitkeep
touch .ai-context/SESSIONS/TEMP/.gitkeep
touch .ai-context/KNOWLEDGE/domain/.gitkeep
touch .ai-context/KNOWLEDGE/tech/.gitkeep
touch .ai-context/scripts/.gitkeep

cat > .ai-context/BOOT.md << BOOTEOF
# BOOT — Project Quick Snapshot

## Project
- **Name**: ${PROJECT_NAME}
- **Purpose**: ${PROJECT_PURPOSE}
- **Tech Stack**: ${TECH_STACK}
- **Current Phase**: development
- **Active Task**: (none yet)
- **Progress**: 0%
- **Branch**: ${BRANCH}

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
1. **Architecture pattern**: (to be filled)
2. **Key technology**: ${TECH_STACK}
3. **Storage format**: Pure Markdown files, git-tracked, zero dependencies
4. **Search strategy**: Index-based at small scale, qmd (optional) at scale

## Channel
- **Default**: ${BRANCH}
BOOTEOF

cat > .ai-context/PROJECT.md << PROJECTEOF
# PROJECT — Project Overview

## Purpose
${PROJECT_PURPOSE}

## Tech Stack
${TECH_STACK}

## Current Stage
- **Phase**: development
- **Milestone**: Project initialized with PCP
- **Next**: Define project architecture and start development
PROJECTEOF

for file in ARCHITECTURE.md DECISIONS.md PATTERNS.md WORKING.md CHECKPOINT.md GLOSSARY.md; do
    if [ ! -f ".ai-context/$file" ]; then
        cat > ".ai-context/$file" << EOF
# ${file%.md} — (to be filled)
EOF
    fi
done

cat > .ai-context/SESSIONS/INDEX.md << EOF
# SESSIONS INDEX

## Active Sessions
| Date | Topic | Goal | Status | File |
|------|-------|------|--------|------|
| *(none yet)* | | | | |

## Recent Archives (Last 30 Days)
| Date | Topic | Key Decisions | File |
|------|-------|---------------|------|
| *(none yet)* | | | |

## By Channel
### ${BRANCH}
*(no sessions yet)*
EOF

if [ ! -f "AGENTS.md" ]; then
    cat > AGENTS.md << EOF
# AGENTS — AI Context Protocol Instructions

Compatible with: OpenCode, Claude Code, Cursor, Trae, and any agent that reads AGENTS.md.

**ALWAYS** read \`.ai-context/BOOT.md\` before any other file.

## OpenCode Loading Hints
For on-demand context loading, use \`@\` references:
- Architecture: @.ai-context/ARCHITECTURE.md
- Patterns: @.ai-context/PATTERNS.md
- Current work: @.ai-context/WORKING.md
- Decisions: @.ai-context/DECISIONS.md
- Glossary: @.ai-context/GLOSSARY.md

Load lazily based on task type. Do NOT load all at once.

## Context Loading
| Task Type | Keywords | Files to Load |
|-----------|----------|--------------|
| **Implement** | implement, add, create, feature | PATTERNS.md + ARCHITECTURE.md |
| **Fix** | fix, bug, error, broken | WORKING.md + DECISIONS.md + recent sessions |
| **Refactor** | refactor, optimize, restructure | ARCHITECTURE.md + PATTERNS.md + DECISIONS.md |
| **History** | history, why, decision, previously | SESSIONS/INDEX.md |

## During Work
- Update CHECKPOINT.md after each subtask
- Record decisions in DECISIONS.md
- Update session file and WORKING.md

## Recovery
If CHECKPOINT.md has status "in-progress" with stale timestamp, present 4 recovery options: Continue, Review, Discard, New Task.

## Rules
- NEVER skip loading BOOT.md
- NEVER load all context files at once
- ALWAYS update CHECKPOINT.md after subtasks
- Keep BOOT.md under 500 tokens
EOF
fi

if [ ! -f "opencode.json" ]; then
    cat > opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "instructions": [
    ".ai-context/BOOT.md",
    ".ai-context/ARCHITECTURE.md",
    ".ai-context/PATTERNS.md",
    ".ai-context/DECISIONS.md",
    ".ai-context/WORKING.md",
    ".ai-context/GLOSSARY.md",
    ".ai-context/SESSIONS/INDEX.md"
  ]
}
EOF
fi

if [ ! -f ".gitignore" ]; then
    cat > .gitignore << EOF
.ai-context/SESSIONS/TEMP/
.ai-context/RECOVERY.md
.ai-context/CHECKPOINT.md.tmp
EOF
else
    if ! grep -q ".ai-context/SESSIONS/TEMP/" .gitignore 2>/dev/null; then
        echo "" >> .gitignore
        echo "# PCP" >> .gitignore
        echo ".ai-context/SESSIONS/TEMP/" >> .gitignore
        echo ".ai-context/RECOVERY.md" >> .gitignore
        echo ".ai-context/CHECKPOINT.md.tmp" >> .gitignore
    fi
fi

echo ""
echo "✓ PCP initialized successfully!"
echo "  Project: ${PROJECT_NAME}"
echo "  Tech Stack: ${TECH_STACK}"
echo "  Branch: ${BRANCH}"
echo ""
echo "Next steps:"
echo "  1. Review .ai-context/BOOT.md"
echo "  2. Edit .ai-context/ARCHITECTURE.md"
echo "  3. Start a new AI session"
echo ""
echo "Tool-specific:"
echo "  • OpenCode: opencode.json configured for context file instructions"
echo "  • Claude Code / Trae / Cursor: AGENTS.md provides loading instructions"
