#!/bin/bash
# n8n Backup Script for Linux/macOS
# Usage: ./backup.sh [backup_name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKUP_NAME="${1:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_DIR="./backups"

echo "=== n8n Backup ==="
echo "Creating backup: n8n-backup-$BACKUP_NAME.tar.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export volume data
docker run --rm \
    -v ghost-worker-n8n_n8n_data:/data \
    -v "$SCRIPT_DIR/$BACKUP_DIR":/backup \
    alpine tar czf "/backup/n8n-backup-$BACKUP_NAME.tar.gz" -C /data .

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Backup created: $BACKUP_DIR/n8n-backup-$BACKUP_NAME.tar.gz"
    echo ""
    echo "To restore this backup, run: ./restore.sh $BACKUP_NAME"
else
    echo ""
    echo "✗ Backup failed"
    exit 1
fi
