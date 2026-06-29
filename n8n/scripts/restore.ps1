# n8n Restore Script for Windows (PowerShell)
# Usage: .\restore.ps1 [backup_name]
# Example: .\restore.ps1 "20250624-030000"

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (-not $args[0]) {
    Write-Host "Usage: .\restore.ps1 [backup_name]" -ForegroundColor Yellow
    Write-Host "`nAvailable backups:" -ForegroundColor Cyan
    Get-ChildItem -Path "$ScriptDir\backups" -Filter "n8n-backup-*.tar.gz" |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object { Write-Host "  - $($_.Name -replace 'n8n-backup-|.tar.gz','')" }
    exit 1
}

$BackupName = $args[0]
$BackupFile = "$ScriptDir\backups\n8n-backup-$BackupName.tar.gz"

if (-not (Test-Path $BackupFile)) {
    Write-Host "[ERROR] Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

# Find current volume
$VolumeName = docker volume ls -q | Where-Object { $_ -match 'n8n_data' } | Select-Object -First 1
if (-not $VolumeName) {
    Write-Host "[ERROR] Cannot find n8n volume" -ForegroundColor Red
    exit 1
}

Write-Host "=== n8n Restore ===" -ForegroundColor Cyan
Write-Host "Volume: $VolumeName" -ForegroundColor Gray
Write-Host "Backup: $BackupFile" -ForegroundColor Gray

# Confirmation
Write-Host "`n[WARNING] This will overwrite current data!" -ForegroundColor Yellow
$Confirm = Read-Host "Type 'yes' to continue"
if ($Confirm -ne 'yes') {
    Write-Host "Cancelled." -ForegroundColor Red
    exit 0
}

# Stop container before restore
Write-Host "Stopping n8n container..." -ForegroundColor Yellow
docker stop ghost-worker-n8n 2>$null
$WasRunning = $?

# Restore
Write-Host "Restoring data..." -ForegroundColor Yellow
docker run --rm `
    -v "${VolumeName}:/data" `
    -v "$ScriptDir\backups:/backup" `
    alpine sh -c "rm -rf /data/* && tar xzf '/backup/n8n-backup-$BackupName.tar.gz' -C /data"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Restore completed" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Restore failed" -ForegroundColor Red
    exit 1
}

# Restart container
if ($WasRunning) {
    Write-Host "Starting n8n container..." -ForegroundColor Yellow
    docker start ghost-worker-n8n
}

Write-Host "`nRestore done! Access n8n at http://localhost:5678" -ForegroundColor Cyan
