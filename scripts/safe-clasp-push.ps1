param(
  [string]$BackupRoot = ".\backups\appscript"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
  & (Join-Path $PSScriptRoot "backup-appscript.ps1") -BackupRoot $BackupRoot
  git status --short
  clasp push
}
finally {
  Pop-Location
}
