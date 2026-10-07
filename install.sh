#!/usr/bin/env bash
# ==============================================================================
# Antigravity Second Brain & Superpowers: 1-Click Installer for Linux / macOS / WSL
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verify Node.js version
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js chưa được cài đặt. Vui lòng cài đặt Node.js >= 22.5.0."
    exit 1
fi

NODE_VERSION=$(node -v | tr -d 'v')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
NODE_MINOR=$(echo "$NODE_VERSION" | cut -d'.' -f2)

if [ "$NODE_MAJOR" -lt 22 ] || ( [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ] ); then
    echo "❌ Lỗi: Second Brain yêu cầu Node.js >= 22.5.0 (để hỗ trợ native node:sqlite DatabaseSync). Phiên bản hiện tại: v$NODE_VERSION"
    exit 1
fi

# Ensure executable bits on POSIX
chmod +x "$SCRIPT_DIR/setup.js" "$SCRIPT_DIR/cli.js" "$SCRIPT_DIR/mcp_server.js" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/hooks/"*.js 2>/dev/null || true

# Execute universal setup engine
node "$SCRIPT_DIR/setup.js" "$@"
