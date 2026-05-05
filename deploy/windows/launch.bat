@echo off
setlocal
set ROOT=%~dp0
set OLLAMA_MODELS=%ROOT%ollama\models
set PYTHONPATH=%ROOT%lmf\core;%ROOT%lmf

echo === LMF Cockpit ===

if not exist "%ROOT%python\python.exe" (
    echo Run setup.bat first.
    pause & exit /b 1
)
if not exist "%ROOT%ollama\ollama.exe" (
    echo ollama\ollama.exe not found. See README-setup.txt.
    pause & exit /b 1
)

REM -- First-run: create config from template --
if not exist "%ROOT%lmf\operator\config.yaml" (
    echo First run: creating config...
    copy "%ROOT%config-template.yaml" "%ROOT%lmf\operator\config.yaml"
    echo.
    echo Please set vault_path in the config file, then re-run launch.bat.
    notepad "%ROOT%lmf\operator\config.yaml"
    pause & exit /b 0
)

REM -- Start Ollama --
echo Starting Ollama...
start /B "" "%ROOT%ollama\ollama.exe" serve
timeout /t 4 /nobreak > nul

REM -- Start LMF orchestrator --
echo Starting LMF...
start /B "" "%ROOT%python\python.exe" "%ROOT%lmf\core\orchestrator.py"
timeout /t 3 /nobreak > nul

REM -- Start Cockpit --
echo Starting Cockpit...
set COCKPIT_PORT=9100
start /B "" "%ROOT%python\python.exe" "%ROOT%cockpit\cockpit.py"
timeout /t 2 /nobreak > nul

echo Opening browser...
start http://localhost:9100

echo.
echo All services running.
echo Close this window or run stop.bat to shut down.
pause
