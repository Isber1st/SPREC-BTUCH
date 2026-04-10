param(
  [string]$BackupRoot = ".\backups\appscript"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupBase = Join-Path $projectRoot $BackupRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destination = Join-Path $backupBase $timestamp

$filesToCopy = @(
  "appsscript.json",
  "server.js",
  "index.html",
  ".clasp.json",
  ".claspignore"
)

New-Item -ItemType Directory -Force -Path $destination | Out-Null

foreach ($relativePath in $filesToCopy) {
  $source = Join-Path $projectRoot $relativePath
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

$manifest = [ordered]@{
  createdAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  projectPath = $projectRoot
  backupPath = $destination
  files = Get-ChildItem -LiteralPath $destination -File | Select-Object -ExpandProperty Name
}

$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination "manifest.json") -Encoding UTF8

Write-Output "Backup creado en: $destination"
