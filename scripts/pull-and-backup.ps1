param(
  [string]$BackupRoot = ".\backups\appscript"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
  clasp pull
  & (Join-Path $PSScriptRoot "backup-appscript.ps1") -BackupRoot $BackupRoot
}
finally {
  Pop-Location
}
