@echo off
setlocal
set ROOT=%~dp0
set OLLAMA_MODELS=%ROOT%ollama\models

if not exist "%ROOT%ollama\ollama.exe" (
    echo ERROR: ollama\ollama.exe not found. See README-setup.txt.
    pause
    exit /b 1
)

echo === Pulling Ollama models to USB ===
echo Models will be saved to: %OLLAMA_MODELS%
echo Requires internet. ~5.5GB download total.
echo.

start /B "" "%ROOT%ollama\ollama.exe" serve
timeout /t 5 /nobreak > nul

echo Pulling qwen2.5:7b (~4.7GB, main model)...
"%ROOT%ollama\ollama.exe" pull qwen2.5:7b

echo Pulling qwen2.5:1.5b (~1GB, fast fallback)...
"%ROOT%ollama\ollama.exe" pull qwen2.5:1.5b

taskkill /IM ollama.exe /F 2>nul

echo.
echo === Models downloaded. Run launch.bat to start. ===
pause
