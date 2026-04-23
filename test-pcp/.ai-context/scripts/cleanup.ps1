# cleanup.ps1 — PCP Session Cleanup Script (Windows/PowerShell)

$ErrorActionPreference = "Stop"

$aiContext = ".ai-context"
$tempDir = Join-Path $aiContext "SESSIONS\TEMP"
$workingDir = Join-Path $aiContext "SESSIONS\WORKING"
$archivedDir = Join-Path $aiContext "SESSIONS\ARCHIVED"
$now = Get-Date

Write-Host "=== PCP Cleanup ==="

$tempCount = 0
if (Test-Path $tempDir) {
    Get-ChildItem -Path $tempDir -File | ForEach-Object {
        $age = ($now - $_.LastWriteTime).TotalHours
        if ($age -ge 24) {
            Write-Host "  Deleting: $($_.Name)"
            Remove-Item $_.FullName -Force
            $tempCount++
        }
    }
}
Write-Host "  Cleaned $tempCount TEMP file(s)"

$compressCount = 0
if (Test-Path $workingDir) {
    Get-ChildItem -Path $workingDir -Filter "*.md" -File | ForEach-Object {
        $age = ($now - $_.LastWriteTime).TotalDays
        if ($age -ge 7) {
            Write-Host "  Compressing: $($_.Name)"
            $content = Get-Content $_.FullName -Raw
            $archiveContent = @()
            $inEphemeral = $false
            foreach ($line in $content -split "`n") {
                if ($line -match "^## Detailed Log") { $inEphemeral = $true; continue }
                if ($inEphemeral -and $line -match "^## ") { $inEphemeral = $false }
                if ($inEphemeral) { continue }
                $archiveContent += $line
            }
            $archivePath = Join-Path $archivedDir $_.Name
            $archiveContent -join "`n" | Set-Content $archivePath -NoNewline
            Remove-Item $_.FullName -Force
            $compressCount++
        }
    }
}
Write-Host "  Compressed $compressCount WORKING file(s)"

Write-Host ""
Write-Host "=== Cleanup Complete ==="
Write-Host "TEMP deleted: $tempCount"
Write-Host "WORKING compressed: $compressCount"
