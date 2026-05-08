@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0

echo === Downloading LMF dependencies ===
echo.
echo This script downloads Python embeddable + Ollama binary
echo into the USB folder so the offline setup works without
echo manual downloads.
echo.
echo Requires internet. ~55 MB total.
echo.

REM --- Python embeddable ---
set PYTHON_URL=https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip
set PYTHON_ZIP=%ROOT%python\python-3.12.10-embed-amd64.zip

if not exist "%ROOT%python\python.exe" (
    if not exist "%PYTHON_ZIP%" (
        echo [1/3] Downloading Python embeddable 3.12.10...
        powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%PYTHON_ZIP%'}"
        if !ERRORLEVEL! neq 0 (
            echo   FAILED: Python download. Try manually: %PYTHON_URL%
            pause
            exit /b 1
        )
    ) else (
        echo [1/3] Python zip already downloaded.
    )
    echo   Extracting...
    powershell -Command "& {Expand-Archive -Path '%PYTHON_ZIP%' -DestinationPath '%ROOT%python\' -Force}"
    echo   OK: Python embeddable extracted.
) else (
    echo [1/3] Python already extracted.
)

REM --- get-pip.py ---
set GETPIP_URL=https://bootstrap.pypa.io/get-pip.py
if not exist "%ROOT%python\get-pip.py" (
    echo [2/3] Downloading get-pip.py...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%GETPIP_URL%' -OutFile '%ROOT%python\get-pip.py'}"
    if !ERRORLEVEL! neq 0 (
        echo   FAILED: get-pip.py download. Try manually: %GETPIP_URL%
        pause
        exit /b 1
    )
    echo   OK: get-pip.py downloaded.
) else (
    echo [2/3] get-pip.py already downloaded.
)

REM --- Ollama ---
set OLLAMA_URL=https://github.com/ollama/ollama/releases/download/v0.14.1/ollama-windows-amd64.exe
set OLLAMA_EXE=%ROOT%ollama\ollama.exe
if not exist "%OLLAMA_EXE%" (
    echo [3/3] Downloading Ollama Windows binary...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%OLLAMA_URL%' -OutFile '%OLLAMA_EXE%'}"
    if !ERRORLEVEL! neq 0 (
        echo   FAILED: Ollama download. Try manually: https://ollama.com/download/windows
        pause
        exit /b 1
    )
    echo   OK: ollama.exe downloaded.
) else (
    echo [3/3] Ollama already downloaded.
)

echo.
echo === All dependencies ready. Run setup.bat to install. ===
pause
