# Cockpit Bug Fixes + Jason USB Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining cockpit bugs, merge to main (pulling fixes to Jared's Gretchen service), then build and test a self-contained Windows USB deployment for Jason with PII stripped. **This is the pilot deployment of the Packaged Exobrain Product** (`[[packaged-exobrain-product]]`) — Jason is the first external recipient of a consumer-packaged Marlin/LMF stack.

**Architecture:** Two repos — `~/git/cockpit` (static JSX + Python HTTPServer) and `~/marlin` (Python webhook backends). USB package bundles cockpit + LMF orchestrator + Ollama Windows binary + embeddable Python + blank starter vault. All personal identifiers removed before packaging.

**Tech Stack:** React 18 (CDN Babel), Python 3.12 embeddable (Windows amd64), Ollama Windows, SQLite3, PyYAML, requests

---

## Phase 1: Bug Fixes

### Task 1: Debug — confirm BUG-001/004/005/006/013 fixes are live in browser

**Files:**
- Read: `~/git/cockpit/zelda-frame.jsx`
- Read: `~/git/cockpit/panels/ttf.jsx`

The fixes are committed to `feature/cockpit-build` and files are correct on disk. `Cache-Control: no-store` is set. Still not appearing — likely a Babel transpile error in `ttf.jsx` silently blocking the panel.

- [ ] **Step 1: Restart cockpit cleanly**
```bash
pkill -f cockpit.py 2>/dev/null; sleep 1
systemctl --user restart cockpit.service && sleep 2
systemctl --user is-active cockpit.service
```
Expected: `active`

- [ ] **Step 2: Curl-verify served file content**
```bash
curl -s http://localhost:9100/zelda-frame.jsx | grep -c "zIndex: 2"
curl -s http://localhost:9100/panels/ttf.jsx | grep -c "TtfEventDetail"
curl -s http://localhost:9100/panels/ttf.jsx | grep -c "onLanternClick"
```
Expected: `2`, `1`+, `1`+ respectively. If `0`, the wrong file is being served — stop here and check `STATIC` path in `cockpit.py`.

- [ ] **Step 3: Open browser DevTools console at http://localhost:9100**
Check for Babel/JS errors (red entries). Common cause: JSX syntax error in `ttf.jsx` or `zelda-frame.jsx` makes Babel silently skip that file, leaving the component undefined and the old behavior active.

- [ ] **Step 4: Fix any Babel errors found**
If a syntax error is reported pointing to a specific file and line, fix it, restart the service, hard-refresh. Babel errors look like: `SyntaxError: Unexpected token` with a file name in the stack trace.

- [ ] **Step 5: Verify visually**
- Corner greebles: gold flourishes at all 4 corners of the content pane
- No L/R shoulder hints in frame header
- TTF balloons colored by category (not all gold)
- Clicking a TTF balloon shows event detail overlay

- [ ] **Step 6: Commit any fixes applied**
```bash
cd ~/git/cockpit
git add -p
git commit -m "fix: resolve Babel error blocking BUG-001/004/005/006/013 visibility"
```
Only commit if changes were made.

---

### Task 2: BUG-007 — Projects API 30s TTL cache

**Files:**
- Modify: `~/marlin/project_dashboard.py`

The `/api/projects` endpoint calls `find_projects()` + `build_project_summary()` on every request — including every 30s poll from all connected cockpit tabs. No cache exists.

- [ ] **Step 1: Check feature/cockpit-backend for existing cache work**
```bash
cd ~/marlin
git show feature/cockpit-backend:project_dashboard.py | grep -n "cache\|TTL\|_PROJ" | head -10
```
If a cache already exists there, cherry-pick rather than re-implementing:
```bash
git log feature/cockpit-backend --oneline | grep -i cache
git cherry-pick <sha>
```

- [ ] **Step 2: Create fix branch if not already on one**
```bash
cd ~/marlin
git checkout -b fix/projects-api-cache
```

- [ ] **Step 3: Add TTL cache module-level vars**
Open `~/marlin/project_dashboard.py`. After the existing imports, add:
```python
import time as _time

_PROJ_CACHE: dict = {"data": None, "at": 0.0}
_PROJ_TTL = 30.0
```

- [ ] **Step 4: Wrap the /api/projects handler**
Find the section around line 178 that reads:
```python
        if path == "/api/projects":
```
Inside that branch, replace the `get_projects_summary(...)` call with:
```python
                now = _time.monotonic()
                if _PROJ_CACHE["data"] is None or now - _PROJ_CACHE["at"] > _PROJ_TTL:
                    _PROJ_CACHE["data"] = get_projects_summary(
                        self.server.projects_path,
                        self.server.tasks_path,
                    )
                    _PROJ_CACHE["at"] = now
                data = _PROJ_CACHE["data"]
```

- [ ] **Step 5: Invalidate cache on writes**
Search for any handler that writes to a project file (PUT/PATCH). After each successful write, add:
```python
_PROJ_CACHE["data"] = None
```

- [ ] **Step 6: Measure improvement**
```bash
# Restart project_dashboard if running locally
time curl -s http://localhost:7833/api/projects > /dev/null
time curl -s http://localhost:7833/api/projects > /dev/null
```
Expected: first ~2s, second <100ms.

- [ ] **Step 7: Commit**
```bash
cd ~/marlin
git add project_dashboard.py
git commit -m "fix: BUG-007 add 30s TTL cache to /api/projects"
```

---

### Task 3: BUG-008 — ADL done button in QuickhacksPanel

**Files:**
- Modify: `~/git/cockpit/hooks/api.js`
- Modify: `~/git/cockpit/panels/quickhacks.jsx`

The marlin webhook already handles `GET /done?task=<title>` (returns 302 redirect). `usePoll` has no refetch handle, so a local state approach is used to update the list immediately after done.

- [ ] **Step 1: Add markAdlDone to api.js**
Open `~/git/cockpit/hooks/api.js`. After `fetchArielTurns`, add:
```js
function markAdlDone(title) {
  return fetch(`${HOSTS.marlin}/done?task=${encodeURIComponent(title)}`, { redirect: 'manual' })
    .catch(() => {});
}
```

- [ ] **Step 2: Add local ADL state + done handler to QuickhacksPanel**
In `QuickhacksPanel`, after the existing `usePoll` calls, add:
```jsx
const [localAdls, setLocalAdls] = React.useState(null);
const displayAdls = localAdls ?? adlsData ?? [];

const handleAdlDone = React.useCallback((title) => {
  markAdlDone(title);
  setLocalAdls(prev => (prev ?? adlsData ?? []).filter(a => a.title !== title));
}, [adlsData]);
```

- [ ] **Step 3: Replace ADL row rendering**
Replace the existing ADL `{adls.map(...)` block (lines 47–52 of quickhacks.jsx) with:
```jsx
{displayAdls.map((a, i) => (
  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9a9286' }}>{a.title}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {a.start_time && <span style={{ color: '#5a5249', fontSize: 10 }}>{a.start_time}</span>}
      <button
        onClick={() => handleAdlDone(a.title)}
        style={{ background: 'transparent', border: '1px solid #2a5040', color: '#6c9a5a', borderRadius: 2, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
      >✓</button>
    </div>
  </div>
))}
```
Also update the outer check: `{adls.length > 0 &&` → `{displayAdls.length > 0 &&`

- [ ] **Step 4: Restart and test**
```bash
systemctl --user restart cockpit.service
```
Open cockpit → Map screen → click ✓ on an ADL. Verify: row disappears immediately, and after 30s poll the server state is reflected (task marked done in vault).

- [ ] **Step 5: Commit**
```bash
cd ~/git/cockpit
git add hooks/api.js panels/quickhacks.jsx
git commit -m "fix: BUG-008 ADL done button — marks task via webhook, removes row optimistically"
```

---

### Task 4: BUG-009 + BUG-010 — Vault folder collapse + scrollbar

**Files:**
- Modify: `~/git/cockpit/panels/vault.jsx`
- Modify: `~/git/cockpit/index.html`

- [ ] **Step 1: Add collapsed state to VaultPanel**
In `VaultPanel`, add after the existing `React.useState` calls:
```jsx
const [collapsed, setCollapsed] = React.useState(() => {
  try { return JSON.parse(localStorage.getItem('vault-collapsed') || '{}'); }
  catch { return {}; }
});
const toggleFolder = React.useCallback((folder) => {
  setCollapsed(prev => {
    const next = { ...prev, [folder]: !prev[folder] };
    localStorage.setItem('vault-collapsed', JSON.stringify(next));
    return next;
  });
}, []);
```

- [ ] **Step 2: Update folder header to be clickable + collapsible**
Replace the folder header `<div>` in `VaultPanel` (the one with `{folder && <div ...>{folder}/</div>}`) with:
```jsx
{folder && (
  <div
    onClick={() => toggleFolder(folder)}
    style={{ padding: '4px 16px', fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', display: 'flex', gap: 4, userSelect: 'none' }}
  >
    <span>{collapsed[folder] !== false ? '▶' : '▼'}</span>
    {folder}/
  </div>
)}
{(collapsed[folder] === false || !folder) && byFolder[folder].map(item => {
```
Close the conditional: add `)}` after the last item `</div>` for each folder's items.

Folders default to collapsed (arrow ▶). Click to expand (arrow ▼, `collapsed[folder] === false`). Root-level items (empty folder key `''`) always shown.

- [ ] **Step 3: Add scrollbar CSS to index.html**
Open `~/git/cockpit/index.html`. Before `</head>`, add:
```html
<style>
  .vault-tree::-webkit-scrollbar { width: 4px; }
  .vault-tree::-webkit-scrollbar-track { background: transparent; }
  .vault-tree::-webkit-scrollbar-thumb { background: #2a2520; border-radius: 2px; }
  .vault-tree { scrollbar-color: #2a2520 transparent; scrollbar-width: thin; }
  .preview-pane::-webkit-scrollbar { width: 4px; }
  .preview-pane::-webkit-scrollbar-track { background: transparent; }
  .preview-pane::-webkit-scrollbar-thumb { background: #2a2520; border-radius: 2px; }
  .preview-pane { scrollbar-color: #2a2520 transparent; scrollbar-width: thin; }
</style>
```

- [ ] **Step 4: Add className to tree and preview containers in vault.jsx**
In the tree scroll div (line 37): add `className="vault-tree"` to the style object's containing div.
In the preview `<pre>` (line 66): add `className="preview-pane"`.

- [ ] **Step 5: Test**
Open cockpit → Items. Folders should be collapsed by default (▶). Click to expand (▼). Scrollbar should be a thin dim line.

- [ ] **Step 6: Commit**
```bash
cd ~/git/cockpit
git add panels/vault.jsx index.html
git commit -m "fix: BUG-009 folder collapse (default collapsed, localStorage) + BUG-010 muted scrollbar"
```

---

### Task 5: BUG-011 — Preview font size control

**Files:**
- Modify: `~/git/cockpit/panels/vault.jsx`

- [ ] **Step 1: Add font size state**
In `VaultPanel`, after existing state declarations:
```jsx
const [fontSize, setFontSize] = React.useState(() => {
  return parseInt(localStorage.getItem('vault-font-size') || '10', 10);
});
const changeFontSize = (delta) => setFontSize(prev => {
  const next = Math.max(8, Math.min(24, prev + delta));
  localStorage.setItem('vault-font-size', String(next));
  return next;
});
```

- [ ] **Step 2: Add A+/A− controls to preview header**
Replace the preview header `<div>` (the one showing `previewPath || 'select a file'`) with:
```jsx
<div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, color: '#5a5249', fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {previewPath || 'select a file'}
    {loadingPreview && ' …'}
  </span>
  {previewPath && (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      <button onClick={() => changeFontSize(-1)} style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 5px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>A−</button>
      <button onClick={() => changeFontSize(1)}  style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 5px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>A+</button>
    </div>
  )}
</div>
```

- [ ] **Step 3: Apply fontSize to the preview `<pre>`**
In the `<pre>` element, replace `fontSize: 10` with `fontSize: fontSize`.

- [ ] **Step 4: Test**
Open cockpit → Items → select any file → click A+ several times. Font grows. Refresh page — size persists.

- [ ] **Step 5: Commit**
```bash
cd ~/git/cockpit
git add panels/vault.jsx
git commit -m "fix: BUG-011 vault preview font size control, A+/A−, persisted to localStorage"
```

---

### Task 6: BUG-012 — Extract ContentPane + add close button

**Files:**
- Modify: `~/git/cockpit/panels/vault.jsx`

Extracts the preview pane into a reusable `ContentPane` component so Ariel can push content into it. Adds close button. Exports globally for use in `ariel.jsx`.

- [ ] **Step 1: Add ContentPane component before VaultPanel**
At the top of `vault.jsx` (before `function VaultPanel`), add:
```jsx
function ContentPane({ path, content, loading, fontSize, onClose, onFontSizeChange }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, color: '#5a5249', fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path || 'select a file'}
          {loading && ' …'}
        </span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onFontSizeChange && path && (
            <>
              <button onClick={() => onFontSizeChange(-1)} style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 5px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>A−</button>
              <button onClick={() => onFontSizeChange(1)}  style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 5px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>A+</button>
            </>
          )}
          {onClose && (
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 6px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>✕</button>
          )}
        </div>
      </div>
      <pre className="preview-pane" style={{ flex: 1, overflow: 'auto', padding: '12px 16px', margin: 0, fontSize: fontSize || 10, color: '#9a9286', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content || (path ? '' : '← select a file to preview')}
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Replace preview pane in VaultPanel with ContentPane**
Remove the entire `{/* Preview pane */}` block (lines 61–69) and replace with:
```jsx
<ContentPane
  path={previewPath}
  content={preview}
  loading={loadingPreview}
  fontSize={fontSize}
  onFontSizeChange={changeFontSize}
  onClose={previewPath ? () => { setPreviewPath(null); setPreview(null); } : null}
/>
```
Also remove the inline font size controls from the preview header if they were added in Task 5 — `ContentPane` handles them now.

- [ ] **Step 3: Export ContentPane globally**
At the bottom of `vault.jsx`, after all function definitions:
```js
window.ContentPane = ContentPane;
```

- [ ] **Step 4: Test**
Open cockpit → Items → select a file. Verify: ✕ button appears in header, clicking it clears the preview. A+/A− still work.

- [ ] **Step 5: Commit**
```bash
cd ~/git/cockpit
git add panels/vault.jsx
git commit -m "fix: BUG-012 extract ContentPane, add close button, export window.ContentPane"
```

---

### Task 7: BUG-014 — Subscreen transition animation

**Files:**
- Modify: `~/git/cockpit/subscreen-transition.jsx`

The current code sets `phase='out'` (transition CSS + opacity 0) in the same render that it starts from `phase='idle'` (no transition + opacity 1). Some browsers don't run the transition because they never painted the in-between state. Fix: defer the phase change by one `requestAnimationFrame` so the browser paints the starting state first.

- [ ] **Step 1: Replace the phase-change useEffect**
In `subscreen-transition.jsx`, replace the first `React.useEffect` (lines 14–22) with:
```js
React.useEffect(() => {
  if (active === displayed) return;
  const fromIdx = SUBSCREEN_ORDER.indexOf(displayed);
  const toIdx   = SUBSCREEN_ORDER.indexOf(active);
  setDirection(toIdx > fromIdx ? 1 : -1);
  pendingRef.current = active;
  // Defer phase='out' one frame so the browser paints opacity:1 before transitioning to 0
  const id = requestAnimationFrame(() => {
    phaseRef.current = 'out';
    setPhase('out');
  });
  rafRef.current.push(id);
}, [active]);
```

- [ ] **Step 2: Restart and verify animation**
```bash
systemctl --user restart cockpit.service
```
Open cockpit — switch tabs with keyboard (1/2/3) and with clicks. Should see 220ms cross-fade + 12px slide in the transition direction.

- [ ] **Step 3: Commit**
```bash
cd ~/git/cockpit
git add subscreen-transition.jsx
git commit -m "fix: BUG-014 defer phase=out by one rAF so browser paints initial opacity:1 first"
```

---

## Phase 2: Merge + Sync to Gretchen

### Task 8: PR, squash-merge feature/cockpit-build → main, pull to Gretchen

**Files:**
- `~/git/cockpit` repo

- [ ] **Step 1: Confirm clean working tree**
```bash
cd ~/git/cockpit
git status
git log --oneline -5
```

- [ ] **Step 2: Create GitHub PR**
```bash
gh pr create \
  --title "fix: BUG-001 through BUG-014 — full cockpit bug pass" \
  --body "$(cat <<'EOF'
## Summary
- BUG-001: corner greebles zIndex fix
- BUG-002/003: SUBS global collision → SUBSCREEN_IDS (already in earlier commit)
- BUG-004: TTF category color via TTF_eventColor
- BUG-005: TTF label collision suppression
- BUG-006: TTF balloon click + TtfEventDetail overlay
- BUG-007: projects API 30s TTL cache (marlin backend)
- BUG-008: ADL done button, optimistic removal
- BUG-009: vault folder collapse, default collapsed, localStorage
- BUG-010: muted scrollbar (4px, #2a2520)
- BUG-011: vault preview font size A+/A−, localStorage
- BUG-012: ContentPane component extracted, close button, window.ContentPane
- BUG-013: shoulder hints removed from ZeldaFrame
- BUG-014: subscreen transition rAF phase-defer fix

## Test plan
- [ ] Corner greebles visible on all four corners
- [ ] Tab click + keyboard 1/2/3 switch screens
- [ ] TTF balloons colored by category
- [ ] ADL ✓ button marks done, row disappears
- [ ] Vault folders default collapsed, expand on click
- [ ] A+/A− font control persists on refresh
- [ ] Preview ✕ closes the pane
- [ ] Tab switching animates with cross-fade + slide

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Squash-merge**
```bash
gh pr merge --squash --auto
```

- [ ] **Step 4: Pull on Gretchen and restart cockpit service**
```bash
ssh jared@10.0.0.8 "cd ~/git/cockpit && git pull && systemctl --user restart cockpit.service && systemctl --user is-active cockpit.service"
```
Expected: `active`

- [ ] **Step 5: Verify Gretchen is serving updated code**
```bash
ssh jared@10.0.0.8 "curl -s http://localhost:9100/zelda-frame.jsx | grep -c 'zIndex: 2'"
```
Expected: `2`

---

## Phase 3: USB Deployment Package

### Task 9: USB directory structure + build script

**Files:**
- Create: `~/git/cockpit/deploy/windows/build-usb.sh`
- Create: `~/git/cockpit/deploy/windows/vault-starter/` (directory tree)

- [ ] **Step 1: Create directory structure**
```bash
mkdir -p ~/git/cockpit/deploy/windows
mkdir -p ~/git/cockpit/deploy/windows/vault-starter/System/Memory
mkdir -p ~/git/cockpit/deploy/windows/vault-starter/System/Skills
mkdir -p ~/git/cockpit/deploy/windows/vault-starter/Tasks
mkdir -p ~/git/cockpit/deploy/windows/vault-starter/Projects
```

- [ ] **Step 2: Create blank vault files**

Create `~/git/cockpit/deploy/windows/vault-starter/Inbox.md`:
```markdown
# Inbox

Raw capture buffer. Add notes here for the assistant to process.
```

Create `~/git/cockpit/deploy/windows/vault-starter/System/Memory/ARIEL.md`:
```markdown
---
title: Assistant Identity
type: identity
---

You are a personal knowledge assistant with access to the operator's vault.

You help the operator manage tasks, projects, and notes. You can search the vault,
read notes, and with operator confirmation, create or update notes.

Be concise. Ask before writing. Confirm before deleting anything.
```

Create `~/git/cockpit/deploy/windows/vault-starter/System/Memory/MEMORY.md`:
```markdown
# Memory Index

(No memories yet — memories will appear here as you use the assistant.)
```

- [ ] **Step 3: Create build-usb.sh**
Create `~/git/cockpit/deploy/windows/build-usb.sh`:
```bash
#!/usr/bin/env bash
set -e
OUT="${1:-/tmp/jason-usb}"
echo "Building USB package to: $OUT"
mkdir -p "$OUT"/{python,ollama/models,lmf,cockpit,vault}

# -- Cockpit --
echo "Copying cockpit..."
rsync -av --exclude='.git' --exclude='deploy' --exclude='__pycache__' \
  ~/git/cockpit/ "$OUT/cockpit/"

# -- LMF orchestrator --
echo "Copying LMF..."
rsync -av --exclude='.git' --exclude='__pycache__' --exclude='tests' \
  --exclude='.worktrees' --exclude='operator/config.yaml' \
  ~/lmf-ollama-obsidian/ "$OUT/lmf/"

# -- kb_core (shared vault search library) --
cp ~/.local/share/obsidian-mcp/kb_core.py "$OUT/lmf/core/" 2>/dev/null || \
  echo "Note: kb_core.py not found — vault search disabled until MCP server installed"

# -- Starter vault --
echo "Copying starter vault..."
cp -r ~/git/cockpit/deploy/windows/vault-starter/. "$OUT/vault/"

echo ""
echo "=== Package built at $OUT ==="
echo "Next: copy to USB, then follow README-setup.txt on Jason's machine."
```

```bash
chmod +x ~/git/cockpit/deploy/windows/build-usb.sh
```

- [ ] **Step 4: Commit**
```bash
cd ~/git/cockpit
git add deploy/
git commit -m "feat: USB deployment structure, build script, blank starter vault"
```

---

### Task 10: Embeddable Python setup script

**Files:**
- Create: `~/git/cockpit/deploy/windows/setup.bat`
- Create: `~/git/cockpit/deploy/windows/README-setup.txt`

Embeddable Python doesn't include pip or site-packages by default. The `._pth` file must be patched to enable installed packages.

- [ ] **Step 1: Create setup.bat**
Create `~/git/cockpit/deploy/windows/setup.bat`:
```batch
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
```

- [ ] **Step 2: Create README-setup.txt**
Create `~/git/cockpit/deploy/windows/README-setup.txt`:
```
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
```

- [ ] **Step 3: Commit**
```bash
cd ~/git/cockpit
git add deploy/windows/setup.bat deploy/windows/README-setup.txt
git commit -m "feat: Windows embeddable Python setup script + setup README"
```

---

### Task 11: Ollama model pull script + LMF config template

**Files:**
- Create: `~/git/cockpit/deploy/windows/pull-models.bat`
- Create: `~/git/cockpit/deploy/windows/config-template.yaml`

Models are pulled at install time from Ollama's registry rather than bundled (too large). `OLLAMA_MODELS` is set to the USB path so models survive USB moves.

- [ ] **Step 1: Create pull-models.bat**
Create `~/git/cockpit/deploy/windows/pull-models.bat`:
```batch
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
```

- [ ] **Step 2: Create config-template.yaml**
Create `~/git/cockpit/deploy/windows/config-template.yaml`:
```yaml
# LMF operator config
# Edit vault_path to match where your vault folder is located.
vault_path: "C:\\Users\\YourName\\Documents\\vault"
model: qwen2.5:7b
ollama_url: http://localhost:11434/api/chat
memory_db_path: "C:\\Users\\YourName\\AppData\\Local\\lmf-memory\\memory.db"
port: 8742
num_ctx: 8192
timeout_s: 300
verbose_writes: false
allow_external_writes: false
```

- [ ] **Step 3: Commit**
```bash
cd ~/git/cockpit
git add deploy/windows/pull-models.bat deploy/windows/config-template.yaml
git commit -m "feat: Ollama model pull script + LMF config template (no PII)"
```

---

### Task 12: Launch + stop scripts

**Files:**
- Create: `~/git/cockpit/deploy/windows/launch.bat`
- Create: `~/git/cockpit/deploy/windows/stop.bat`

- [ ] **Step 1: Create launch.bat**
Create `~/git/cockpit/deploy/windows/launch.bat`:
```batch
@echo off
setlocal
set ROOT=%~dp0
set OLLAMA_MODELS=%ROOT%ollama\models
set PYTHONPATH=%ROOT%lmf\core;%ROOT%lmf

echo === LMF Cockpit ===

if not exist "%ROOT%python\python.exe" (
    echo Run setup.bat first.
    pause & exit /b 1
)
if not exist "%ROOT%ollama\ollama.exe" (
    echo ollama\ollama.exe not found. See README-setup.txt.
    pause & exit /b 1
)

REM -- First-run: create config from template --
if not exist "%ROOT%lmf\operator\config.yaml" (
    echo First run: creating config...
    copy "%ROOT%config-template.yaml" "%ROOT%lmf\operator\config.yaml"
    echo.
    echo Please set vault_path in the config file, then re-run launch.bat.
    notepad "%ROOT%lmf\operator\config.yaml"
    pause & exit /b 0
)

REM -- Start Ollama --
echo Starting Ollama...
start /B "" "%ROOT%ollama\ollama.exe" serve
timeout /t 4 /nobreak > nul

REM -- Start LMF orchestrator --
echo Starting LMF...
start /B "" "%ROOT%python\python.exe" "%ROOT%lmf\core\orchestrator.py"
timeout /t 3 /nobreak > nul

REM -- Start Cockpit --
echo Starting Cockpit...
set COCKPIT_PORT=9100
start /B "" "%ROOT%python\python.exe" "%ROOT%cockpit\cockpit.py"
timeout /t 2 /nobreak > nul

echo Opening browser...
start http://localhost:9100

echo.
echo All services running.
echo Close this window or run stop.bat to shut down.
pause
```

- [ ] **Step 2: Create stop.bat**
Create `~/git/cockpit/deploy/windows/stop.bat`:
```batch
@echo off
echo Stopping LMF services...
taskkill /IM ollama.exe /F 2>nul        && echo  Stopped Ollama     || echo  Ollama was not running
taskkill /F /FI "COMMANDLINE eq *cockpit.py*"      2>nul && echo  Stopped Cockpit    || echo  Cockpit was not running
taskkill /F /FI "COMMANDLINE eq *orchestrator.py*" 2>nul && echo  Stopped LMF        || echo  LMF was not running
echo Done.
```

- [ ] **Step 3: Commit**
```bash
cd ~/git/cockpit
git add deploy/windows/launch.bat deploy/windows/stop.bat
git commit -m "feat: Windows launch.bat + stop.bat"
```

---

### Task 13: PII audit and strip

**Files:**
- Modify: `~/git/cockpit/hooks/api.js`
- Modify: `~/git/cockpit/deploy/windows/build-usb.sh` (exclusion list)
- Audit: `~/lmf-ollama-obsidian/core/tools.config.yaml`

All personal identifiers (IPs, names, vault paths) must be removed from anything shipped to Jason.

- [ ] **Step 1: Fix ariel host in api.js**
The current `api.js` has `ariel: 'http://10.0.0.78:8742'` (Jared's Bazza IP). Jason's LMF runs locally.
In `~/git/cockpit/hooks/api.js`, change:
```js
const HOSTS = {
  marlin:   'http://localhost:7832',
  projects: 'http://localhost:7833',
  ttf:      'http://localhost:3000',
  ariel:    'http://localhost:8742',   // was: 10.0.0.78:8742 (Jared's LAN IP)
};
```

- [ ] **Step 2: Scan LMF source for PII**
```bash
grep -rn "jared\|Jared\|Marlin\|gretchen\|Gretchen\|10\.0\.0\.\|obsidian\|Obsidian" \
  ~/lmf-ollama-obsidian/core/ \
  --include="*.py" --include="*.yaml" --include="*.md" \
  | grep -v "__pycache__"
```
Review each hit. The comment `# Ariel von Marlin` in `tools.config.yaml` is instance-specific — update to a generic comment. The default vault path fallback in `build_prompt.py` line 173 is benign (overridden by arg) but can be generalized:

In `build_prompt.py` line 173, change:
```python
vault = sys.argv[1] if len(sys.argv) > 1 else str(Path.home() / "Documents/Obsidian/Marlin")
```
to:
```python
vault = sys.argv[1] if len(sys.argv) > 1 else str(Path.home() / "Documents" / "vault")
```

In `tools.config.yaml` line 1, change:
```yaml
# Ariel von Marlin — tool manifest
```
to:
```yaml
# LMF assistant — tool manifest
```

- [ ] **Step 3: Scan starter vault for PII**
```bash
grep -rn "jared\|Jared\|Marlin\|Gretchen\|10\.0\." \
  ~/git/cockpit/deploy/windows/vault-starter/
```
Expected: no matches. Fix any found.

- [ ] **Step 4: Confirm config-template.yaml contains no PII**
```bash
grep -n "jared\|Jared\|Gretchen\|10\.0\." ~/git/cockpit/deploy/windows/config-template.yaml
```
Expected: no matches.

- [ ] **Step 5: Add explicit exclusions to build-usb.sh**
Update the LMF rsync line in `build-usb.sh` to also exclude any instance-specific files:
```bash
rsync -av --exclude='.git' --exclude='__pycache__' --exclude='tests' \
  --exclude='.worktrees' --exclude='operator/config.yaml' \
  --exclude='operator/*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  ~/lmf-ollama-obsidian/ "$OUT/lmf/"
```

- [ ] **Step 6: Commit PII changes**
```bash
cd ~/git/cockpit
git add hooks/api.js deploy/windows/build-usb.sh
git commit -m "fix: strip PII for USB deployment — localhost hosts, no personal vault paths"

cd ~/lmf-ollama-obsidian
git add core/build_prompt.py core/tools.config.yaml
git commit -m "fix: remove instance-specific names from tool manifest and build_prompt default"
```

---

## Phase 4: Test

### Task 14: Local integration test (simulate USB)

This validates the package on Linux before the Windows test.

- [ ] **Step 1: Build the USB package**
```bash
bash ~/git/cockpit/deploy/windows/build-usb.sh /tmp/jason-usb
ls /tmp/jason-usb/
```
Expected: `cockpit/ lmf/ ollama/ python/ vault/` directories present.

- [ ] **Step 2: Confirm no PII in built package**
```bash
grep -rn "jared\|Jared\|10\.0\.0\.\|Gretchen\|Marlin" /tmp/jason-usb/ \
  --include="*.py" --include="*.yaml" --include="*.js" --include="*.jsx" --include="*.md" \
  | grep -v ".git"
```
Expected: no matches. If any found, fix in source and rebuild.

- [ ] **Step 3: Create a test config**
```bash
cp /tmp/jason-usb/lmf/deploy/windows/config-template.yaml /tmp/jason-usb/lmf/operator/config.yaml
sed -i 's|C:\\\\Users\\\\YourName\\\\Documents\\\\vault|/tmp/jason-usb/vault|g' /tmp/jason-usb/lmf/operator/config.yaml
sed -i 's|C:\\\\Users\\\\YourName\\\\AppData\\\\Local\\\\lmf-memory\\\\memory.db|/tmp/lmf-test-memory.db|g' /tmp/jason-usb/lmf/operator/config.yaml
```

- [ ] **Step 4: Start LMF from USB directory**
```bash
cd /tmp/jason-usb/lmf/core
python3 orchestrator.py /tmp/jason-usb/vault &
LMF_PID=$!
sleep 3
curl -s http://localhost:8742/health
```
Expected: `{"status": "ok"}` or similar JSON. Kill the process: `kill $LMF_PID`

- [ ] **Step 5: Start cockpit from USB directory**
```bash
cd /tmp/jason-usb/cockpit
COCKPIT_PORT=9101 python3 cockpit.py &
COCK_PID=$!
sleep 2
curl -s http://localhost:9101/ | grep -c "react\|cockpit\|zelda"
kill $COCK_PID
```
Expected: > 0 matches (HTML served correctly).

- [ ] **Step 6: Confirm localhost-only HOSTS in cockpit**
```bash
grep "HOSTS" /tmp/jason-usb/cockpit/hooks/api.js
```
Expected: all values are `localhost` or `127.0.0.1`.

---

### Task 15: Jason Windows deployment test

Real-world test on Jason's machine with the physical USB.

- [ ] **Step 1: Copy package to USB drive**
Find the USB mount point on the build machine:
```bash
lsblk -o NAME,MOUNTPOINT | grep -v loop | grep -v "^$"
```
Then build directly to the USB (substitute `E:` or the actual mount):
```bash
USBD="/mnt/e"   # adjust to match actual USB mount point
bash ~/git/cockpit/deploy/windows/build-usb.sh "$USBD/lmf-cockpit"
# Also copy the deploy scripts to USB root
cp ~/git/cockpit/deploy/windows/{setup.bat,pull-models.bat,launch.bat,stop.bat,config-template.yaml,README-setup.txt} "$USBD/lmf-cockpit/"
```

- [ ] **Step 2: On Jason's Windows machine — run setup.bat**
1. Plug in USB
2. Download Python 3.12 embed zip + get-pip.py per README-setup.txt, place in `python\`
3. Download `ollama.exe` per README-setup.txt, place in `ollama\`
4. Run `setup.bat`
5. Expected: `=== Setup complete! ===`

- [ ] **Step 3: Pull models**
Run `pull-models.bat`
Expected: downloads complete, `qwen2.5:7b` and `qwen2.5:1.5b` in `ollama\models\`
Note: ~5.5GB, 20-40 min.

- [ ] **Step 4: First launch**
Run `launch.bat`
First run opens config editor — set `vault_path` to `E:\lmf-cockpit\vault` (or copy vault to `C:\Users\Jason\Documents\vault` and point there)
Re-run `launch.bat`
Expected: browser opens to `http://localhost:9100`

- [ ] **Step 5: Smoke test**
- Cockpit loads: gold chrome, tabs visible
- Tab switching works (click + keyboard 1/2/3)
- Ariel panel: send "Hello" → coherent response from qwen2.5:7b
- Map screen (TTF): loads without errors (may be empty if TTF not running)

- [ ] **Step 6: Document any issues**
Add a section `## Windows Deployment Issues` to `~/git/cockpit/BUGS.md` with anything found.
```bash
cd ~/git/cockpit
git add BUGS.md
git commit -m "docs: Windows USB deployment test results"
```
