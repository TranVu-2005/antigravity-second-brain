# ==============================================================================
# Antigravity Second Brain: Headless Background Embedding Daemon Launcher
# Ensures persistent, completely hidden microservice execution across boots
# ==============================================================================

param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "SilentlyContinue"
$Port = 49152
$UvPath = "C:\Users\tvu16\AppData\Local\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe\uv.exe"
$DaemonScript = "C:\Users\tvu16\.gemini\antigravity\second_brain\src\embedding_daemon.py"

# Check if already running on target port
$conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conn -and -not $ForceRestart) {
    exit 0
}

# If force restart requested or port is in use, terminate previous processes
if ($ForceRestart -and $conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

# Launch via WMI with ShowWindow = 0 (SW_HIDE) so no window ever appears
$startupInfo = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [UInt16]0 }
$cmdLine = "`"$UvPath`" run --with fastembed python `"$DaemonScript`""

$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $cmdLine
    ProcessStartupInformation = $startupInfo
}

if ($res.ReturnValue -eq 0) {
    exit 0
} else {
    exit $res.ReturnValue
}
