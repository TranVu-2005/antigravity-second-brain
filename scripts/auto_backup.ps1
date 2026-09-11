# ==============================================================================
# Antigravity Second Brain: Windows Automated Daily Backup & Compaction Runner
# ==============================================================================

$BrainDir = "C:\Users\tvu16\.gemini\antigravity\second_brain"
$CliPath = "$BrainDir\cli.js"

Write-Host "[$(Get-Date)] Running Antigravity Second Brain Backup & Compaction..." -ForegroundColor Cyan

# 1. Hot Backup
& agy-node "$CliPath" backup

# 2. Memory Compaction
& agy-node "$CliPath" compact

# 3. Export fresh dashboard
& agy-node "$BrainDir\src\export_dashboard.js"

Write-Host "[$(Get-Date)] Second Brain Maintenance Completed!" -ForegroundColor Green
