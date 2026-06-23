#!/bin/bash
# n8n Restore Script for Linux/macOS
# Usage: ./restore.sh <backup_name>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_name>"
    echo "Available backups:"
    ls -1 ./backups/n8n-backup-*.tar.gz 2>/dev/null | sed 's/.*n8n-backup-//' | sed 's/.tar.gz//' || echo "  No backups found"
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_FILE="./backups/n8n-backup-$BACKUP_NAME.tar.gz"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup not found: $BACKUP_FILE"
    exit 1
fi

echo "=== n8n Restore ==="
echo "Stopping n8n..."

# Stop container
docker compose down

echo "Restoring from: $BACKUP_FILE"

# Restore volume data
docker run --rm \
    -v ghost-worker-n8n_n8n_data:/data \
    -v "$SCRIPT_DIR/backups":/backup \
    alpine sh -c "rm -rf /data/* && tar xzf '/backup/n8n-backup-$BACKUP_NAME.tar.gz' -C /data"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Restore complete!"
    echo "Starting n8n..."
    docker compose up -d
    echo ""
    echo "✓ n8n restarted with restored data"
else
    echo ""
    echo "✗ Restore failed"
    exit 1
fi
