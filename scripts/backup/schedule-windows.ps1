# Registers a daily Windows Task Scheduler job that runs the McCoy local backup.
# Customer dumps stay on this machine (MCCOY_BACKUP_DIR or <repo>\.data\backups).
#
# From an elevated-or-same-user PowerShell prompt in the repo (or any cwd):
#   powershell -ExecutionPolicy Bypass -File scripts\backup\schedule-windows.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\backup\schedule-windows.ps1 -At 02:30
#
# Remove:
#   Unregister-ScheduledTask -TaskName McCoy-Backup -Confirm:$false
#
# The laptop must be on (or wake) for the task to run. -StartWhenAvailable
# runs a missed job after the next login/wake.

[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$At = "02:30",
  [string]$TaskName = "McCoy-Backup"
)

$ErrorActionPreference = "Stop"

$node = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path (Join-Path $RepoRoot "scripts\backup\backup-mccoy.mjs"))) {
  throw "backup-mccoy.mjs not found under $RepoRoot"
}

$logDir = Join-Path $RepoRoot ".data\backups"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir "scheduler.log"

function Escape-SingleQuote([string]$Value) {
  return $Value.Replace("'", "''")
}

$ps = @"
Set-Location -LiteralPath '$(Escape-SingleQuote $RepoRoot)'
Add-Content -LiteralPath '$(Escape-SingleQuote $logPath)' -Value ('--- ' + (Get-Date -Format o) + ' ---')
& '$(Escape-SingleQuote $node)' --env-file=.env scripts/backup/backup-mccoy.mjs *>> '$(Escape-SingleQuote $logPath)'
exit `$LASTEXITCODE
"@
$encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($ps))
$action = New-ScheduledTaskAction `
  -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" `
  -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal `
  -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Daily McCoy Postgres + Storage backup to MCCOY_BACKUP_DIR (local only; never GitHub Artifacts)." `
  -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' daily at $At"
Write-Host "Repo: $RepoRoot"
Write-Host "Node: $node"
Write-Host "Log:  $logPath"
Write-Host "Run once now:  npm run backup:mccoy"
Write-Host "Inspect:       Task Scheduler → Task Scheduler Library → $TaskName"
