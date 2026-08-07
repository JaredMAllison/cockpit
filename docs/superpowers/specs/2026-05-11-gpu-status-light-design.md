# GPU Status Light — Design Spec

**Date:** 2026-05-11
**Component:** ButtonRail → ServiceLights
**Repo:** `~/git/cockpit/`

---

## Summary

Add a `GPU` service light to the cockpit ButtonRail that reflects Ariel's active inference backend. Green = capable (Bazza GPU or Groq). Yellow = degraded (Phobos / Pixel 6). Red = emergency (Gretchen CPU or unreachable).

---

## Architecture

The existing pipeline:
```
cockpit.py /api/health → check_service() per SERVICES entry
                       → ServiceLights.jsx polls every 30s
                       → renders dot + abbrev + tooltip per service
```

The GPU light slots into this pipeline without structural changes. One new function in `cockpit.py`, one new entry in `SERVICES`, one new abbreviation in `ServiceLights.jsx`.

---

## Data Source

Ariel orchestrator already exposes `GET /status` at `http://ollama-orchestrator:8002/status`.

Relevant fields in the response:
```json
{
  "active_backend": "ollama",   // or "groq", "phobos", null
  "backends": [
    {"name": "ollama", "available": true, ...},
    {"name": "groq",   "available": true, ...},
    {"name": "phobos", "available": false, ...}
  ]
}
```

---

## State Mapping

| `active_backend` value | Light status | Color | Tooltip detail |
|---|---|---|---|
| `"ollama"` | `ok` | green | `Bazza GPU` |
| `"groq"` | `ok` | green | `Groq` |
| `"phobos"` | `degraded` | yellow | `Phobos` |
| anything else | `error` | red | backend name or `"Gretchen CPU"` |
| unreachable / null | `error` | red | `unreachable` |

---

## Changes

### 1. `cockpit.py` — new function

Add `check_gpu_backend(url, timeout=5)` after `check_service()`:

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

### 2. `cockpit.py` — SERVICES list

Replace the `ollama-orchestrator` entry with `gpu-backend`:

```python
# Before:
{"name": "ollama-orchestrator", "url": "http://ollama-orchestrator:8002"},

# After:
{"name": "gpu-backend", "url": "http://ollama-orchestrator:8002"},
```

### 3. `cockpit.py` — `/api/health` handler

Add special dispatch for `gpu-backend` inside the health loop (lines 113–119):

```python
for svc in SERVICES:
    if svc["name"] == "gpu-backend":
        status, detail = check_gpu_backend(svc["url"])
        results.append({"name": svc["name"], "status": status, "latency": detail})
    else:
        status, latency = check_service(svc["name"], svc["url"])
        results.append({"name": svc["name"], "status": status, "latency": latency})
```

### 4. `buttons/ServiceLights.jsx` — abbreviation

Add one entry to `SVC_ABBREV`:

```js
// Add:
'gpu-backend': 'GPU',
```

No other changes to ServiceLights.jsx. The existing dot + label + tooltip rendering handles it unchanged. The tooltip will show: `ok · Bazza GPU` (or `degraded · Phobos`, `error · unreachable`).

---

## What Does Not Change

- ServiceLights.jsx polling interval (30s)
- LIGHT color map (`ok`/`degraded`/`error` already covers all states)
- Tooltip rendering logic
- Any other service lights

---

## Test Plan

1. With Ariel running normally on Bazza: GPU light shows green, tooltip shows `ok · Bazza GPU`
2. With Bazza down, Groq active: GPU light shows green, tooltip shows `ok · Groq`
3. With only Phobos available: GPU light shows yellow, tooltip shows `degraded · Phobos`
4. With Ariel unreachable: GPU light shows red, tooltip shows `error · unreachable`
5. No visual regression on other service lights
