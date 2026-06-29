# n8n Auto-Backup (runs every 2 hours)
# Uses bash script for reliable curl operations

$ErrorActionPreference = "SilentlyContinue"

$BACKUP_DIR = "d:\GHOST-WORKER\n8n\backups\auto"
$N8N_URL = "http://localhost:5678"
$EMAIL = "nguyentruongk530042003@gmail.com"
$PASSWORD = "Truongk5@"

$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_NAME = "backup_$TIMESTAMP"
$BACKUP_PATH = "$BACKUP_DIR\$BACKUP_NAME"
$COOKIE_FILE = "$BACKUP_DIR\cookies.txt"
$TEMP_SCRIPT = "$BACKUP_DIR\backup_script.sh"

New-Item -ItemType Directory -Path $BACKUP_PATH -Force | Out-Null
New-Item -ItemType Directory -Path "$BACKUP_PATH\workflows" -Force | Out-Null
New-Item -ItemType Directory -Path "$BACKUP_PATH\credentials" -Force | Out-Null

Write-Host "[n8n-backup] Starting backup at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Write bash script to file (avoid quoting issues)
@"
#!/bin/bash
N8N_URL="$N8N_URL"
EMAIL="$EMAIL"
PASSWORD="$PASSWORD"
BACKUP_PATH="$BACKUP_PATH"
COOKIE_FILE="$COOKIE_FILE"

# Login
LOGIN_JSON="{\"emailOrLdapLoginId\":\"\$EMAIL\",\"password\":\"\$PASSWORD\"}"
curl -s -c "\$COOKIE_FILE" -X POST "\$N8N_URL/rest/login" -H "Content-Type: application/json" -d "\$LOGIN_JSON" > /dev/null

# Get workflows
curl -s -b "\$COOKIE_FILE" "\$N8N_URL/rest/workflows" > "$BACKUP_PATH/workflows_list.json"
"@ | Out-File $TEMP_SCRIPT -Encoding UTF8

# Execute bash script
bash $TEMP_SCRIPT

# Parse workflows JSON
$workflowsJson = Get-Content "$BACKUP_PATH\workflows_list.json" -Raw -ErrorAction SilentlyContinue

if ($workflowsJson) {
    try {
        $workflowsData = $workflowsJson | ConvertFrom-Json
        $workflowIds = $workflowsData.data | ForEach-Object { $_.id }
        
        $wfCount = 0
        foreach ($wfId in $workflowIds) {
            if ([string]::IsNullOrWhiteSpace($wfId)) { continue }
            
            Write-Host "[n8n-backup] Exporting workflow: $wfId..."
            bash -c "curl -s -b '$COOKIE_FILE' '$N8N_URL/rest/workflows/$wfId' > '$BACKUP_PATH/workflows/$wfId.json'"
            $wfCount++
        }
        Write-Host "[n8n-backup] Exported $wfCount workflows"
    } catch {
        Write-Host "[n8n-backup] ERROR parsing workflows: $_"
        $wfCount = 0
    }
} else {
    Write-Host "[n8n-backup] ERROR: No workflows response"
    $wfCount = 0
}

# Get credentials
bash -c "curl -s -b '$COOKIE_FILE' '$N8N_URL/rest/credentials' > '$BACKUP_PATH/credentials_list.json'"

$credsJson = Get-Content "$BACKUP_PATH\credentials_list.json" -Raw -ErrorAction SilentlyContinue

if ($credsJson) {
    try {
        $credsData = $credsJson | ConvertFrom-Json
        $credIds = $credsData.data | ForEach-Object { $_.id }
        
        $credCount = 0
        foreach ($credId in $credIds) {
            if ([string]::IsNullOrWhiteSpace($credId)) { continue }
            
            Write-Host "[n8n-backup] Exporting credential: $credId..."
            bash -c "curl -s -b '$COOKIE_FILE' '$N8N_URL/rest/credentials/$credId' > '$BACKUP_PATH/credentials/$credId.json'"
            $credCount++
        }
        Write-Host "[n8n-backup] Exported $credCount credentials"
    } catch {
        Write-Host "[n8n-backup] ERROR parsing credentials: $_"
        $credCount = 0
    }
} else {
    Write-Host "[n8n-backup] ERROR: No credentials response"
    $credCount = 0
}

# Copy database
docker cp ghost-worker-n8n:/home/node/.n8n/database.sqlite "$BACKUP_PATH\database.sqlite" 2>$null

# Create manifest
@{
    backupDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    workflowsCount = $wfCount
    credentialsCount = $credCount
    type = "auto"
} | ConvertTo-Json | Out-File "$BACKUP_PATH\manifest.json" -Encoding UTF8

# Cleanup
Remove-Item $COOKIE_FILE -Force -ErrorAction SilentlyContinue
Remove-Item $TEMP_SCRIPT -Force -ErrorAction SilentlyContinue
Remove-Item "$BACKUP_PATH\workflows_list.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$BACKUP_PATH\credentials_list.json" -Force -ErrorAction SilentlyContinue

# Compress
Set-Location $BACKUP_DIR
$tarFile = "$BACKUP_NAME.tar.gz"

tar -czf $tarFile $BACKUP_NAME 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Compress-Archive -Path $BACKUP_PATH -DestinationPath $tarFile -Force
}
Remove-Item $BACKUP_PATH -Recurse -Force

Write-Host "[n8n-backup] Created: $tarFile"

# Keep only 5 latest backups
$allBackups = Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.tar.gz" | Sort-Object LastWriteTime -Descending
$toDelete = $allBackups | Select-Object -Skip 5
foreach ($f in $toDelete) {
    Remove-Item $f.FullName -Force
    Write-Host "[n8n-backup] Removed old: $($f.Name)"
}

$remaining = (Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.tar.gz").Count
Write-Host "[n8n-backup] Complete. Backups remaining: $remaining"
