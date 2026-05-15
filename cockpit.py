#!/usr/bin/env python3
"""Cockpit server — static files + vault write API for InkBlotter panel."""
import json
import mimetypes
import os
import sys
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from datetime import datetime

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
            code, ctype, body = _json({"services": results, "checked": datetime.now().isoformat()})
            self._respond(code, body, ctype)
            return

        if rel == "api/vault/context":
            ctx = vault_context()
            code, ctype, body = _json(ctx)
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
            entry = f"\n- [{timestamp}] {text}"
            with inbox.open("a", encoding="utf-8") as f:
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
    print(f"Cockpit on http://0.0.0.0:{PORT}")
    print(f"Vault: {VAULT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
