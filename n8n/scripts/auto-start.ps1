# Auto-start script for n8n
# Chạy khi khởi động máy

$ErrorActionPreference = "Stop"

Write-Host "=== GHOST-WORKER n8n Auto-Start ===" -ForegroundColor Cyan

# Start Docker Desktop if not running
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "Waiting for Docker to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}

# Start n8n container
Set-Location "d:\GHOST-WORKER\n8n"
docker compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ n8n is running on http://localhost:5678" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start n8n" -ForegroundColor Red
    exit 1
}
