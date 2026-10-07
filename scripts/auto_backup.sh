#!/usr/bin/env bash
# ==============================================================================
# Antigravity Second Brain: Linux Automated Maintenance & Git Backup Runner
# Can be run manually or via crontab (e.g. 0 2 * * * /path/to/auto_backup.sh)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_DIR="$(dirname "$SCRIPT_DIR")"
CLI_PATH="$BRAIN_DIR/cli.js"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Antigravity Second Brain Maintenance..."

NODE_CMD="node"
if command -v agy-node >/dev/null 2>&1; then
    NODE_CMD="agy-node"
fi

# 0. Incremental Conversation Synchronization
"$NODE_CMD" "$CLI_PATH" sync

# 1. Hot Backup (SQLite VACUUM INTO)
"$NODE_CMD" "$CLI_PATH" backup

# 2. Memory Compaction & Optimization
"$NODE_CMD" "$CLI_PATH" compact

# 3. Export fresh dashboard
"$NODE_CMD" "$BRAIN_DIR/src/export_dashboard.js"

# 4. Git Automated Backup & Push (if remote configured)
"$NODE_CMD" "$CLI_PATH" git-backup

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Second Brain Maintenance & Git Backup Completed Successfully!"
