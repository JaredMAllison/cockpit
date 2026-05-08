#Requires -Version 5.1
# LMF Bootstrap — installs to %USERPROFILE%\LMF
# Called by setup.bat with -ExecutionPolicy Bypass so no manual policy change needed.
# Save this file as UTF-8 WITHOUT BOM (standard Linux encoding; Notepad on Windows adds BOM).

$ErrorActionPreference = "Stop"
$InstallDir = "$env:USERPROFILE\LMF"
$USB = $PSScriptRoot

function Write-Step($msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

Write-Host "=== LMF Bootstrap ===" -ForegroundColor Yellow
Write-Host "Install location: $InstallDir"
Write-Host "USB source:       $USB"

# ---------- Preflight ----------

if (-not (Test-Path "$USB\python\python.exe")) {
    Write-Host ""
    Write-Host "ERROR: python\python.exe not found on USB." -ForegroundColor Red
    Write-Host ""
    Write-Host "Before running setup, extract the Python embeddable zip into the python\ folder:"
    Write-Host "  Download: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip"
    Write-Host "  Extract contents into: $USB\python\"
    Write-Host "  Then re-run setup.bat."
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path "$USB\python\get-pip.py")) {
    Write-Host ""
    Write-Host "ERROR: python\get-pip.py not found on USB." -ForegroundColor Red
    Write-Host ""
    Write-Host "Download get-pip.py and save it to: $USB\python\get-pip.py"
    Write-Host "  https://bootstrap.pypa.io/get-pip.py"
    Read-Host "Press Enter to exit"
    exit 1
}

# Resource preflight
Write-Step "Checking system resources..."
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$drive = Split-Path $InstallDir -Qualifier
$diskGB = [math]::Round((Get-PSDrive $drive).Free / 1GB, 1)
Write-Host "  RAM:  ${ramGB} GB"
Write-Host "  Disk: ${diskGB} GB free (on $drive)"

$blocking = @()
if ($ramGB -lt 4)   { $blocking += "RAM too low ($ramGB GB) — minimum 4 GB required" }
if ($diskGB -lt 5)  { $blocking += "Disk space too low ($diskGB GB free) — minimum 5 GB needed" }
if ($blocking.Count -gt 0) {
    Write-Host ""
    foreach ($b in $blocking) { Write-Host "  FAIL: $b" -ForegroundColor Red }
    Read-Host "Press Enter to exit"
    exit 1
}
if ($ramGB -lt 8)   { Write-Host "  NOTE: RAM under 8 GB — will use lightweight model (qwen2.5:3b)" -ForegroundColor Yellow }
if ($diskGB -lt 15) { Write-Host "  NOTE: Low disk space — models need ~6 GB, proceed with caution" -ForegroundColor Yellow }

# ---------- Create install directory structure ----------

Write-Step "Creating install directory: $InstallDir"
foreach ($dir in @("python", "ollama\models", "lmf\operator", "cockpit", "vault")) {
    New-Item -ItemType Directory -Force -Path "$InstallDir\$dir" | Out-Null
}

# ---------- Copy files from USB ----------

Write-Step "Copying Python..."
Copy-Item -Recurse -Force "$USB\python\*" "$InstallDir\python\"

Write-Step "Copying LMF orchestrator..."
Copy-Item -Recurse -Force "$USB\lmf\*" "$InstallDir\lmf\"

Write-Step "Copying Cockpit..."
Copy-Item -Recurse -Force "$USB\cockpit\*" "$InstallDir\cockpit\"

Write-Step "Copying starter vault..."
$vaultMarker = "$InstallDir\vault\.lmf-initialized"
if (-not (Test-Path $vaultMarker)) {
    Copy-Item -Recurse -Force "$USB\vault\*" "$InstallDir\vault\"
    Set-Content -Path $vaultMarker -Value "Initialized $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -Encoding UTF8
    Write-Host "  Vault created with starter files."
} else {
    Write-Host "  Existing vault detected — skipping vault copy to preserve your notes."
}

if (Test-Path "$USB\ollama\ollama.exe") {
    Write-Step "Copying Ollama..."
    Copy-Item -Force "$USB\ollama\ollama.exe" "$InstallDir\ollama\ollama.exe"
} else {
    Write-Host ""
    Write-Host "NOTE: ollama\ollama.exe not found on USB." -ForegroundColor Yellow
    Write-Host "  Download from https://ollama.com/download/windows (standalone binary)"
    Write-Host "  Save as: $InstallDir\ollama\ollama.exe"
    Write-Host "  Then run pull-models.bat before launching."
}

# ---------- Patch Python embeddable ._pth (enables site-packages) ----------

Write-Step "Patching Python for site-packages..."
$pthFile = Get-ChildItem "$InstallDir\python\python3*._pth" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pthFile) {
    Write-Host "  ERROR: Cannot find python3*._pth in $InstallDir\python\" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$pthContent = Get-Content $pthFile.FullName -Raw
if ($pthContent -match '#import site') {
    $pthContent -replace '#import site', 'import site' |
        Set-Content $pthFile.FullName -Encoding UTF8
    Write-Host "  Patched: $($pthFile.Name)"
} else {
    Write-Host "  Already patched: $($pthFile.Name)"
}

# ---------- Install pip ----------

Write-Step "Installing pip..."
& "$InstallDir\python\python.exe" "$InstallDir\python\get-pip.py" --no-warn-script-location

# ---------- Install Python dependencies ----------

Write-Step "Installing Python dependencies (requests, PyYAML)..."
& "$InstallDir\python\python.exe" -m pip install requests PyYAML `
    --target="$InstallDir\python\Lib\site-packages" --no-warn-script-location

# ---------- Create operator config ----------

$configDest = "$InstallDir\lmf\operator\config.yaml"
if (-not (Test-Path $configDest)) {
    Write-Step "Creating operator config..."
    $vaultPath  = "$InstallDir\vault"
    $dbPath     = "$env:USERPROFILE\AppData\Local\lmf-memory\memory.db"
    $configText = @"
# LMF operator config — generated by bootstrap.ps1
vault_path: "$vaultPath"
model: qwen2.5:7b
ollama_url: http://localhost:11434/api/chat
memory_db_path: "$dbPath"
port: 8742
num_ctx: 8192
timeout_s: 300
verbose_writes: false
allow_external_writes: false
"@
    $configText | Set-Content $configDest -Encoding UTF8
    Write-Host "  Config written to: $configDest"
} else {
    Write-Host "  Config already exists — skipping. Edit manually if needed:"
    Write-Host "  $configDest"
}

# ---------- Run setup wizard (init.py) ----------

Write-Step "Running setup wizard..."
& "$InstallDir\python\python.exe" "$USB\init.py" "$InstallDir"
Copy-Item -Force "$USB\init.py" "$InstallDir\init.py"

# ---------- Copy launch scripts to install dir ----------

Write-Step "Installing launch scripts..."
Copy-Item -Force "$USB\launch.ps1"        "$InstallDir\launch.ps1"
Copy-Item -Force "$USB\pull-models.bat"   "$InstallDir\pull-models.bat"
Copy-Item -Force "$USB\stop.bat"          "$InstallDir\stop.bat"

# ---------- Desktop shortcut ----------

Write-Step "Creating desktop shortcut..."
$desktop = [System.Environment]::GetFolderPath("Desktop")
$wsh = New-Object -ComObject WScript.Shell
$sc  = $wsh.CreateShortcut("$desktop\LMF.lnk")
$sc.TargetPath       = "powershell.exe"
$sc.Arguments        = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$InstallDir\launch.ps1`""
$sc.WorkingDirectory = $InstallDir
$sc.Description      = "Launch LMF Assistant"
$sc.Save()
Write-Host "  Shortcut: $desktop\LMF.lnk"

# ---------- Done ----------

Write-Host ""
Write-Host "=== Setup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run pull-models.bat to download AI models (~5.5 GB, needs internet)"
Write-Host "  2. Double-click 'LMF' on your desktop to launch"
Write-Host ""
Read-Host "Press Enter to close"
