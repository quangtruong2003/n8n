# n8n Backup Script for Windows (PowerShell)
# Usage: .\backup.ps1 [backup_name]
# Example: .\backup.ps1 "pre-migration-backup"
# Recommended: Run daily via Task Scheduler

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$BackupName = if ($args[0]) { $args[0] } else { (Get-Date -Format "yyyyMMdd-HHmmss") }
$BackupDir = "$ScriptDir\backups"
$MaxBackups = 30  # Keep last 30 backups (2 days at 2h intervals)

Write-Host "=== n8n Backup ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$BackupFile = "$BackupDir\n8n-backup-$BackupName.tar.gz"

Write-Host "Creating backup: $BackupFile" -ForegroundColor Yellow

# Find the correct volume name
$VolumeName = docker volume ls -q | Where-Object { $_ -match 'n8n_data' } | Select-Object -First 1
if (-not $VolumeName) {
    Write-Host "ERROR: Cannot find n8n volume" -ForegroundColor Red
    exit 1
}
Write-Host "Using volume: $VolumeName" -ForegroundColor Gray

# Backup with verification
docker run --rm `
    -v "${VolumeName}:/data" `
    -v "$BackupDir`:/backup" `
    alpine tar czf "/backup/n8n-backup-$BackupName.tar.gz" -C /data .

if ($LASTEXITCODE -eq 0) {
    $FileSize = (Get-Item "$BackupFile").Length / 1MB
    Write-Host "Backup size: $([math]::Round($FileSize, 2)) MB" -ForegroundColor Gray

    # Verify backup integrity
    Write-Host "Verifying backup integrity..." -ForegroundColor Gray
    docker run --rm `
        -v "${VolumeName}:/data" `
        -v "$BackupDir`:/backup" `
        alpine tar tzf "/backup/n8n-backup-$BackupName.tar.gz" > $null 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Verification: OK" -ForegroundColor Gray
    } else {
        Write-Host "WARNING: Backup verification failed" -ForegroundColor Yellow
    }

    # Cleanup old backups (keep only $MaxBackups)
    $OldBackups = Get-ChildItem -Path $BackupDir -Filter "n8n-backup-*.tar.gz" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip $MaxBackups

    if ($OldBackups) {
        Write-Host "Removing $($OldBackups.Count) old backup(s)..." -ForegroundColor Gray
        $OldBackups | Remove-Item -Force
    }

    Write-Host "`n[OK] Backup created: $BackupFile" -ForegroundColor Green
    Write-Host "To restore: .\restore.ps1 $BackupName" -ForegroundColor Cyan
} else {
    Write-Host "`n[ERROR] Backup failed" -ForegroundColor Red
    if (Test-Path $BackupFile) { Remove-Item $BackupFile -Force }
    exit 1
}
