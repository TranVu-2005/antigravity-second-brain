# ==============================================================================
# Antigravity Second Brain: 1-Click Environment & Configuration Restore Tool
# Restores MCP configs, Hooks, Skills, and schemas into Antigravity
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BrainDir = Split-Path -Parent $ScriptDir
$GeminiDir = "$env:USERPROFILE\.gemini"

Write-Host "[Second Brain Restore] Restoring Antigravity Integrations..." -ForegroundColor Cyan

# 1. MCP Config
$TargetConfigDir = "$GeminiDir\config"
if (!(Test-Path $TargetConfigDir)) { New-Item -ItemType Directory -Path $TargetConfigDir -Force | Out-Null }
Copy-Item "$ScriptDir\mcp_config.json" "$TargetConfigDir\mcp_config.json" -Force -ErrorAction SilentlyContinue

# 2. Hooks Config
Copy-Item "$ScriptDir\hooks.json" "$TargetConfigDir\hooks.json" -Force -ErrorAction SilentlyContinue

# 3. Skill
$TargetSkillDir = "$TargetConfigDir\skills\second-brain"
if (!(Test-Path $TargetSkillDir)) { New-Item -ItemType Directory -Path $TargetSkillDir -Force | Out-Null }
Copy-Item "$ScriptDir\skills\second-brain\SKILL.md" "$TargetSkillDir\SKILL.md" -Force -ErrorAction SilentlyContinue

# 4. MCP Schemas
$TargetMcpDir = "$GeminiDir\antigravity\mcp\second-brain"
if (!(Test-Path $TargetMcpDir)) { New-Item -ItemType Directory -Path $TargetMcpDir -Force | Out-Null }
Copy-Item "$ScriptDir\mcp_schemas\*" "$TargetMcpDir\" -Force -ErrorAction SilentlyContinue

Write-Host "[Second Brain Restore] All Antigravity configurations restored successfully!" -ForegroundColor Green
