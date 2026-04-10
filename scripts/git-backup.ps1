param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  $status = git status --short
  if (-not $status) {
    Write-Output "No hay cambios para respaldar en Git."
    exit 0
  }

  if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "backup: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  }

  git add .
  git commit -m $Message
}
finally {
  Pop-Location
}
