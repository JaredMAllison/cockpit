"""/api/map through a real cockpit server; only the upstream HTTP fetches are stood in for."""
import json
import threading
import urllib.request
from datetime import date
from http.server import HTTPServer

import pytest

import cockpit


@pytest.fixture
def server(tmp_path, monkeypatch):
    today = date.today().isoformat()
    upstream = {
        cockpit.MARLIN_TASKS_URL: {"tasks": [{"title": "Call WorkSource", "goal_date": today, "status": "queued", "project": "lmf"}]},
        cockpit.MARLIN_STATE_URL: {"last_surfaced_task": "Call WorkSource"},
    }
    monkeypatch.setattr(cockpit, "_fetch_json", lambda url, token=None: upstream.get(url))
    sections = tmp_path / "map-sections.yaml"
    sections.write_text("sections:\n  - due_today\n  - next_up\n  - calendar\n")
    monkeypatch.setattr(cockpit, "MAP_SECTIONS_FILE", sections)
    monkeypatch.setattr(cockpit, "STATEMAP_SNAPSHOT", tmp_path / "missing.json")
    monkeypatch.setattr(cockpit, "VOICE_BASE_URL", "")
    cockpit._map_cache.clear()
    srv = HTTPServer(("127.0.0.1", 0), cockpit.CockpitHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()
    srv.server_close()


def get(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())


def test_brief_by_default(server):
    m = get(server + "/api/map")
    assert m["detail"] == "brief"
    assert m["text"] == "One thing due today: Call WorkSource. Next up: Call WorkSource."


def test_verbose_on_request(server):
    m = get(server + "/api/map?detail=verbose")
    assert m["detail"] == "verbose"
    assert "Due today: Call WorkSource (lmf)." in m["text"]
    assert m["text"].endswith("No calendar yet.")


def test_anything_else_is_brief(server):
    assert get(server + "/api/map?detail=loud")["detail"] == "brief"


def test_an_unreadable_voice_token_is_spoken(server, tmp_path, monkeypatch):
    # Review Focus: the voice base is configured but the token file isn't readable (wrong mount).
    monkeypatch.setattr(cockpit, "VOICE_BASE_URL", "http://voice")
    monkeypatch.setattr(cockpit, "VOICE_BASE_TOKEN_FILE", str(tmp_path / "no-token"))
    real = cockpit._fetch_json
    monkeypatch.setattr(cockpit, "_fetch_json", lambda url, token=None: {"status": "ok"} if url == "http://voice/health" else real(url, token))
    cockpit.MAP_SECTIONS_FILE.write_text("sections:\n  - systems\n")
    assert "Voice base: the cockpit can't read its token." in get(server + "/api/map?detail=verbose")["text"]


def test_a_rejected_or_empty_token_is_not_spoken_as_fine(server, tmp_path, monkeypatch):
    # Final review I1: an empty token, or a base that refuses the cockpit's token, must not read as "Systems fine."
    token = tmp_path / "token"
    monkeypatch.setattr(cockpit, "VOICE_BASE_URL", "http://voice")
    monkeypatch.setattr(cockpit, "VOICE_BASE_TOKEN_FILE", str(token))
    monkeypatch.setattr(cockpit, "_fetch_json", lambda url, token=None: {"status": "ok"} if url == "http://voice/health" else None)
    cockpit.MAP_SECTIONS_FILE.write_text("sections:\n  - systems\n")
    token.write_text("\n")
    assert "Voice base: the cockpit can't read its token." in get(server + "/api/map?detail=verbose")["text"]
    cockpit._map_cache.clear()
    token.write_text("rotated-elsewhere\n")
    assert "Voice base: it isn't answering the cockpit's checks." in get(server + "/api/map?detail=verbose")["text"]


def test_brief_and_verbose_come_from_one_fetch_with_an_offset(server):
    # "Elaborate" must narrate the same data as the brief it follows; the time carries its zone.
    import re
    brief, verbose = get(server + "/api/map"), get(server + "/api/map?detail=verbose")
    assert brief["generated_at"] == verbose["generated_at"]
    assert re.search(r"[+-]\d\d:\d\d$", brief["generated_at"])


def test_a_non_dict_upstream_body_is_spoken_not_a_500(server, monkeypatch):
    monkeypatch.setattr(cockpit, "_fetch_json", lambda url, token=None: ["not", "an", "object"])
    m = get(server + "/api/map")
    assert "Tasks unreadable right now" in m["text"] and "Next up is unknown" in m["text"]


def test_a_broken_snapshot_is_spoken_not_a_500(server, tmp_path, monkeypatch):
    snap = tmp_path / "machine.json"
    snap.write_text('["not", "a", "snapshot"]')
    monkeypatch.setattr(cockpit, "STATEMAP_SNAPSHOT", snap)
    cockpit.MAP_SECTIONS_FILE.write_text("sections:\n  - systems\n")
    assert "No machine snapshot." in get(server + "/api/map")["text"]


def test_the_token_is_not_sent_on_a_redirect():
    # A redirect from the voice base must not carry the bearer token to wherever it points.
    from http.server import BaseHTTPRequestHandler
    seen = []

    class Target(BaseHTTPRequestHandler):
        def do_GET(self):
            seen.append(self.headers.get("Authorization"))
            self.send_response(200); self.end_headers(); self.wfile.write(b"{}")
        def log_message(self, *a): pass

    target = HTTPServer(("127.0.0.1", 0), Target)
    threading.Thread(target=target.serve_forever, daemon=True).start()

    class Redirect(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(302); self.send_header("Location", f"http://127.0.0.1:{target.server_address[1]}/"); self.end_headers()
        def log_message(self, *a): pass

    origin = HTTPServer(("127.0.0.1", 0), Redirect)
    threading.Thread(target=origin.serve_forever, daemon=True).start()
    try:
        assert cockpit._fetch_json(f"http://127.0.0.1:{origin.server_address[1]}/status", "secret") is None
        assert seen == []
    finally:
        for s in (origin, target):
            s.shutdown(); s.server_close()


def test_expected_off_in_the_section_file_reaches_the_map(server, tmp_path, monkeypatch):
    from datetime import datetime
    snap = tmp_path / "machine.json"
    snap.write_text(json.dumps({"generated_at": datetime.now().isoformat(timespec="seconds"),
                                "services": [{"name": "git-knowledge-loom-1", "running": False}]}))
    monkeypatch.setattr(cockpit, "STATEMAP_SNAPSHOT", snap)
    cockpit.MAP_SECTIONS_FILE.write_text("sections:\n  - systems\nexpected_off:\n  - git-knowledge-loom-1\n")
    assert get(server + "/api/map")["text"] == "Systems fine."
    assert get(server + "/api/map?detail=verbose")["text"] == "All systems fine. Off by choice: git-knowledge-loom-1."
