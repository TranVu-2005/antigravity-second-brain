# ==============================================================================
# Antigravity Second Brain: Windows Automated Daily Backup & Compaction Runner
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BrainDir = Split-Path -Parent $ScriptDir
$CliPath = "$BrainDir\cli.js"

Write-Host "[$(Get-Date)] Running Antigravity Second Brain Backup & Compaction..." -ForegroundColor Cyan

$NodeCmd = if (Get-Command agy-node -ErrorAction SilentlyContinue) { "agy-node" } elseif (Get-Command node -ErrorAction SilentlyContinue) { "node" } else { "node" }

# 0. Incremental Conversation Synchronization
& $NodeCmd "$CliPath" sync

# 1. Hot Backup (SQLite VACUUM INTO)
& $NodeCmd "$CliPath" backup

# 2. Memory Compaction
& $NodeCmd "$CliPath" compact

# 3. Export fresh dashboard
& $NodeCmd "$BrainDir\src\export_dashboard.js"

# 4. Git Automated Backup & Push (if remote configured)
& $NodeCmd "$CliPath" git-backup

Write-Host "[$(Get-Date)] Second Brain Maintenance & Git Backup Completed!" -ForegroundColor Green
