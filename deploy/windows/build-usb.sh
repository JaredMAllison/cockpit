#!/usr/bin/env bash
# Build a self-contained LMF USB package.
# Usage: bash build-usb.sh [output-dir]
#
# ENCODING NOTE: All .ps1 files must be UTF-8 WITHOUT BOM.
# Linux editors and Write tool produce BOM-free files by default.
# If editing .ps1 files on Windows, use VS Code with "UTF-8" (not "UTF-8 with BOM").
# PowerShell 5.x rejects scripts that start with a BOM character.
set -e
OUT="${1:-/tmp/lmf-usb}"
echo "Building USB package to: $OUT"
mkdir -p "$OUT"/{python,ollama/models,lmf,cockpit,vault}

# -- Cockpit --
echo "Copying cockpit..."
rsync -av --delete --delete-excluded --exclude='.git' --exclude='deploy' --exclude='__pycache__' \
  --exclude='docs/' \
  ~/git/cockpit/ "$OUT/cockpit/"

# -- LMF orchestrator --
echo "Copying LMF..."
rsync -av --delete --delete-excluded --exclude='.git' --exclude='__pycache__' --exclude='tests' \
  --exclude='.worktrees' --exclude='operator/config.yaml' \
  --exclude='operator/*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  --exclude='features/testing/' \
  --exclude='.pytest_cache/' --exclude='.code-review-graph/' \
  --exclude='docs/' \
  ~/lmf-ollama-obsidian/ "$OUT/lmf/"

# -- kb_core (shared vault search library) --
cp ~/.local/share/obsidian-mcp/kb_core.py "$OUT/lmf/core/" 2>/dev/null || \
  echo "Note: kb_core.py not found — vault search disabled"

# -- Starter vault --
echo "Copying starter vault..."
cp -r ~/git/cockpit/deploy/windows/vault-starter/. "$OUT/vault/"

# -- Deploy scripts --
echo "Copying deploy scripts..."
cp ~/git/cockpit/deploy/windows/setup.bat     "$OUT/"
cp ~/git/cockpit/deploy/windows/bootstrap.ps1 "$OUT/"
cp ~/git/cockpit/deploy/windows/launch.ps1    "$OUT/"
cp ~/git/cockpit/deploy/windows/pull-models.bat "$OUT/"
cp ~/git/cockpit/deploy/windows/teardown.bat  "$OUT/"
cp ~/git/cockpit/deploy/windows/teardown.ps1  "$OUT/"
cp ~/git/cockpit/deploy/windows/README-setup.txt "$OUT/"

# Verify .ps1 files have no BOM
echo "Checking for BOM in .ps1 files..."
for f in "$OUT"/*.ps1; do
  if python3 -c "import sys; d=open('$f','rb').read(3); sys.exit(0 if d != b'\\xef\\xbb\\xbf' else 1)" 2>/dev/null; then
    echo "  OK (no BOM): $f"
  else
    echo "  WARNING: BOM detected in $f — stripping..."
    python3 -c "
import sys
f = sys.argv[1]
data = open(f, 'rb').read()
if data.startswith(b'\\xef\\xbb\\xbf'):
    open(f, 'wb').write(data[3:])
    print('  Stripped BOM from', f)
" "$f"
  fi
done

echo ""
echo "=== Package built at $OUT ==="
echo "Entry point for Jason: setup.bat (double-click)"
echo "Next: copy $OUT to USB drive."
