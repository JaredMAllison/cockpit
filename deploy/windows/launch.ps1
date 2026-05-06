#Requires -Version 5.1
# LMF daily launcher — runs from the installed location ($USERPROFILE\LMF).
# Called by the desktop shortcut with -ExecutionPolicy Bypass.

$ErrorActionPreference = "Stop"
$InstallDir = "$env:USERPROFILE\LMF"

function Fail($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
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
Start-Sleep -Seconds 4

Write-Host "Starting LMF orchestrator..." -ForegroundColor Cyan
Start-Process -FilePath "$InstallDir\python\python.exe" `
    -ArgumentList "$InstallDir\lmf\core\orchestrator.py" `
    -WorkingDirectory "$InstallDir\lmf" `
    -WindowStyle Hidden
Start-Sleep -Seconds 3

Write-Host "Starting Cockpit..." -ForegroundColor Cyan
Start-Process -FilePath "$InstallDir\python\python.exe" `
    -ArgumentList "$InstallDir\cockpit\cockpit.py" `
    -WorkingDirectory "$InstallDir\cockpit" `
    -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:9100"

Write-Host ""
Write-Host "LMF is running. Close this window or run teardown.bat to stop." -ForegroundColor Green
