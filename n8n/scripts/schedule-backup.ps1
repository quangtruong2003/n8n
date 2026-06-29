# n8n Auto-Backup Scheduler
# Creates Windows Task Scheduler job to run backup every 2 hours
# Keeps 5 latest backups

$ErrorActionPreference = "Stop"

Write-Host "=== n8n Auto-Backup Scheduler ===" -ForegroundColor Cyan
Write-Host ""

$BACKUP_SCRIPT = "d:\GHOST-WORKER\n8n\scripts\backup-2h.ps1"
$BACKUP_DIR = "d:\GHOST-WORKER\n8n\backups\auto"
$TASK_NAME = "n8n-auto-backup"

# 1. Create backup script
Write-Host "[1/3] Creating backup script..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null

$backupScript = @"
# n8n Auto-Backup (runs every 2 hours)
`$ErrorActionPreference = "SilentlyContinue"

`$BACKUP_DIR = "$BACKUP_DIR"
`$N8N_URL = "http://localhost:5678"
`$EMAIL = "nguyentruongk530042003@gmail.com"
`$PASSWORD = "Truongk5@"

`$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
`$BACKUP_NAME = "backup_`$TIMESTAMP"
`$BACKUP_PATH = "`$BACKUP_DIR\`$BACKUP_NAME"

New-Item -ItemType Directory -Path `$BACKUP_PATH -Force | Out-Null
New-Item -ItemType Directory -Path "`$BACKUP_PATH\workflows" -Force | Out-Null
New-Item -ItemType Directory -Path "`$BACKUP_PATH\credentials" -Force | Out-Null

Write-Host "[n8n-backup] Starting backup at `$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Login
`$loginResult = curl -s -c "`$BACKUP_PATH\cookies.txt" -X POST "`$N8N_URL/rest/login" -H "Content-Type: application/json" -d "{\`"emailOrLdapLoginId\`":\`"`$EMAIL\`",\`"password\`":\`"`$PASSWORD\`"}"

if (`$loginResult -notmatch '"id":"') {
    Write-Host "[n8n-backup] ERROR: Cannot connect to n8n"
    exit 1
}

# Export workflows
`$workflowsJson = curl -s -b "`$BACKUP_PATH\cookies.txt" "`$N8N_URL/rest/workflows"
`$wfIds = [regex]::Matches(`$workflowsJson, '"id":"([^"]+)"') | ForEach-Object { `$_.Groups[1].Value } | Select-Object -Unique

`$wfCount = 0
foreach (`$wfId in `$wfIds) {
    if ([string]::IsNullOrWhiteSpace(`$wfId)) { continue }
    curl -s -b "`$BACKUP_PATH\cookies.txt" "`$N8N_URL/rest/workflows/`$wfId" > "`$BACKUP_PATH\workflows\`$wfId.json"
    `$wfCount++
}

# Export credentials
`$credsJson = curl -s -b "`$BACKUP_PATH\cookies.txt" "`$N8N_URL/rest/credentials"
`$credIds = [regex]::Matches(`$credsJson, '"id":"([^"]+)"') | ForEach-Object { `$_.Groups[1].Value } | Select-Object -Unique

`$credCount = 0
foreach (`$credId in `$credIds) {
    if ([string]::IsNullOrWhiteSpace(`$credId)) { continue }
    curl -s -b "`$BACKUP_PATH\cookies.txt" "`$N8N_URL/rest/credentials/`$credId" > "`$BACKUP_PATH\credentials\`$credId.json"
    `$credCount++
}

# Copy database
docker cp ghost-worker-n8n:/home/node/.n8n/database.sqlite "`$BACKUP_PATH\database.sqlite" 2>`$null

# Create manifest
@{
    backupDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    workflowsCount = `$wfCount
    credentialsCount = `$credCount
    type = "auto"
} | ConvertTo-Json | Out-File "`$BACKUP_PATH\manifest.json" -Encoding UTF8

# Cleanup cookies
Remove-Item "`$BACKUP_PATH\cookies.txt" -Force -ErrorAction SilentlyContinue

# Compress
Set-Location `$BACKUP_DIR
`$tarFile = "`$BACKUP_NAME.tar.gz"

tar -czf `$tarFile `$BACKUP_NAME 2>&1 | Out-Null
if (`$LASTEXITCODE -ne 0) {
    Compress-Archive -Path `$BACKUP_PATH -DestinationPath `$tarFile -Force
}
Remove-Item `$BACKUP_PATH -Recurse -Force

Write-Host "[n8n-backup] Created: `$tarFile"

# Keep only 5 latest backups
`$allBackups = Get-ChildItem -Path `$BACKUP_DIR -Filter "backup_*.tar.gz" | Sort-Object LastWriteTime -Descending
`$toDelete = `$allBackups | Select-Object -Skip 5
foreach (`$f in `$toDelete) {
    Remove-Item `$f.FullName -Force
    Write-Host "[n8n-backup] Removed old: `$(`$f.Name)"
}

`$remaining = (Get-ChildItem -Path `$BACKUP_DIR -Filter "backup_*.tar.gz").Count
Write-Host "[n8n-backup] Complete. Backups remaining: `$remaining"
"@

$backupScript | Out-File $BACKUP_SCRIPT -Encoding UTF8
Write-Host "  Script: $BACKUP_SCRIPT" -ForegroundColor Green

# 2. Create/Update Task Scheduler using Task Scheduler COM
Write-Host ""
Write-Host "[2/3] Creating Task Scheduler job..." -ForegroundColor Yellow

$scriptPath = (Resolve-Path $BACKUP_SCRIPT).Path

# Create Task Service
$service = New-Object -ComObject Schedule.Service
$service.Connect()

$rootFolder = $service.GetFolder("\")

# Delete existing task
try {
    $rootFolder.DeleteTask($TASK_NAME, 0)
} catch {}

# Create task definition
$taskDefinition = $service.NewTask(0)
$taskDefinition.RegistrationInfo.Description = "n8n Auto-Backup every 2 hours"
$taskDefinition.RegistrationInfo.Author = "GHOST-WORKER"

# Create principal (run whether user logged in or not)
$principal = $taskDefinition.Principal
$principal.LogonType = 4  # Run whether user is logged on or not
$principal.RunLevel = 0   # Low

# Create settings
$settings = $taskDefinition.Settings
$settings.Enabled = $true
$settings.StartWhenAvailable = $true
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false
$settings.AllowHardTerminate = $true
$settings.ExecutionTimeLimit = "PT1H"  # 1 hour max

# Create trigger - repeat every 2 hours indefinitely
$trigger = $taskDefinition.Triggers.Create(1)  # 1 = TIME trigger
$trigger.StartBoundary = (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss")
$trigger.Repetition.Interval = "PT2H"  # 2 hours
$trigger.Repetition.Duration = ""  # Indefinitely
$trigger.Repetition.StopAtDurationEnd = $false

# Create action
$action = $taskDefinition.Actions.Create(0)  # 0 = Execute
$action.Path = "powershell.exe"
$action.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Register task
$rootFolder.RegisterTaskDefinition($TASK_NAME, $taskDefinition, 6, "", "", 3)  # 6 = CreateOrUpdate

Write-Host "  Task '$TASK_NAME' created" -ForegroundColor Green

# 3. Summary
Write-Host ""
Write-Host "[3/3] Summary" -ForegroundColor Yellow
Write-Host ""

Write-Host "Backup Location: $BACKUP_DIR"
Write-Host "Backup Script:   $BACKUP_SCRIPT"
Write-Host "Schedule:        Every 2 hours"
Write-Host "Keep:            5 latest backups"
Write-Host ""

# Show next run times
$task = $rootFolder.GetTask($TASK_NAME)
$nextRun = $task.NextRunTime
Write-Host "Next backup:     $nextRun"

Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  View backups:  Get-ChildItem $BACKUP_DIR"
Write-Host "  Run now:       Start-ScheduledTask -TaskName '$TASK_NAME'"
Write-Host "  Check status:  Get-ScheduledTask -TaskName '$TASK_NAME'"
Write-Host "  Stop scheduler: Unregister-ScheduledTask -TaskName '$TASK_NAME'"
Write-Host ""
Write-Host "DONE!" -ForegroundColor Green
