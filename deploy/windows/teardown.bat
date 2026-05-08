@echo off
:: LMF teardown — stops services, optionally uninstalls.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0teardown.ps1"
