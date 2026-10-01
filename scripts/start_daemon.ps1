# ==============================================================================
# Antigravity Second Brain: Headless Background Embedding Daemon Launcher
# Ensures persistent, completely hidden microservice execution across boots
# ==============================================================================

param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "SilentlyContinue"
$Port = 49152

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BrainDir = Split-Path -Parent $ScriptDir
$DaemonScript = "$BrainDir\src\embedding_daemon.py"

# Resolve uv path dynamically
$UvPath = "uv.exe"
if (Get-Command uv -ErrorAction SilentlyContinue) {
    $UvPath = (Get-Command uv).Source
} else {
    $candidates = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe\uv.exe",
        "$env:USERPROFILE\.cargo\bin\uv.exe",
        "C:\Program Files\uv\uv.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $UvPath = $cand
            break
        }
    }
}

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
