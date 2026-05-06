@echo off
:: LMF setup — thin launcher. All logic is in bootstrap.ps1.
:: -ExecutionPolicy Bypass lets the script run without any policy change on Jason's machine.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0bootstrap.ps1"
