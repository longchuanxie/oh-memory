# export-context.ps1 — Export .ai-context/ to a portable archive (Windows/PowerShell)

$ErrorActionPreference = "Stop"

$aiContext = ".ai-context"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = "ai-context-export-$timestamp.zip"

Write-Host "=== PCP Export ==="

if (-not (Test-Path $aiContext)) {
    Write-Host "Error: .ai-context/ directory not found"
    exit 1
}

$tempDir = "ai-context-export-temp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Copy-Item -Path $aiContext -Destination $tempDir -Recurse -Force

$excludePaths = @(
    (Join-Path $tempDir "ai-context\SESSIONS\TEMP"),
    (Join-Path $tempDir "ai-context\CHECKPOINT.md.tmp"),
    (Join-Path $tempDir "ai-context\RECOVERY.md")
)
foreach ($p in $excludePaths) { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }

Compress-Archive -Path (Join-Path $tempDir "ai-context") -DestinationPath $output -Force
Remove-Item $tempDir -Recurse -Force

$fileSize = (Get-Item $output).Length / 1KB
Write-Host "Exported to: $output ($([math]::Round($fileSize, 1)) KB)"
