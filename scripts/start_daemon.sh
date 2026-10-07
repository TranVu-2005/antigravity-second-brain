#!/usr/bin/env bash
# ==============================================================================
# Antigravity Second Brain: Headless Background Embedding Daemon Launcher (Linux)
# Ensures persistent, background microservice execution on Linux / POSIX
# ==============================================================================

PORT=49152
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_DIR="$(dirname "$SCRIPT_DIR")"
DAEMON_SCRIPT="$BRAIN_DIR/src/embedding_daemon.py"

# Check if port is already listening
if command -v ss >/dev/null 2>&1; then
    if ss -lptn "sport = :$PORT" | grep -q ":$PORT"; then
        exit 0
    fi
elif command -v netstat >/dev/null 2>&1; then
    if netstat -tlpn 2>/dev/null | grep -q ":$PORT"; then
        exit 0
    fi
fi

# Locate uv or python3
UV_CMD="uv"
if ! command -v uv >/dev/null 2>&1; then
    if [ -f "$HOME/.cargo/bin/uv" ]; then
        UV_CMD="$HOME/.cargo/bin/uv"
    elif [ -f "$HOME/.local/bin/uv" ]; then
        UV_CMD="$HOME/.local/bin/uv"
    else
        UV_CMD=""
    fi
fi

if [ -n "$UV_CMD" ]; then
    nohup "$UV_CMD" run --with fastembed python3 "$DAEMON_SCRIPT" >/dev/null 2>&1 &
elif command -v python3 >/dev/null 2>&1; then
    nohup python3 "$DAEMON_SCRIPT" >/dev/null 2>&1 &
fi

exit 0
