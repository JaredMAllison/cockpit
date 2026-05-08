#!/usr/bin/env bash
# Build a self-contained LMF USB package.
# Usage: bash build-usb.sh [output-dir] [lmf-repo-path]
#   output-dir:    target USB directory (default: /tmp/lmf-usb)
#   lmf-repo-path: path to lmf-ollama-obsidian repo (default: ~/lmf-ollama-obsidian)
#
# ENCODING NOTE: All .ps1 files must be UTF-8 WITHOUT BOM.
# Linux editors and Write tool produce BOM-free files by default.
# If editing .ps1 files on Windows, use VS Code with "UTF-8" (not "UTF-8 with BOM").
# PowerShell 5.x rejects scripts that start with a BOM character.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COCKPIT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LMF_REPO="${2:-$HOME/lmf-ollama-obsidian}"
OUT="${1:-/tmp/lmf-usb}"
echo "Building USB package to: $OUT"
mkdir -p "$OUT"/{python,ollama/models,lmf,cockpit,vault}

# -- Compile JSX (precompiled JS, no CDN Babel needed) --
echo "Compiling JSX to JS..."
bash "$SCRIPT_DIR/../build-jsx.sh" /tmp/cockpit-compiled

# -- Cockpit (precompiled — no CDN Babel dependency) --
echo "Copying cockpit..."
rsync -av --delete /tmp/cockpit-compiled/ "$OUT/cockpit/"

# -- LMF orchestrator --
echo "Copying LMF..."
rsync -av --delete --delete-excluded --exclude='.git' --exclude='__pycache__' --exclude='tests' \
  --exclude='.worktrees' --exclude='operator/config.yaml' \
  --exclude='operator/*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  --exclude='features/testing/' \
  --exclude='.pytest_cache/' --exclude='.code-review-graph/' \
  --exclude='docs/' \
  "$LMF_REPO/" "$OUT/lmf/"

# -- kb_core (shared vault search library) --
cp ~/.local/share/obsidian-mcp/kb_core.py "$OUT/lmf/core/" 2>/dev/null || \
  echo "Note: kb_core.py not found — vault search disabled"

# -- Starter vault --
echo "Copying starter vault..."
cp -r "$SCRIPT_DIR"/vault-starter/. "$OUT/vault/"

# Check source .ps1 files for BOM before copy
echo "Checking source .ps1 files for BOM..."
for f in "$SCRIPT_DIR"/*.ps1; do
  if python3 -c "import sys; d=open('$f','rb').read(3); sys.exit(0 if d != b'\\xef\\xbb\\xbf' else 1)" 2>/dev/null; then
    echo "  OK (no BOM): $(basename $f)"
  else
    echo "  ERROR: BOM detected in source file $(basename $f) — fix before building"
    exit 1
  fi
done

# -- Deploy scripts --
echo "Copying deploy scripts..."
cp "$SCRIPT_DIR"/setup.bat     "$OUT/"
cp "$SCRIPT_DIR"/init.py       "$OUT/"
cp "$SCRIPT_DIR"/bootstrap.ps1 "$OUT/"
cp "$SCRIPT_DIR"/launch.ps1    "$OUT/"
cp "$SCRIPT_DIR"/pull-models.bat "$OUT/"
cp "$SCRIPT_DIR"/download-deps.bat "$OUT/"
cp "$SCRIPT_DIR"/teardown.bat  "$OUT/"
cp "$SCRIPT_DIR"/teardown.ps1  "$OUT/"
cp "$SCRIPT_DIR"/README-setup.txt "$OUT/"

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
