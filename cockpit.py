#!/usr/bin/env python3
"""Cockpit server — static files + vault write API for InkBlotter panel."""
import json
import mimetypes
import os
import re
import sys
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from datetime import date, datetime

from statemap.assemble import assemble
from statemap.work import attach_overdue

mimetypes.add_type("text/javascript", ".jsx")

PORT = int(os.environ.get("COCKPIT_PORT", "9100"))
COCKPIT_ENV = os.environ.get("COCKPIT_ENV", "prod")
STATIC = Path(__file__).resolve().parent
VAULT = Path(os.environ.get("VAULT_PATH", Path.home() / "Documents/Obsidian/Marlin"))

_VAULT_WARNING = False

# LMF service health targets — override via env var JSON array
SERVICES = os.environ.get("LMF_SERVICES", json.dumps([
    {"name": "marlin", "url": "http://marlin:7832"},
    {"name": "time-factory", "url": "http://timefactory:3000"},
    {"name": "ollama", "url": "http://ollama:11434"},
    {"name": "knowledge-loom", "url": "http://knowledge-loom:8888"},
    {"name": "ollama-orchestrator", "url": "http://ollama-orchestrator:8002"},
    {"name": "cockpit", "url": "http://localhost:8080"},
]))
SERVICES = json.loads(SERVICES) if isinstance(SERVICES, str) else SERVICES

# --- Operator context (T001) ---
OPERATOR_NAME = os.environ.get("MARLIN_OPERATOR", "jared")
if not re.fullmatch(r"[a-z0-9_-]+", OPERATOR_NAME):
    print(f"[cockpit] FATAL: OPERATOR name invalid (must be [a-z0-9_-]+): {OPERATOR_NAME!r}", file=sys.stderr)
    sys.exit(1)
_operator_agent_path = (VAULT / "System" / "Users" / OPERATOR_NAME / "AGENT.md").resolve()
if not _operator_agent_path.is_relative_to(VAULT / "System" / "Users"):
    print(f"[cockpit] FATAL: OPERATOR path escapes System/Users/: {_operator_agent_path}", file=sys.stderr)
    sys.exit(1)
OPERATOR_AGENT = _operator_agent_path.read_text(encoding="utf-8") if _operator_agent_path.is_file() else None

TTYD_PORTS = {"jared": 7682, "tori": 7683}
# No fallback: an unmapped operator gets None, and the client keeps the terminal
# shut. Defaulting here would hand a new operator someone else's shell.
TTYD_PORT = TTYD_PORTS.get(OPERATOR_NAME)
if TTYD_PORT is None:
    print(f"[cockpit] WARN: no ttyd port mapped for operator {OPERATOR_NAME!r}; terminal disabled", file=sys.stderr)


def check_service(name, url, timeout=5):
    """Probe a service health endpoint. Returns (status, latency_ms)."""
    start = time.time()
    try:
        resp = urllib.request.urlopen(url, timeout=timeout)
        elapsed = int((time.time() - start) * 1000)
        status = "ok" if 200 <= resp.status < 400 else "degraded"
        return status, f"{elapsed}ms"
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        elapsed = int((time.time() - start) * 1000)
        return "error", f"{elapsed}ms"


# Two Marlin services, two ports: the dashboard serves projects on 7833,
# the webhook serves tasks on 7832. They are not interchangeable.
MARLIN_PROJECTS_URL = os.environ.get("MARLIN_PROJECTS_URL", "http://marlin:7833/api/projects")
MARLIN_TASKS_URL = os.environ.get("MARLIN_TASKS_URL", "http://marlin:7832/api/tasks")
STATEMAP_SNAPSHOT = VAULT / "System" / "StateMap" / "machine.json"
STATEMAP_CACHE_TTL = 30  # seconds; a tuning knob, not a design decision
_statemap_cache = {"at": 0.0, "payload": None}


def _state_map_payload():
    """Assemble the State Map payload, cached briefly so the panel stays
    responsive. Never raises: an unreachable Marlin or a missing snapshot
    degrades to an empty half with `stale` set, because a map that goes
    blank on one failed fetch is worse than one that says it is stale."""
    now_mono = time.time()
    if _statemap_cache["payload"] and (now_mono - _statemap_cache["at"]) < STATEMAP_CACHE_TTL:
        return _statemap_cache["payload"]

    # None means the fetch failed; [] / {} are legitimate empty responses.
    # A healthy Marlin that legitimately has zero active projects must not
    # be indistinguishable from an unreachable one -- collapsing both to
    # "falsy" made `stale` assert a falsehood about a live, current map.
    projects_raw = _fetch_json(MARLIN_PROJECTS_URL)
    tasks_raw = _fetch_json(MARLIN_TASKS_URL)

    unreachable = []
    if projects_raw is None:
        unreachable.append("Marlin projects unreachable")
    if tasks_raw is None:
        # A failed tasks fetch must not silently read as "no overdue tasks
        # anywhere" -- attach_overdue can't tell the difference on its own,
        # so the gap has to be named here, at the point where we still know.
        unreachable.append("Marlin tasks unreachable")

    tasks = (tasks_raw or {}).get("tasks", [])
    projects = attach_overdue(projects_raw or [], tasks, date.today())

    try:
        snapshot = json.loads(STATEMAP_SNAPSHOT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        snapshot = {}

    # TZ gap: cockpit-dev in ~/git/docker-compose.yml sets no TZ env var, so
    # datetime.now() here returns UTC in that container while machine.json's
    # generated_at (written host-local by statemap/collect.py) stays PDT/PST.
    # That skews every staleness comparison in statemap/machine.py by the UTC
    # offset -- reproduced empirically in task-6-report.md (a ~16-minute-old
    # snapshot measured as ~7 hours old). Prod's `cockpit` service sets
    # TZ=America/Los_Angeles and is unaffected. This is a cheap note, not a
    # fix: the durable fix is UTC end-to-end across collect.py, machine.py,
    # and this endpoint, which touches three already-closed modules and is
    # deferred to the whole-branch review.
    payload = assemble(projects, snapshot, datetime.now())
    if unreachable:
        payload["stale"] = True
        reason = "; ".join(unreachable)
        payload["stale_reason"] = f"{payload['stale_reason']}; {reason}" if payload["stale_reason"] else reason

    _statemap_cache.update(at=now_mono, payload=payload)
    return payload


def _fetch_json(url):
    """GET JSON, or None on any failure. Never raises: one unreachable
    upstream must degrade a half of the map, not blank the whole panel.
    None means failure; a genuine empty response ([] or {}) is success and
    must stay distinguishable from the upstream being down."""
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, OSError, ValueError):
        return None


def vault_context():
    """Return a snapshot of the vault for AI context."""
    ctx = {"vault_root": str(VAULT), "notes": [], "tasks": [], "inbox_items": []}

    # Recent inbox items
    inbox = VAULT / "Inbox.md"
    if inbox.is_file():
        lines = inbox.read_text().splitlines()
        ctx["inbox_items"] = [l.strip() for l in lines if l.strip().startswith("-")][-10:]

    # Active tasks (files with status: queued or active)
    tasks_dir = VAULT / "Tasks"
    if tasks_dir.is_dir():
        for f in sorted(tasks_dir.glob("*.md"))[:15]:
            try:
                text = f.read_text()
                if "status: done" not in text and "status: cancelled" not in text:
                    ctx["tasks"].append(f.stem)
            except OSError:
                pass

    # Note tree (top 2 levels)
    def scan_dir(path, depth=0):
        if depth > 2:
            return []
        entries = []
        try:
            for child in sorted(path.iterdir()):
                if child.name.startswith(".") or child.name == "_backups":
                    continue
                if child.is_dir():
                    entries.append({"name": child.name + "/", "type": "dir"})
                    entries.extend(scan_dir(child, depth + 1))
                elif child.suffix == ".md":
                    entries.append({"name": child.name, "type": "note"})
        except OSError:
            pass
        return entries

    ctx["vault_tree"] = scan_dir(VAULT)[:40]
    return ctx


def _json(resp, code=200):
    body = json.dumps(resp).encode()
    return code, "application/json", body


def _text(body, code=200):
    body = body.encode() if isinstance(body, str) else body
    return code, "text/plain", body


def _ends_with_newline(path):
    """True if the file is newline-terminated, or does not need one.

    Reads only the final byte -- Inbox.md grows without bound and is appended
    to on every capture, so slurping it to inspect one character would make
    each append proportional to the file's whole history.

    Missing or empty files return True: there is nothing to separate from, so
    the caller must not emit a leading newline.
    """
    try:
        with path.open("rb") as f:
            f.seek(-1, os.SEEK_END)
            return f.read(1) == b"\n"
    except (OSError, ValueError):
        # ValueError: seek before start of an empty file. OSError: missing file.
        return True


def _check_vault():
    """Warn once if the vault path is not writable, then rely on OS-level errors."""
    global _VAULT_WARNING
    if not VAULT.is_dir() and not _VAULT_WARNING:
        print(f"[cockpit] WARNING: VAULT_PATH does not exist: {VAULT}", file=sys.stderr)
        _VAULT_WARNING = True


class CockpitHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        rel = self.path.split("?")[0].lstrip("/") or "index.html"

        if rel == "api/health":
            results = []
            for svc in SERVICES:
                status, latency = check_service(svc["name"], svc["url"])
                results.append({"name": svc["name"], "status": status, "latency": latency})
            code, ctype, body = _json({"services": results, "operator": OPERATOR_NAME, "checked": datetime.now().isoformat()})
            self._respond(code, body, ctype)
            return

        if rel == "api/operator":
            code, ctype, body = _json({"operator": OPERATOR_NAME, "agent_content": OPERATOR_AGENT, "ttyd_port": TTYD_PORT})
            self._respond(code, body, ctype)
            return

        if rel == "api/vault/context":
            ctx = vault_context()
            code, ctype, body = _json(ctx)
            self._respond(code, body, ctype)
            return

        if rel == "api/state-map":
            code, ctype, body = _json(_state_map_payload())
            self._respond(code, body, ctype)
            return

        if rel.startswith("api/vault/read/"):
            note_path = rel[len("api/vault/read/"):]
            target = (VAULT / note_path).resolve()
            if not target.is_relative_to(VAULT):
                self._respond(403, b"Forbidden")
                return
            if target.is_file() and target.suffix == ".md":
                body = target.read_bytes()
                self._respond(200, body, "text/markdown")
            else:
                self._respond(404, b"Not found")
            return

        file_path = (STATIC / rel).resolve()
        if not file_path.is_relative_to(STATIC):
            self._respond(403, b"Forbidden")
            return
        if not file_path.is_file():
            self._respond(404, b"Not found")
            return
        mime = mimetypes.guess_type(str(file_path))[0] or "text/plain"
        body = file_path.read_bytes()
        if rel == "index.html":
            inject = f'<script>window.COCKPIT_ENV="{COCKPIT_ENV}";</script>'.encode()
            body = body.replace(b"</head>", inject + b"</head>", 1)
        self._respond(200, body, mime)

    def do_POST(self):
        _check_vault()
        path = self.path.split("?")[0].rstrip("/")
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"

        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            code, ctype, body = _json({"error": "invalid JSON"}, 400)
            self._respond(code, body, ctype)
            return

        if path == "/api/vault/write":
            rel = data.get("path", "")
            content = data.get("content", "")
            target = (VAULT / rel).resolve()
            if not target.is_relative_to(VAULT):
                code, ctype, body = _json({"error": "path traversal denied"}, 403)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
                print(f"[cockpit] Wrote {len(content)}b → {rel}")
                code, ctype, body = _json({"written": rel, "bytes": len(content)})
            self._respond(code, body, ctype)

        elif path == "/api/vault/append-inbox":
            text = data.get("text", "")
            inbox = VAULT / "Inbox.md"
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            # Newline contract: an entry OWNS its trailing newline, and adds a
            # leading one only when the file is not already newline-terminated.
            #
            # The previous form -- f"\n- [...] {text}" with no trailing newline
            # -- had this backwards and broke in both directions:
            #   * file already ended in \n -> a blank line was inserted
            #   * file left unterminated   -> the NEXT writer concatenated onto
            #                                 this entry's line
            # Both were observed in Inbox.md on 2026-08-07.
            entry = f"- [{timestamp}] {text}\n"
            with inbox.open("a", encoding="utf-8") as f:
                if not _ends_with_newline(inbox):
                    f.write("\n")
                f.write(entry)
            print(f"[cockpit] Appended to Inbox.md: {text[:60]}...")
            code, ctype, body = _json({"appended": True, "inbox_entry": entry.strip()})
            self._respond(code, body, ctype)

        else:
            self._respond(404, b"Not found")

    def _respond(self, code, body, content_type="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def main():
    _check_vault()
    server = HTTPServer(("0.0.0.0", PORT), CockpitHandler)
    print(f"Cockpit on http://0.0.0.0:{PORT}  operator={OPERATOR_NAME}")
    print(f"Vault: {VAULT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
