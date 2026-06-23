@echo off
REM GHOST-WORKER n8n Quick Start
REM Double-click this file to start n8n

cd /d "%~dp0\.."
powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -Command "docker compose up -d; if ($LASTEXITCODE -eq 0) { Write-Host 'n8n is running on http://localhost:5678' -ForegroundColor Green } else { Write-Host 'Failed to start n8n' -ForegroundColor Red; pause }"
