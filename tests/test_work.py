from datetime import datetime
from statemap.work import work_cells

NOW = datetime(2026, 9, 4, 9, 0, 0)

ROW = {"slug": "lmf", "title": "Local Mind Framework", "priority": 1,
       "status": "active", "brief": "Open framework ...", "phase_current": "Phase 2",
       "phase_index": 2, "phase_total": 5, "task_current": "write the spec",
       "tasks_done": 3, "tasks_total": 7, "completion_pct": 42, "overdue_tasks": 0}

def test_cell_has_the_spec_shape():
    cell = work_cells([ROW], NOW)[0]
    assert set(cell) == {"id", "region", "group", "label", "measures",
                         "state", "why", "overlays", "detail"}

def test_region_is_work_and_group_is_the_priority_tier():
    cell = work_cells([ROW], NOW)[0]
    assert cell["region"] == "work"
    assert cell["group"] == "P1"

def test_recreational_projects_group_as_R():
    row = dict(ROW, priority=None, status="active", tags=["recreational"])
    assert work_cells([row], NOW)[0]["group"] == "R"

def test_overdue_tasks_light_the_cell():
    row = dict(ROW, overdue_tasks=2)
    cell = work_cells([row], NOW)[0]
    assert cell["state"] == "needs-you"
    assert "2" in cell["why"]

def test_missing_roadmap_is_absent_not_zero():
    row = dict(ROW, phase_current=None, phase_index=None, phase_total=0)
    assert work_cells([row], NOW)[0]["detail"]["roadmap"] is None

def test_present_roadmap_carries_position():
    assert work_cells([ROW], NOW)[0]["detail"]["roadmap"] == {"index": 2, "total": 5, "current": "Phase 2"}

def test_overlays_ship_empty_for_v1():
    assert work_cells([ROW], NOW)[0]["overlays"] == []

def test_non_active_projects_are_dropped():
    assert work_cells([dict(ROW, status="complete")], NOW) == []


# --- attach_overdue: joins Marlin's task list onto project rows ---
from datetime import date
from statemap.work import attach_overdue

TODAY = date(2026, 9, 4)
TASKS = [
    {"slug": "a", "status": "queued", "project": "[[lmf]]",  "goal_date": "2026-08-29"},
    {"slug": "b", "status": "queued", "project": "[[lmf]]",  "goal_date": "2026-09-30"},
    {"slug": "c", "status": "done",   "project": "[[lmf]]",  "goal_date": "2026-01-01"},
    {"slug": "d", "status": "active", "project": "",         "goal_date": "2026-01-01"},
    {"slug": "e", "status": "active", "project": "[[lmf]]",  "goal_date": None},
]

def test_overdue_counts_only_past_goal_dates():
    assert attach_overdue([ROW], TASKS, TODAY)[0]["overdue_tasks"] == 1

def test_done_and_cancelled_tasks_never_count_as_overdue():
    tasks = [dict(TASKS[2], status=s) for s in ("done", "cancelled")]
    assert attach_overdue([ROW], tasks, TODAY)[0]["overdue_tasks"] == 0

def test_task_with_no_goal_date_is_not_overdue():
    assert attach_overdue([ROW], [TASKS[4]], TODAY)[0]["overdue_tasks"] == 0

def test_goal_date_today_is_not_yet_overdue():
    tasks = [dict(TASKS[0], goal_date="2026-09-04")]
    assert attach_overdue([ROW], tasks, TODAY)[0]["overdue_tasks"] == 0

def test_wikilink_project_field_is_normalised_to_a_slug():
    tasks = [{"slug": "z", "status": "queued", "project": "[[Projects/lmf|LMF]]",
              "goal_date": "2026-01-01"}]
    assert attach_overdue([ROW], tasks, TODAY)[0]["overdue_tasks"] == 1

def test_orphan_tasks_do_not_crash_or_attach_anywhere():
    tasks = [{"slug": "z", "status": "queued", "project": "[[no-such-project]]",
              "goal_date": "2026-01-01"}]
    assert attach_overdue([ROW], tasks, TODAY)[0]["overdue_tasks"] == 0

def test_attach_overdue_does_not_mutate_its_input():
    original = dict(ROW)
    attach_overdue([ROW], TASKS, TODAY)
    assert ROW == original

def test_malformed_goal_date_is_skipped_not_fatal():
    tasks = [{"slug": "z", "status": "queued", "project": "[[lmf]]", "goal_date": "soon"}]
    assert attach_overdue([ROW], tasks, TODAY)[0]["overdue_tasks"] == 0
