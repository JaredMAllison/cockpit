#Requires -Version 5.1
# LMF daily launcher — runs from the installed location ($USERPROFILE\LMF).
# Called by the desktop shortcut with -ExecutionPolicy Bypass.

$ErrorActionPreference = "Stop"
$InstallDir = "$env:USERPROFILE\LMF"

function Write-Step($msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

function Fail($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

function Test-Port($hostname, $port, $label) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect($hostname, $port, $null, $null)
        $wait = $async.AsyncWaitHandle.WaitOne(3000)
        if ($wait -and $tcp.Connected) {
            Write-Host "  $label — OK" -ForegroundColor Green
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

if (-not (Test-Path "$InstallDir\python\python.exe")) { Fail "LMF not installed. Run setup.bat from the USB first." }
if (-not (Test-Path "$InstallDir\ollama\ollama.exe"))  { Fail "Ollama not found. Run pull-models.bat first." }

$configPath = "$InstallDir\lmf\operator\config.yaml"
if (-not (Test-Path $configPath)) { Fail "Config not found at $configPath. Re-run setup.bat." }

$env:PYTHONPATH = "$InstallDir\lmf\core;$InstallDir\lmf"
$env:OLLAMA_MODELS = "$InstallDir\ollama\models"

Write-Host "=== LMF ===" -ForegroundColor Yellow

Write-Host "Starting Ollama..." -ForegroundColor Cyan
Start-Process -FilePath "$InstallDir\ollama\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden
for ($i = 0; $i -lt 8; $i++) {
    if (Test-Port "localhost" 11434) { break }
    Start-Sleep -Seconds 1
}

Write-Host "Starting LMF orchestrator..." -ForegroundColor Cyan
Start-Process -FilePath "$InstallDir\python\python.exe" `
    -ArgumentList "$InstallDir\lmf\core\orchestrator.py" `
    -WorkingDirectory "$InstallDir\lmf" `
    -WindowStyle Hidden
for ($i = 0; $i -lt 6; $i++) {
    if (Test-Port "localhost" 8742) { break }
    Start-Sleep -Seconds 1
}

Write-Host "Starting Cockpit..." -ForegroundColor Cyan
Start-Process -FilePath "$InstallDir\python\python.exe" `
    -ArgumentList "$InstallDir\cockpit\cockpit.py" `
    -WorkingDirectory "$InstallDir\cockpit" `
    -WindowStyle Hidden
Start-Sleep -Seconds 1

Write-Step "Health check — verifying all services..."
$allOk = $true
if (-not (Test-Port "localhost" 11434 "Ollama"))         { Write-Host "  Ollama — NOT OK" -ForegroundColor Red; $allOk = $false }
if (-not (Test-Port "localhost" 8742   "LMF orchestrator")) { Write-Host "  LMF — NOT OK" -ForegroundColor Red; $allOk = $false }
if (-not (Test-Port "localhost" 9100   "Cockpit"))       { Write-Host "  Cockpit — NOT OK" -ForegroundColor Red; $allOk = $false }

if (-not $allOk) {
    Write-Host ""
    Write-Host "WARNING: Some services did not start." -ForegroundColor Yellow
    Write-Host "Check the logs and try again, or run teardown.bat to clean up." -ForegroundColor Yellow
}

Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:9100"

Write-Host ""
Write-Host "LMF is running. Close this window or run teardown.bat to stop." -ForegroundColor Green
