# recovery.ps1 — PCP Session Recovery Script (Windows/PowerShell)
# Detects abnormal termination, checks git state, presents recovery options

$ErrorActionPreference = "Stop"

$aiContext = ".ai-context"
$checkpointPath = Join-Path $aiContext "CHECKPOINT.md"
$recoveryPath = Join-Path $aiContext "RECOVERY.md"

Write-Host "=== PCP Recovery Check ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format o)"

# --- Check if CHECKPOINT.md exists ---
if (-not (Test-Path $checkpointPath)) {
    Write-Host "No CHECKPOINT.md found. No recovery needed."
    exit 0
}

# --- Parse checkpoint ---
$checkpointContent = Get-Content $checkpointPath -Raw

function Extract-JsonValue {
    param([string]$Content, [string]$Key)
    $match = [regex]::Match($Content, """$Key""\s*:\s*""([^""]*)""")
    if ($match.Success) { return $match.Groups[1].Value } else { return "" }
}

$sessionId = Extract-JsonValue $checkpointContent "sessionId"
$status = Extract-JsonValue $checkpointContent "status"
$lastUpdate = Extract-JsonValue $checkpointContent "lastUpdate"
$currentPhase = Extract-JsonValue $checkpointContent "currentPhase"
$goal = Extract-JsonValue $checkpointContent "goal"

Write-Host "Session ID: $sessionId"
Write-Host "Status: $status"
Write-Host "Last Update: $lastUpdate"
Write-Host "Current Phase: $currentPhase"
Write-Host "Goal: $goal"

# --- Check for abnormal termination ---
if ($status -ne "in-progress") {
    Write-Host ""
    Write-Host "Checkpoint status is '$status'. No abnormal termination detected."
    exit 0
}

# Check if last update is stale (> 2 hours)
if ($lastUpdate) {
    try {
        $updateTime = [DateTime]::Parse($lastUpdate.Replace("Z", ""))
        $ageHours = ((Get-Date) - $updateTime).TotalHours

        if ($ageHours -lt 2) {
            Write-Host ""
            Write-Host "Last update was $([math]::Round($ageHours, 1))h ago (within 2h threshold). Session may still be active."
            exit 0
        }

        Write-Host ""
        Write-Host "WARNING: LIKELY ABNORMAL TERMINATION (last update $([math]::Round($ageHours, 1))h ago)" -ForegroundColor Red
    } catch {
        Write-Host ""
        Write-Host "WARNING: Could not parse lastUpdate timestamp. Assuming abnormal termination." -ForegroundColor Red
    }
}

# --- Check git dirty state ---
Write-Host ""
Write-Host "--- Git Status ---" -ForegroundColor Yellow
$gitDirty = $false
$gitBranch = "unknown"
$lastCommit = "none"

try {
    $gitBranch = (git branch --show-current 2>$null).Trim()
    Write-Host "Branch: $gitBranch"

    $gitStatus = git status --porcelain 2>$null
    if ($gitStatus) {
        $gitDirty = $true
        Write-Host "Dirty: YES" -ForegroundColor Red
        Write-Host ""
        Write-Host "Uncommitted changes:"
        $gitStatus | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "Dirty: NO (working tree clean)" -ForegroundColor Green
    }

    $lastCommit = (git log -1 --oneline 2>$null).Trim()
    Write-Host "Last commit: $lastCommit"
} catch {
    Write-Host "Not a git repository or git not available"
}

# --- Generate RECOVERY.md ---
Write-Host ""
Write-Host "--- Generating RECOVERY.md ---" -ForegroundColor Yellow

$dirtyText = if ($gitDirty) { "YES - uncommitted changes exist" } else { "NO - working tree clean" }

$recoveryContent = @"
# RECOVERY — Abnormal Termination Detected

## Detection Summary
- **Session ID**: $sessionId
- **Status**: $status
- **Last Update**: $lastUpdate
- **Current Phase**: $currentPhase
- **Goal**: $goal

## Assessment
The previous session appears to have terminated abnormally. The checkpoint indicates work was in progress.

## Git State
- **Dirty**: $dirtyText
- **Last Commit**: $lastCommit

## Last Known State
See CHECKPOINT.md for detailed progress tracking.

## Recovery Options

### Option 1: Continue
Resume the interrupted session. Commit any uncommitted changes and continue from where you left off.
``````
git add -A && git commit -m "wip: checkpoint before recovery"
# Then continue work based on CHECKPOINT.md
``````

### Option 2: Review
Show all changes made during the interrupted session before deciding.
``````
git diff
git diff --cached
# Review changes, then choose Continue or Discard
``````

### Option 3: Discard
Revert to the last committed state, discarding all uncommitted changes.
``````
git checkout .
git clean -fd
# All uncommitted changes will be lost
``````

### Option 4: New Task
Stash current changes and start fresh with a new task.
``````
git stash push -m "abandoned: $sessionId"
# Start new task
``````
"@

Set-Content $recoveryPath $recoveryContent

Write-Host "RECOVERY.md generated."
Write-Host ""
Write-Host "=== Recovery Options ===" -ForegroundColor Cyan
Write-Host "1. Continue  — Commit and resume interrupted session"
Write-Host "2. Review    — Show changes before deciding"
Write-Host "3. Discard   — Revert to last commit (loses uncommitted work)"
Write-Host "4. New Task  — Stash changes and start fresh"
Write-Host ""
Write-Host "See $recoveryPath for details."
