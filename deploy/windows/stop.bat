@echo off
echo Stopping LMF services...
taskkill /IM ollama.exe /F 2>nul        && echo  Stopped Ollama     || echo  Ollama was not running
taskkill /F /FI "COMMANDLINE eq *cockpit.py*"      2>nul && echo  Stopped Cockpit    || echo  Cockpit was not running
taskkill /F /FI "COMMANDLINE eq *orchestrator.py*" 2>nul && echo  Stopped LMF        || echo  LMF was not running
echo Done.
