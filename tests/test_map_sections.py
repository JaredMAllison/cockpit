from datetime import date, datetime

from statemap.map_sections import Context, calendar, due_today, listing, next_up, systems

TODAY = date(2026, 10, 1)
NOW = datetime(2026, 10, 1, 9, 30)


def ctx(**kw):
    base = dict(today=TODAY, now=NOW, tasks=[], state={}, machine=[], voice=None, cap=2)
    base.update(kw)
    return Context(**base)


def task(title, due, status="queued", project="lmf", **kw):
    return dict(title=title, goal_date=due, status=status, project=project, **kw)


def test_listing_caps_and_counts():
    assert listing(["A"], 2) == "A"
    assert listing(["A", "B"], 2) == "A and B"
    assert listing(["A", "B", "C", "D"], 2) == "A, B and 2 more"


def test_due_today_brief_and_verbose():
    s = due_today(ctx(tasks=[task("Call WorkSource", "2026-10-01"), task("UIB claim", "2026-10-01", project="uib"),
                             task("Old thing", "2026-09-28"), task("Done thing", "2026-10-01", status="done")]))
    assert s.brief == "Two things due today: Call WorkSource and UIB claim. One overdue."
    assert "Overdue: one. Most recently due: Old thing (due 2026-09-28)." in s.verbose
    assert "Done thing" not in s.verbose


def test_verbose_caps_overdue_to_the_most_recently_due():
    # First real-data run read all 51 overdue tasks aloud: brief-first applies inside verbose too.
    late = [task(f"T{i}", f"2026-09-{10 + i:02d}") for i in range(8)]
    s = due_today(ctx(tasks=late, verbose_cap=3))
    assert s.brief == "Nothing due today. Eight overdue."
    assert "Overdue: eight. Most recently due: T7 (due 2026-09-17); T6 (due 2026-09-16); T5 (due 2026-09-15); and 5 more." in s.verbose


def test_due_today_ignores_tasks_not_yet_available():
    s = due_today(ctx(tasks=[task("Later", "2026-10-01", available_from="2026-10-05")]))
    assert s.brief == "Nothing due today."


def test_an_unreachable_marlin_is_said_not_hidden():
    s = due_today(ctx(tasks=None))
    assert not s.ok and "isn't answering" in s.brief


def test_next_up_with_project_and_age():
    s = next_up(ctx(state={"last_surfaced_task": "Call WorkSource", "last_surfaced_at": "2026-10-01T09:00:00"},
                    tasks=[task("Call WorkSource", "2026-10-01", duration="short")]))
    assert s.brief == "Next up: Call WorkSource."
    assert s.verbose == "Next up: Call WorkSource. Project: lmf. Duration: short. Surfaced 30 minutes ago."


def test_one_minute_is_singular():
    s = next_up(ctx(state={"last_surfaced_task": "X", "last_surfaced_at": "2026-10-01T09:29:00"}))
    assert s.verbose.endswith("Surfaced 1 minute ago.")


def test_next_up_nothing_surfaced():
    assert next_up(ctx(state={})).brief == "Nothing surfaced."


def test_calendar_is_silent_in_brief():
    assert calendar(ctx()).brief == ""


def test_systems_fine_is_short():
    assert systems(ctx(voice={"up": True})).brief == "Systems fine."


def test_systems_leads_with_the_worst_and_counts_the_rest():
    s = systems(ctx(voice={"up": False}, machine=[{"label": "ollama", "state": "degraded", "why": "failing: exited"}]))
    assert s.brief == "The voice base is down. And one more."
    assert "ollama: failing: exited." in s.verbose


def test_dirty_repos_are_verbose_only():
    s = systems(ctx(voice={"up": True}, machine=[{"label": "lmf", "state": "needs-you", "why": "3 uncommitted file(s)"}]))
    assert s.brief == "Systems fine."
    assert "lmf: 3 uncommitted file(s)." in s.verbose


def test_config_problems_are_spoken_by_systems():
    s = systems(ctx(voice={"up": True}, problems=["map: unknown section 'due_tody'"]))
    assert s.brief == "Map: unknown section 'due_tody'."


# --- Review Focus: inputs real data can carry ---

def test_a_task_without_a_title_is_named_not_fatal():
    s = due_today(ctx(tasks=[dict(goal_date="2026-10-01", status="queued")]))
    assert s.ok and s.brief == "One thing due today: an untitled task."


def test_counts_past_nine_are_digits():
    late = [task(f"T{i}", "2026-09-01") for i in range(12)]
    assert due_today(ctx(tasks=late)).brief == "Nothing due today. 12 overdue."


def test_an_offset_aware_surfaced_time_drops_the_age_not_the_section():
    s = next_up(ctx(state={"last_surfaced_task": "X", "last_surfaced_at": "2026-10-01T09:00:00-07:00"}))
    assert s.ok and s.verbose == "Next up: X."


def test_a_voice_base_error_is_spoken():
    s = systems(ctx(voice={"up": True, "error": "the cockpit can't read its token"}))
    assert s.brief == "Voice base: the cockpit can't read its token."
