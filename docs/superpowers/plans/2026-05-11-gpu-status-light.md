# GPU Status Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GPU inference status light to the cockpit ButtonRail that reflects Ariel's active backend (green = Bazza/Groq, yellow = Phobos, red = unreachable/Gretchen).

**Architecture:** `cockpit.py` gains a `check_gpu_backend()` function that queries Ariel's `/status` endpoint and maps `active_backend` to a light state. The existing `/api/health` handler dispatches to it for the renamed `gpu-backend` service entry. `ServiceLights.jsx` needs one abbreviation added — no other frontend changes.

**Tech Stack:** Python 3 (stdlib only), React/JSX (Babel, no build step)

---

## File Map

| File | Change |
|---|---|
| `cockpit.py` | Add `check_gpu_backend()`, rename SERVICES entry, update health dispatch |
| `buttons/ServiceLights.jsx` | Add `'gpu-backend': 'GPU'` to `SVC_ABBREV` |
| `tests/test_gpu_backend.py` | New — unit tests for `check_gpu_backend()` |

---

## Task 1: Add `check_gpu_backend()` to cockpit.py

**Files:**
- Modify: `cockpit.py:35-45` (insert after `check_service()`)
- Create: `tests/test_gpu_backend.py`

- [ ] **Step 1: Create the test file**

```python
# tests/test_gpu_backend.py
import json
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
import urllib.error

sys.path.insert(0, str(Path(__file__).parent.parent))
from cockpit import check_gpu_backend


def _mock_response(data: dict):
    m = MagicMock()
    m.read.return_value = json.dumps(data).encode()
    return m


def test_ollama_active_returns_ok_bazza():
    with patch("urllib.request.urlopen", return_value=_mock_response({"active_backend": "ollama"})):
        status, detail = check_gpu_backend("http://fake:8002")
    assert status == "ok"
    assert detail == "Bazza GPU"


def test_groq_active_returns_ok_groq():
    with patch("urllib.request.urlopen", return_value=_mock_response({"active_backend": "groq"})):
        status, detail = check_gpu_backend("http://fake:8002")
    assert status == "ok"
    assert detail == "Groq"


def test_phobos_active_returns_degraded():
    with patch("urllib.request.urlopen", return_value=_mock_response({"active_backend": "phobos"})):
        status, detail = check_gpu_backend("http://fake:8002")
    assert status == "degraded"
    assert detail == "Phobos"


def test_unknown_backend_returns_error():
    with patch("urllib.request.urlopen", return_value=_mock_response({"active_backend": "gretchen-cpu"})):
        status, detail = check_gpu_backend("http://fake:8002")
    assert status == "error"
    assert detail == "gretchen-cpu"


def test_null_backend_returns_error_no_backend():
    with patch("urllib.request.urlopen", return_value=_mock_response({"active_backend": None})):
        status, detail = check_gpu_backend("http://fake:8002")
    assert status == "error"
    assert detail == "no backend"


def test_unreachable_returns_error_unreachable():
    with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")):
        status, detail = check_gpu_backend("http://fake:8002")
    assert status == "error"
    assert detail == "unreachable"
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd ~/git/cockpit && python -m pytest tests/test_gpu_backend.py -v
```

Expected: 6 failures with `ImportError: cannot import name 'check_gpu_backend'`

- [ ] **Step 3: Add `check_gpu_backend()` to cockpit.py**

Insert after line 45 (after `check_service()`):

```python
def check_gpu_backend(url, timeout=5):
    """Query Ariel /status and map active_backend to a light state."""
    try:
        resp = urllib.request.urlopen(f"{url}/status", timeout=timeout)
        data = json.loads(resp.read())
        active = data.get("active_backend") or ""
        if active in ("ollama", "groq"):
            label = "Bazza GPU" if active == "ollama" else "Groq"
            return "ok", label
        elif active == "phobos":
            return "degraded", "Phobos"
        elif active:
            return "error", active
        else:
            return "error", "no backend"
    except Exception:
        return "error", "unreachable"
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
cd ~/git/cockpit && python -m pytest tests/test_gpu_backend.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add cockpit.py tests/test_gpu_backend.py
git commit -m "feat: add check_gpu_backend() — maps Ariel active_backend to light state"
```

---

## Task 2: Rename SERVICES entry and update health dispatch

**Files:**
- Modify: `cockpit.py:29` (SERVICES list)
- Modify: `cockpit.py:113-119` (`/api/health` handler)

- [ ] **Step 1: Rename the SERVICES entry**

In `cockpit.py`, find line 29:
```python
    {"name": "ollama-orchestrator", "url": "http://ollama-orchestrator:8002"},
```

Replace with:
```python
    {"name": "gpu-backend", "url": "http://ollama-orchestrator:8002"},
```

- [ ] **Step 2: Update the `/api/health` dispatch**

Find lines 113–119:
```python
        if rel == "api/health":
            results = []
            for svc in SERVICES:
                status, latency = check_service(svc["name"], svc["url"])
                results.append({"name": svc["name"], "status": status, "latency": latency})
            code, ctype, body = _json({"services": results, "checked": datetime.now().isoformat()})
```

Replace the inner loop with:
```python
        if rel == "api/health":
            results = []
            for svc in SERVICES:
                if svc["name"] == "gpu-backend":
                    status, detail = check_gpu_backend(svc["url"])
                    results.append({"name": svc["name"], "status": status, "latency": detail})
                else:
                    status, latency = check_service(svc["name"], svc["url"])
                    results.append({"name": svc["name"], "status": status, "latency": latency})
            code, ctype, body = _json({"services": results, "checked": datetime.now().isoformat()})
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
cd ~/git/cockpit && python -m pytest tests/ -v
```

Expected: all pass

- [ ] **Step 4: Smoke test the health endpoint manually**

```bash
curl -s http://localhost:9110/api/health | python3 -m json.tool
```

Expected: JSON with a `gpu-backend` entry in `services`. Status will be `error` if Ariel is not running locally — that's correct behaviour.

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add cockpit.py
git commit -m "feat: wire gpu-backend into /api/health dispatch"
```

---

## Task 3: Add GPU abbreviation to ServiceLights.jsx

**Files:**
- Modify: `buttons/ServiceLights.jsx:6-9`

- [ ] **Step 1: Add the abbreviation**

Find `SVC_ABBREV` at line 6:
```js
const SVC_ABBREV = {
  'marlin': 'MRL', 'time-factory': 'TTF', 'ollama': 'OLM',
  'knowledge-loom': 'LOOM', 'ollama-orchestrator': 'ORC', 'cockpit': 'CPIT',
};
```

Replace with:
```js
const SVC_ABBREV = {
  'marlin': 'MRL', 'time-factory': 'TTF', 'ollama': 'OLM',
  'knowledge-loom': 'LOOM', 'gpu-backend': 'GPU', 'cockpit': 'CPIT',
};
```

Note: `ollama-orchestrator: 'ORC'` is removed since the service is now named `gpu-backend`.

- [ ] **Step 2: Verify in browser**

Open `http://localhost:9110`. The service lights rail should show a `GPU` light. If Ariel is running and Bazza is active, it shows green. If Ariel is unreachable, it shows red. Click the light — tooltip should show `error · unreachable` (or the active backend name if live).

- [ ] **Step 3: Commit**

```bash
cd ~/git/cockpit
git add buttons/ServiceLights.jsx
git commit -m "feat: add GPU abbreviation to ServiceLights rail"
```

---

## Task 4: PR

- [ ] **Step 1: Push branch and open PR**

```bash
cd ~/git/cockpit
git push -u origin feature/gpu-status-light
gh pr create \
  --title "feat: GPU inference status light in ButtonRail" \
  --body "Adds a GPU service light that reflects Ariel's active backend state. Green = Bazza GPU or Groq. Yellow = Phobos. Red = unreachable or emergency fallback. Data from Ariel /status endpoint via cockpit.py aggregation."
```
