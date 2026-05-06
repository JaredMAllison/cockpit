LMF — SETUP GUIDE
==================

FIRST-TIME SETUP (do once, from the USB):

1. PYTHON (if not already in the python\ folder)
   Download: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip
   Extract the zip CONTENTS into the "python\" folder next to setup.bat.
   (python\python.exe should exist after extraction.)

   Download: https://bootstrap.pypa.io/get-pip.py
   Save as: python\get-pip.py

2. OLLAMA (if not already in the ollama\ folder)
   Download the standalone Ollama binary for Windows (not the installer):
     https://github.com/ollama/ollama/releases
   Look for: ollama-windows-amd64.exe — rename it to ollama.exe
   Save as: ollama\ollama.exe

3. RUN SETUP
   Double-click: setup.bat
   Installs LMF to C:\Users\<you>\LMF and creates a desktop shortcut.
   No admin rights required. No execution policy changes needed.

4. DOWNLOAD AI MODELS
   In the install folder (C:\Users\<you>\LMF), double-click: pull-models.bat
   Downloads qwen2.5:7b (~4.7 GB) and qwen2.5:1.5b (~1 GB).
   Requires internet. Takes 20-40 minutes depending on connection.

DAILY USE:
   Double-click the "LMF" shortcut on your desktop.
   Opens browser to http://localhost:9100 automatically.

TO STOP / UNINSTALL:
   Double-click teardown.bat in C:\Users\<you>\LMF\
   Stops services. Optionally removes the full install.

INSTALLED LOCATION:
   C:\Users\<your-username>\LMF\
     ollama\      — Ollama binary + models
     python\      — embedded Python runtime
     lmf\         — LMF orchestrator + config
     cockpit\     — web UI
     vault\       — your personal knowledge vault

TROUBLESHOOTING:
   - "cannot be loaded because running scripts is disabled"
     This should not happen — setup.bat passes -ExecutionPolicy Bypass automatically.
     If it does, right-click setup.bat and choose "Run as administrator".
   - Services didn't start: confirm pull-models.bat completed successfully.
   - Vault path wrong: edit C:\Users\<you>\LMF\lmf\operator\config.yaml
