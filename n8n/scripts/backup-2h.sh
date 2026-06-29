#!/bin/bash
# n8n Auto-Backup (runs every 2 hours)

set -e

BACKUP_DIR="d:/GHOST-WORKER/n8n/backups/auto"
N8N_URL="http://localhost:5678"
EMAIL="nguyentruongk530042003@gmail.com"
PASSWORD="Truongk5@"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
COOKIE_FILE="$BACKUP_DIR/cookies.txt"

echo "[n8n-backup] Starting backup at $(date +%Y-%m-%d\ %H:%M:%S)"

# Create folders
mkdir -p "$BACKUP_PATH/workflows"
mkdir -p "$BACKUP_PATH/credentials"

# Login
LOGIN_JSON="{\"emailOrLdapLoginId\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
curl -s -c "$COOKIE_FILE" -X POST "$N8N_URL/rest/login" \
    -H "Content-Type: application/json" -d "$LOGIN_JSON" > /dev/null

if [ ! -f "$COOKIE_FILE" ]; then
    echo "[n8n-backup] ERROR: Cannot connect to n8n"
    exit 1
fi

echo "[n8n-backup] Login OK"

# Get workflows
curl -s -b "$COOKIE_FILE" "$N8N_URL/rest/workflows" > "$BACKUP_PATH/workflows_list.json"

# Parse workflow IDs using grep
WF_IDS=$(grep -oP '"id":"\K[^"]+' "$BACKUP_PATH/workflows_list.json" | sort -u)

WF_COUNT=0
for WF_ID in $WF_IDS; do
    if [ ${#WF_ID} -lt 10 ]; then continue; fi
    echo "[n8n-backup] Exporting workflow: $WF_ID"
    curl -s -b "$COOKIE_FILE" "$N8N_URL/rest/workflows/$WF_ID" > "$BACKUP_PATH/workflows/$WF_ID.json"
    WF_COUNT=$((WF_COUNT + 1))
done

echo "[n8n-backup] Exported $WF_COUNT workflows"

# Get credentials
curl -s -b "$COOKIE_FILE" "$N8N_URL/rest/credentials" > "$BACKUP_PATH/credentials_list.json"

CRED_IDS=$(grep -oP '"id":"\K[^"]+' "$BACKUP_PATH/credentials_list.json" | sort -u)

CRED_COUNT=0
for CRED_ID in $CRED_IDS; do
    if [ ${#CRED_ID} -lt 10 ]; then continue; fi
    echo "[n8n-backup] Exporting credential: $CRED_ID"
    curl -s -b "$COOKIE_FILE" "$N8N_URL/rest/credentials/$CRED_ID" > "$BACKUP_PATH/credentials/$CRED_ID.json"
    CRED_COUNT=$((CRED_COUNT + 1))
done

echo "[n8n-backup] Exported $CRED_COUNT credentials"

# Copy database
docker cp ghost-worker-n8n:/home/node/.n8n/database.sqlite "$BACKUP_PATH/database.sqlite" 2>/dev/null || true

# Create manifest
cat > "$BACKUP_PATH/manifest.json" << EOF
{
  "backupDate": "$(date +%Y-%m-%d\ %H:%M:%S)",
  "workflowsCount": $WF_COUNT,
  "credentialsCount": $CRED_COUNT,
  "type": "auto"
}
EOF

# Cleanup
rm -f "$COOKIE_FILE"
rm -f "$BACKUP_PATH/workflows_list.json"
rm -f "$BACKUP_PATH/credentials_list.json"

# Compress
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"

echo "[n8n-backup] Created: $BACKUP_NAME.tar.gz"

# Keep only 5 latest backups
BACKUPS=$(ls -1t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +6)
if [ -n "$BACKUPS" ]; then
    echo "$BACKUPS" | xargs -r rm -f
    echo "[n8n-backup] Removed old backups"
fi

REMAINING=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
echo "[n8n-backup] Complete. Backups remaining: $REMAINING"
