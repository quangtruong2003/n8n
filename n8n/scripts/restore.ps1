# n8n Restore Script for Windows (PowerShell)
# Usage: .\restore.ps1 <backup_name>
# Example: .\restore.ps1 "20250619-153000"

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (-not $args[0]) {
    Write-Host "Usage: .\restore.ps1 <backup_name>" -ForegroundColor Red
    Write-Host "Available backups:" -ForegroundColor Yellow
    Get-ChildItem "./backups" -Filter "n8n-backup-*.tar.gz" | ForEach-Object { 
        $name = $_.Name -replace "n8n-backup-", "" -replace ".tar.gz", ""
        Write-Host "  - $name"
    }
    exit 1
}

$BackupName = $args[0]
$BackupFile = "./backups/n8n-backup-$BackupName.tar.gz"

if (-not (Test-Path $BackupFile)) {
    Write-Host "Backup not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "=== n8n Restore ===" -ForegroundColor Cyan
Write-Host "Stopping n8n..." -ForegroundColor Yellow

# Stop container
docker compose down

Write-Host "Restoring from: $BackupFile" -ForegroundColor Yellow

# Stop n8n container if running
docker stop ghost-worker-n8n 2>$null | Out-Null

# Restore volume data
docker run --rm `
    -v ghost-worker-n8n_n8n_data:/data `
    -v "$((Get-Location).Path)/backups":/backup `
    alpine sh -c "rm -rf /data/* && tar xzf '/backup/n8n-backup-$BackupName.tar.gz' -C /data"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Restore complete!" -ForegroundColor Green
    Write-Host "Starting n8n..." -ForegroundColor Yellow
    docker compose up -d
    Write-Host "`n✓ n8n restarted with restored data" -ForegroundColor Green
} else {
    Write-Host "`n✗ Restore failed" -ForegroundColor Red
    exit 1
}
