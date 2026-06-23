# n8n Start Script for Windows (PowerShell)
# Usage: .\start.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=== GHOST-WORKER n8n ===" -ForegroundColor Cyan
Write-Host "Starting n8n container..." -ForegroundColor Yellow

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found. Creating from .env.example..." -ForegroundColor Red
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Please edit .env and set your N8N_PASSWORD before starting!" -ForegroundColor Red
    }
}

# Start containers
docker compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ n8n is running!" -ForegroundColor Green
    Write-Host "  URL: http://localhost:5678" -ForegroundColor Cyan
    Write-Host "  User: admin" -ForegroundColor Cyan
    Write-Host "`nTo stop: docker compose down" -ForegroundColor Gray
    Write-Host "To view logs: docker compose logs -f" -ForegroundColor Gray
} else {
    Write-Host "`n✗ Failed to start n8n" -ForegroundColor Red
    exit 1
}
