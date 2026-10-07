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

NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "⚠️ Cảnh báo: Second Brain sử dụng native node:sqlite (yêu cầu Node.js >= 22.5.0). Phiên bản hiện tại: $(node -v)"
fi

# Ensure executable bits on POSIX
chmod +x "$SCRIPT_DIR/setup.js" "$SCRIPT_DIR/cli.js" "$SCRIPT_DIR/mcp_server.js" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/hooks/"*.js 2>/dev/null || true

# Execute universal setup engine
node "$SCRIPT_DIR/setup.js" "$@"
