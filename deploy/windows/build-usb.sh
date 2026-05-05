#!/usr/bin/env bash
set -e
OUT="${1:-/tmp/jason-usb}"
echo "Building USB package to: $OUT"
mkdir -p "$OUT"/{python,ollama/models,lmf,cockpit,vault}

# -- Cockpit --
echo "Copying cockpit..."
rsync -av --delete --exclude='.git' --exclude='deploy' --exclude='__pycache__' \
  --exclude='docs/' \
  ~/git/cockpit/ "$OUT/cockpit/"

# -- LMF orchestrator --
echo "Copying LMF..."
rsync -av --delete --exclude='.git' --exclude='__pycache__' --exclude='tests' \
  --exclude='.worktrees' --exclude='operator/config.yaml' \
  --exclude='operator/*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  --exclude='features/testing/results/' --exclude='features/testing/synthetic/' \
  --exclude='.pytest_cache/' --exclude='.code-review-graph/' \
  --exclude='docs/' \
  ~/lmf-ollama-obsidian/ "$OUT/lmf/"

# -- kb_core (shared vault search library) --
cp ~/.local/share/obsidian-mcp/kb_core.py "$OUT/lmf/core/" 2>/dev/null || \
  echo "Note: kb_core.py not found — vault search disabled until MCP server installed"

# -- Starter vault --
echo "Copying starter vault..."
cp -r ~/git/cockpit/deploy/windows/vault-starter/. "$OUT/vault/"

# -- Deploy scripts --
echo "Copying deploy scripts..."
cp ~/git/cockpit/deploy/windows/{setup.bat,pull-models.bat,launch.bat,stop.bat,config-template.yaml,README-setup.txt} "$OUT/"

echo ""
echo "=== Package built at $OUT ==="
echo "Next: copy to USB, then follow README-setup.txt on Jason's machine."
