#Requires -Version 5.1
# LMF Teardown — stops services and optionally removes the install.
# Called by teardown.bat with -ExecutionPolicy Bypass.

$ErrorActionPreference = "SilentlyContinue"
$InstallDir = "$env:USERPROFILE\LMF"

Write-Host "=== LMF Teardown ===" -ForegroundColor Yellow
Write-Host ""

# ---------- Stop services ----------

Write-Host "Stopping LMF services..." -ForegroundColor Cyan

$stopped = @()
$missed  = @()

foreach ($proc in @("ollama", "python")) {
    $running = Get-Process -Name $proc -ErrorAction SilentlyContinue |
               Where-Object { $_.Path -like "$InstallDir\*" }
    if ($running) {
        $running | Stop-Process -Force
        $stopped += $proc
    } else {
        $missed += $proc
    }
}

# Fallback: kill any python processes running from InstallDir
Get-Process -Name "python" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$InstallDir*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

if ($stopped) { Write-Host "  Stopped: $($stopped -join ', ')" -ForegroundColor Green }
if ($missed)  { Write-Host "  Not running: $($missed -join ', ')" }

# ---------- Offer to uninstall ----------

Write-Host ""
$answer = Read-Host "Remove the full LMF install at $InstallDir? (y/N)"

if ($answer -match '^[Yy]$') {
    Write-Host ""
    $confirm = Read-Host "This deletes your vault and all LMF data. Type DELETE to confirm"
    if ($confirm -eq "DELETE") {
        Write-Host "Removing $InstallDir..." -ForegroundColor Red
        Remove-Item -Recurse -Force $InstallDir -ErrorAction SilentlyContinue

        # Remove desktop shortcut
        $shortcut = "$([System.Environment]::GetFolderPath('Desktop'))\LMF.lnk"
        if (Test-Path $shortcut) {
            Remove-Item -Force $shortcut
            Write-Host "Removed desktop shortcut."
        }

        Write-Host "Uninstall complete." -ForegroundColor Green
    } else {
        Write-Host "Uninstall cancelled — install directory preserved." -ForegroundColor Yellow
    }
} else {
    Write-Host "Services stopped. Install directory preserved at: $InstallDir" -ForegroundColor Green
}

Write-Host ""
Read-Host "Press Enter to close"
