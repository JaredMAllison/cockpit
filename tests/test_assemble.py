from datetime import datetime
from datetime import date

from statemap.assemble import assemble
from statemap.work import attach_overdue

NOW = datetime(2026, 9, 4, 9, 0, 0)
PROJECTS = [
    {"slug": "ttf", "title": "TTF", "priority": 2, "status": "active", "tasks_total": 0, "tasks_done": 0},
    {"slug": "lmf", "title": "LMF", "priority": 1, "status": "active", "tasks_total": 0, "tasks_done": 0},
]
SNAP = {"generated_at": "2026-09-04T08:55:00", "repos": [], "services": [], "backup": None}

def test_ordering_is_stable_by_region_group_then_id():
    # Positions are fixed so spatial memory can form. Same input, same order,
    # and P1 always precedes P2 regardless of input order.
    ids = [c["id"] for c in assemble(PROJECTS, SNAP, NOW)["cells"]]
    assert ids == ["lmf", "ttf"]

def test_groups_are_declared_in_render_order():
    assert assemble(PROJECTS, SNAP, NOW)["groups"] == ["P1", "P2", "P3", "R",
                                                       "services", "repos", "backup"]

def test_fresh_snapshot_is_not_stale():
    assert assemble(PROJECTS, SNAP, NOW)["stale"] is False

def test_old_snapshot_is_stale_and_says_why():
    snap = dict(SNAP, generated_at="2026-09-04T07:00:00")
    out = assemble(PROJECTS, snap, NOW)
    assert out["stale"] is True
    assert "120" in out["stale_reason"] or "2" in out["stale_reason"]

def test_missing_snapshot_is_stale_not_a_crash():
    out = assemble(PROJECTS, {}, NOW)
    assert out["stale"] is True
    assert "never" in out["stale_reason"].lower()
