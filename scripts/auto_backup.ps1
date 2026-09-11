# ==============================================================================
# Antigravity Second Brain: Windows Automated Daily Backup & Compaction Runner
# ==============================================================================

$BrainDir = "C:\Users\tvu16\.gemini\antigravity\second_brain"
$CliPath = "$BrainDir\cli.js"

Write-Host "[$(Get-Date)] Running Antigravity Second Brain Backup & Compaction..." -ForegroundColor Cyan

$NodeCmd = "$env:APPDATA\Antigravity\bin\agy-node.cmd"

# 1. Hot Backup (SQLite VACUUM INTO)
& "$NodeCmd" "$CliPath" backup

# 2. Memory Compaction
& "$NodeCmd" "$CliPath" compact

# 3. Export fresh dashboard
& "$NodeCmd" "$BrainDir\src\export_dashboard.js"

# 4. Git Automated Backup & Push (if remote configured)
& "$NodeCmd" "$CliPath" git-backup

Write-Host "[$(Get-Date)] Second Brain Maintenance & Git Backup Completed!" -ForegroundColor Green
