from datetime import datetime, timedelta
from statemap.machine import machine_cells, snapshot_age, SNAPSHOT_STALE_AFTER

NOW = datetime(2026, 9, 4, 9, 0, 0)

SNAP = {
    "generated_at": "2026-09-04T08:55:00",
    "repos": [
        {"name": "cockpit", "branch": "main", "last_commit": "2026-09-03", "dirty_files": 0},
        {"name": "lmf", "branch": "001-chrome-theme-swap", "last_commit": "2026-05-25", "dirty_files": 7},
    ],
    "services": [{"name": "git-marlin-1", "running": True},
                 {"name": "git-ollama-1", "running": False}],
    "backup": {"unit": "ivy-backup.service", "last_run": "2026-09-04T00:13:52", "result": "success"},
}

def _by_id(cells):
    return {c["id"]: c for c in cells}

def test_every_machine_cell_is_in_the_machine_region():
    assert all(c["region"] == "machine" for c in machine_cells(SNAP, NOW))

def test_dirty_repo_needs_you_and_why_names_the_count():
    cell = _by_id(machine_cells(SNAP, NOW))["repo:lmf"]
    assert cell["state"] == "needs-you"
    assert "7" in cell["why"]

def test_clean_recent_repo_is_moving():
    assert _by_id(machine_cells(SNAP, NOW))["repo:cockpit"]["state"] == "moving"

def test_stopped_service_is_degraded():
    assert _by_id(machine_cells(SNAP, NOW))["service:git-ollama-1"]["state"] == "degraded"

def test_running_service_is_quiet_not_moving():
    # An ambient cell that is fine must not draw the eye.
    assert _by_id(machine_cells(SNAP, NOW))["service:git-ollama-1"]["region"] == "machine"
    assert _by_id(machine_cells(SNAP, NOW))["service:git-marlin-1"]["state"] == "quiet"

def test_backup_older_than_48h_is_degraded():
    snap = dict(SNAP, backup={"unit": "ivy-backup.service",
                              "last_run": "2026-09-01T00:00:00", "result": "success"})
    assert _by_id(machine_cells(snap, NOW))["backup"]["state"] == "degraded"

def test_fresh_backup_is_quiet():
    # Regression: a successful recent backup must not read as `moving`.
    # Ambient cells that are fine do not draw the eye.
    assert _by_id(machine_cells(SNAP, NOW))["backup"]["state"] == "quiet"

def test_fresh_backup_still_reports_its_age():
    assert "h ago" in _by_id(machine_cells(SNAP, NOW))["backup"]["why"]

def test_snapshot_age_in_seconds():
    assert snapshot_age(SNAP, NOW) == 300.0

def test_missing_snapshot_has_no_age():
    assert snapshot_age({}, NOW) is None

def test_stale_threshold_is_declared():
    assert SNAPSHOT_STALE_AFTER == timedelta(minutes=30)
