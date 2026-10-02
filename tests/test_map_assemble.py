from datetime import date, datetime

from statemap.map_assemble import build_map
from statemap.map_sections import SECTIONS, Context, Section


def ctx(**kw):
    base = dict(today=date(2026, 10, 1), now=datetime(2026, 10, 1, 9, 30),
                tasks=[dict(title="Call WorkSource", goal_date="2026-10-01", status="queued", project="lmf")],
                state={"last_surfaced_task": "Call WorkSource"}, machine=[], voice={"up": True}, cap=2)
    base.update(kw)
    return Context(**base)


def test_the_brief_reads_as_one_short_paragraph():
    # Snapshot: wording changes must be deliberate.
    m = build_map(["due_today", "next_up", "calendar", "systems"], ctx(), "brief", "t")
    assert m["text"] == "One thing due today: Call WorkSource. Next up: Call WorkSource. Systems fine."
    assert [s["id"] for s in m["sections"]] == ["due_today", "next_up", "calendar", "systems"]


def test_order_follows_the_file():
    m = build_map(["systems", "due_today"], ctx(), "brief", "t")
    assert m["text"].startswith("Systems fine.")


def test_an_unknown_name_is_skipped_and_reported():
    m = build_map(["due_tody", "systems"], ctx(), "brief", "t")
    assert [s["id"] for s in m["sections"]] == ["systems"]
    assert "unknown section 'due_tody'" in m["text"]


def test_one_broken_section_does_not_blank_the_map(monkeypatch):
    def boom(c):
        raise RuntimeError("bug")
    monkeypatch.setitem(SECTIONS, "next_up", boom)
    m = build_map(["next_up", "systems"], ctx(), "brief", "t")
    assert m["sections"][0]["ok"] is False
    assert m["text"].endswith("Systems fine.")


def test_verbose_uses_the_long_form():
    m = build_map(["calendar"], ctx(), "verbose", "t")
    assert m["text"] == "No calendar yet."


def test_building_twice_from_one_context_says_the_same_thing():
    # Brief and verbose are built from one fetch; the second build must not repeat config problems.
    c = ctx()
    first = build_map(["due_tody", "systems"], c, "brief", "t")
    second = build_map(["due_tody", "systems"], c, "brief", "t")
    assert first["text"] == second["text"] == "Map: unknown section 'due_tody'."
