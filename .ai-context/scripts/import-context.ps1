# import-context.ps1 — Import .ai-context/ from a portable archive (Windows/PowerShell)

$ErrorActionPreference = "Stop"

$aiContext = ".ai-context"

Write-Host "=== PCP Import ===" -ForegroundColor Cyan

if ($args.Count -lt 1) {
    Write-Host "Usage: .\import-context.ps1 <archive.zip> [-Force]"
    Write-Host "  -Force: Overwrite existing files without prompting"
    exit 1
}

$archive = $args[0]
$force = $args.Contains("-Force")

if (-not (Test-Path $archive)) {
    Write-Host "Error: Archive not found: $archive" -ForegroundColor Red
    exit 1
}

if ((Test-Path $aiContext) -and -not $force) {
    Write-Host "Warning: .ai-context/ already exists." -ForegroundColor Yellow
    Write-Host "Existing files will be preserved. Newer files from archive will be skipped."
    Write-Host "Use -Force to overwrite."
}

$tempDir = "ai-context-import-temp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Expand-Archive -Path $archive -DestinationPath $tempDir -Force

$sourceDir = Join-Path $tempDir "ai-context"
if (-not (Test-Path $sourceDir)) {
    $sourceDir = $tempDir
}

if ($force) {
    Copy-Item -Path "$sourceDir\*" -Destination $aiContext -Recurse -Force
} else {
    Get-ChildItem -Path $sourceDir -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($sourceDir.Length + 1)
        $destPath = Join-Path $aiContext $relativePath
        if (-not (Test-Path $destPath)) {
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -Path $_.FullName -Destination $destPath -Force
        }
    }
}

Remove-Item $tempDir -Recurse -Force

Write-Host "Import complete from: $archive" -ForegroundColor Green
Write-Host "Verify context with: Get-Content $aiContext\BOOT.md"
