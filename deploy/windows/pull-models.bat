@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0
set OLLAMA_MODELS=%ROOT%ollama\models
set MAX_RETRIES=3

if not exist "%ROOT%ollama\ollama.exe" (
    echo ERROR: ollama\ollama.exe not found. See README-setup.txt.
    pause
    exit /b 1
)

echo === Pulling Ollama models ===
echo Models saved to: %OLLAMA_MODELS%
echo Requires internet. ~5.5GB download total.
echo Ollama resumes interrupted downloads automatically.
echo.

start /B "" "%ROOT%ollama\ollama.exe" serve
timeout /t 5 /nobreak > nul

call :pull_model qwen2.5:7b
call :pull_model qwen2.5:1.5b

taskkill /IM ollama.exe /F 2>nul

echo.
echo === Models downloaded. Run launch.bat to start. ===
pause
exit /b 0

:pull_model
set RETRY=0

:retry_loop
echo Pulling %~1...
"%ROOT%ollama\ollama.exe" pull %~1
if !ERRORLEVEL! neq 0 (
    set /a RETRY+=1
    if !RETRY! leq %MAX_RETRIES% (
        echo   Retry !RETRY!/%MAX_RETRIES%...
        timeout /t 3 /nobreak > nul
        goto retry_loop
    ) else (
        echo   FAILED: %~1 after %MAX_RETRIES% attempts.
    )
) else (
    echo   OK: %~1
)
goto :eof
