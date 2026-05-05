@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0

echo === LMF Cockpit — First-Time Setup ===
echo.

REM -- Verify Python embeddable is extracted --
if not exist "%ROOT%python\python.exe" (
    echo ERROR: python\python.exe not found.
    echo.
    echo 1. Download: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip
    echo 2. Extract the zip contents into the "python\" folder next to this script.
    echo 3. Re-run setup.bat.
    pause
    exit /b 1
)

REM -- Verify get-pip.py is present --
if not exist "%ROOT%python\get-pip.py" (
    echo ERROR: python\get-pip.py not found.
    echo.
    echo Download get-pip.py from: https://bootstrap.pypa.io/get-pip.py
    echo Save it as python\get-pip.py, then re-run setup.bat.
    pause
    exit /b 1
)

REM -- Patch ._pth file to enable site-packages --
set PTH_FILE=
for %%f in ("%ROOT%python\python3*._pth") do set PTH_FILE=%%f
if "!PTH_FILE!"=="" (
    echo ERROR: Cannot find python3xx._pth file in python\ folder.
    pause
    exit /b 1
)
echo Enabling site-packages in !PTH_FILE!...
powershell -NoProfile -Command ^
  "(Get-Content '!PTH_FILE!') -replace '#import site','import site' | Set-Content '!PTH_FILE!'"

REM -- Install pip --
echo Installing pip...
"%ROOT%python\python.exe" "%ROOT%python\get-pip.py" --no-warn-script-location

REM -- Install Python dependencies --
echo Installing requests and PyYAML...
"%ROOT%python\python.exe" -m pip install requests PyYAML ^
  --target="%ROOT%python\Lib\site-packages" --no-warn-script-location

echo.
echo === Setup complete! ===
echo Next: run pull-models.bat to download AI models (~5.5GB).
pause
