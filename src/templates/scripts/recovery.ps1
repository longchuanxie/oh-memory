# recovery.ps1 — PCP Session Recovery Script (Windows/PowerShell)

$ErrorActionPreference = "Stop"

$checkpointPath = ".ai-context\CHECKPOINT.md"

Write-Host "=== PCP Recovery Check ==="

if (-not (Test-Path $checkpointPath)) {
    Write-Host "No CHECKPOINT.md found. No recovery needed."
    exit 0
}

$checkpointContent = Get-Content $checkpointPath -Raw

function Extract-JsonValue {
    param([string]$Content, [string]$Key)
    $match = [regex]::Match($Content, """$Key""\s*:\s*""([^""]*)""")
    if ($match.Success) { return $match.Groups[1].Value } else { return "" }
}

$status = Extract-JsonValue $checkpointContent "status"
$sessionId = Extract-JsonValue $checkpointContent "sessionId"

Write-Host "Session: $sessionId, Status: $status"

if ($status -ne "in-progress") {
    Write-Host "No abnormal termination detected."
    exit 0
}

Write-Host ""
Write-Host "LIKELY ABNORMAL TERMINATION"
Write-Host ""
Write-Host "--- Git Status ---"
try {
    git status --short 2>$null
} catch {
    Write-Host "Not a git repository or git not available"
}

Write-Host ""
Write-Host "Recovery Options:"
Write-Host "1. Continue  — Commit and resume"
Write-Host "2. Review    — Show changes"
Write-Host "3. Discard   — Revert to last commit"
Write-Host "4. New Task  — Stash and start fresh"
