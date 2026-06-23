#!/bin/bash
# n8n Start Script for Linux/macOS
# Usage: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== GHOST-WORKER n8n ==="
echo "Starting n8n container..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found."
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
        echo "Created .env from .env.example"
        echo "Please edit .env and set your N8N_PASSWORD before starting!"
    fi
fi

# Start containers
docker compose up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ n8n is running!"
    echo "  URL: http://localhost:5678"
    echo "  User: admin"
    echo ""
    echo "To stop: docker compose down"
    echo "To view logs: docker compose logs -f"
else
    echo ""
    echo "✗ Failed to start n8n"
    exit 1
fi
