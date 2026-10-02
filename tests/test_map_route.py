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
