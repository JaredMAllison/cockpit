@echo off
:: LMF setup — thin launcher. All logic is in bootstrap.ps1.
:: -ExecutionPolicy Bypass lets the script run without any policy change on Jason's machine.
if not exist "%~dp0bootstrap.ps1" (
    echo ERROR: bootstrap.ps1 not found in %~dp0
    echo Make sure all files were copied to the USB correctly.
    pause
    exit /b 1
)
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0bootstrap.ps1"
