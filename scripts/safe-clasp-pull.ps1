param(
  [string]$BackupRoot = ".\backups\appscript"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
  & (Join-Path $PSScriptRoot "backup-appscript.ps1") -BackupRoot $BackupRoot
  git status --short
  clasp pull
  & (Join-Path $PSScriptRoot "git-backup.ps1") -Message "backup: post-clasp-pull $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}
finally {
  Pop-Location
}
