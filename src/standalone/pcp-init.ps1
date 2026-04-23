# pcp-init.ps1 — Standalone PCP initializer (no Node.js required)
# Usage: iwr <url> | iex
#        or: .\pcp-init.ps1 [-Yes]

param(
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

Write-Host "=== PCP Init (Standalone) ===" -ForegroundColor Cyan
Write-Host ""

$projectName = Split-Path -Leaf (Get-Location)
$projectPurpose = "A software project"
$techStack = "Not detected"
$branch = "main"
$date = Get-Date -Format "yyyy-MM-dd"

if (Test-Path "package.json") {
    try {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($pkg.name) { $projectName = $pkg.name }
        if ($pkg.description) { $projectPurpose = $pkg.description }
        $techStack = "Node.js"
    } catch {}
} elseif (Test-Path "pyproject.toml") {
    $techStack = "Python"
} elseif (Test-Path "Cargo.toml") {
    $techStack = "Rust"
} elseif (Test-Path "go.mod") {
    $techStack = "Go"
} elseif (Test-Path "pom.xml") {
    $techStack = "Java, Maven"
} elseif (Test-Path "build.gradle.kts") {
    $techStack = "Java, Gradle (Kotlin DSL)"
} elseif (Test-Path "build.gradle") {
    $techStack = "Java, Gradle"
}

try {
    $branch = (git branch --show-current 2>$null).Trim()
    if (-not $branch) { $branch = "main" }
} catch {}

if (-not $Yes) {
    $input = Read-Host "Project name [$projectName]"
    if ($input) { $projectName = $input }
    $input = Read-Host "Project purpose [$projectPurpose]"
    if ($input) { $projectPurpose = $input }
    $input = Read-Host "Tech stack [$techStack]"
    if ($input) { $techStack = $input }
}

if (Test-Path ".ai-context") {
    Write-Host "Warning: .ai-context/ already exists. Skipping existing files." -ForegroundColor Yellow
}

$dirs = @(
    ".ai-context",
    ".ai-context\SESSIONS\WORKING",
    ".ai-context\SESSIONS\ARCHIVED",
    ".ai-context\SESSIONS\TEMP",
    ".ai-context\KNOWLEDGE\domain",
    ".ai-context\KNOWLEDGE\tech",
    ".ai-context\scripts"
)

foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

$gitkeeps = @(
    ".ai-context\SESSIONS\WORKING\.gitkeep",
    ".ai-context\SESSIONS\ARCHIVED\.gitkeep",
    ".ai-context\SESSIONS\TEMP\.gitkeep",
    ".ai-context\KNOWLEDGE\domain\.gitkeep",
    ".ai-context\KNOWLEDGE\tech\.gitkeep",
    ".ai-context\scripts\.gitkeep"
)

foreach ($gk in $gitkeeps) {
    if (-not (Test-Path $gk)) {
        Set-Content $gk "" -NoNewline
    }
}

if (-not (Test-Path ".ai-context\BOOT.md")) {
    Set-Content ".ai-context\BOOT.md" @"
# BOOT — Project Quick Snapshot

## Project
- **Name**: $projectName
- **Purpose**: $projectPurpose
- **Tech Stack**: $techStack
- **Current Phase**: development
- **Active Task**: (none yet)
- **Progress**: 0%
- **Branch**: $branch

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
2. **Key technology**: $techStack
3. **Storage format**: Pure Markdown files, git-tracked, zero dependencies
4. **Search strategy**: Index-based at small scale, qmd (optional) at scale

## Channel
- **Default**: $branch
"@
}

if (-not (Test-Path ".ai-context\PROJECT.md")) {
    Set-Content ".ai-context\PROJECT.md" @"
# PROJECT — Project Overview

## Purpose
$projectPurpose

## Tech Stack
$techStack

## Current Stage
- **Phase**: development
- **Milestone**: Project initialized with PCP
- **Next**: Define project architecture and start development
"@
}

$stubFiles = @("ARCHITECTURE.md", "DECISIONS.md", "PATTERNS.md", "WORKING.md", "CHECKPOINT.md", "GLOSSARY.md")
foreach ($f in $stubFiles) {
    $filePath = ".ai-context\$f"
    if (-not (Test-Path $filePath)) {
        $name = $f -replace '\.md$', ''
        Set-Content $filePath "# $name — (to be filled)`n"
    }
}

if (-not (Test-Path ".ai-context\SESSIONS\INDEX.md")) {
    Set-Content ".ai-context\SESSIONS\INDEX.md" @"
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
### $branch
*(no sessions yet)*
"@
}

if (-not (Test-Path "AGENTS.md")) {
    Set-Content "AGENTS.md" @"
# AGENTS — AI Context Protocol Instructions

Compatible with: OpenCode, Claude Code, Cursor, Trae, and any agent that reads AGENTS.md.

**ALWAYS** read ``.ai-context/BOOT.md`` before any other file.

## OpenCode Loading Hints
For on-demand context loading, use ``@`` references:
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
"@
}

if (-not (Test-Path "opencode.json")) {
    Set-Content "opencode.json" @"
{
  "`$schema": "https://opencode.ai/config.json",
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
"@
}

if (-not (Test-Path ".gitignore")) {
    Set-Content ".gitignore" @"
.ai-context/SESSIONS/TEMP/
.ai-context/RECOVERY.md
.ai-context/CHECKPOINT.md.tmp
"@
} else {
    $gitignore = Get-Content ".gitignore" -Raw
    if (-not ($gitignore -match ".ai-context/SESSIONS/TEMP/")) {
        Add-Content ".gitignore" "`n# PCP`n.ai-context/SESSIONS/TEMP/`n.ai-context/RECOVERY.md`n.ai-context/CHECKPOINT.md.tmp"
    }
}

Write-Host ""
Write-Host "PCP initialized successfully!" -ForegroundColor Green
Write-Host "  Project: $projectName"
Write-Host "  Tech Stack: $techStack"
Write-Host "  Branch: $branch"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review .ai-context\BOOT.md"
Write-Host "  2. Edit .ai-context\ARCHITECTURE.md"
Write-Host "  3. Start a new AI session"
Write-Host ""
Write-Host "Tool-specific:"
Write-Host "  * OpenCode: opencode.json configured for context file instructions"
Write-Host "  * Claude Code / Trae / Cursor: AGENTS.md provides loading instructions"
