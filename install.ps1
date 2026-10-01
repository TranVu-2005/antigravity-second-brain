# ==============================================================================
# Antigravity Second Brain: 1-Click Installer for Windows (PowerShell)
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Verify Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Node.js chưa được cài đặt. Vui lòng cài đặt Node.js >= 22.5.0."
    exit 1
}

# Run universal setup
node "$ScriptDir\setup.js" @args
