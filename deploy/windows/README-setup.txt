LMF COCKPIT — SETUP GUIDE
==========================

FIRST-TIME SETUP (do this once):

1. PYTHON
   Download: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip
   Extract the zip CONTENTS into the "python\" folder next to this README.
   (python\python.exe should exist after extraction.)

   Download: https://bootstrap.pypa.io/get-pip.py
   Save as: python\get-pip.py

2. OLLAMA
   Download Ollama for Windows: https://ollama.com/download/windows
   Look for the standalone binary (ollama.exe), NOT the installer.
   Save as: ollama\ollama.exe

3. RUN SETUP
   Double-click: setup.bat
   This patches Python and installs dependencies.

4. DOWNLOAD MODELS
   Double-click: pull-models.bat
   Downloads qwen2.5:7b (~4.7GB) and qwen2.5:1.5b (~1GB).
   Requires internet. Takes 20-40 minutes.

DAILY USE:
   Double-click: launch.bat
   Opens browser to http://localhost:9100

TO STOP:
   Double-click: stop.bat   (or close the launch.bat window)
