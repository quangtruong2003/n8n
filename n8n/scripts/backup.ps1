# n8n Backup Script for Windows (PowerShell)
# Usage: .\backup.ps1 [backup_name]
# Example: .\backup.ps1 "pre-migration-backup"

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$BackupName = if ($args[0]) { $args[0] } else { (Get-Date -Format "yyyyMMdd-HHmmss") }
$BackupDir = "./backups"

Write-Host "=== n8n Backup ===" -ForegroundColor Cyan

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$BackupFile = "$BackupDir/n8n-backup-$BackupName.tar.gz"

Write-Host "Creating backup: $BackupFile" -ForegroundColor Yellow

# Export volume data
docker run --rm `
    -v ghost-worker-n8n_n8n_data:/data `
    -v "$((Get-Location).Path)/$BackupDir":/backup `
    alpine tar czf "/backup/n8n-backup-$BackupName.tar.gz" -C /data .

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Backup created: $BackupFile" -ForegroundColor Green
    
    # Export workflows separately for easier restore
    $WorkflowsDir = "$BackupDir/workflows-$BackupName"
    New-Item -ItemType Directory -Path $WorkflowsDir -Force | Out-Null
    
    Write-Host "Backup complete!" -ForegroundColor Green
    Write-Host "`nTo restore this backup, run: .\restore.ps1 $BackupName" -ForegroundColor Cyan
} else {
    Write-Host "`n✗ Backup failed" -ForegroundColor Red
    exit 1
}
