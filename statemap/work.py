"""Work half of the map: projects, foreground channel.

Rows come from Marlin's /api/projects, which has already read the vault
frontmatter. This module shapes them into cells and nothing else -- the
cockpit owns no logic, and a second frontmatter parser here would be a
maintained index competing with the one Marlin already derives.
"""
from datetime import datetime

from .state import derive_state, explain_state

ACTIVE_STATUSES = {"active", "evergreen"}


def work_cells(projects: list, now: datetime) -> list:
    cells = []
    for row in projects:
        if row.get("status") not in ACTIVE_STATUSES:
            continue

        measures = {
            "overdue_tasks": row.get("overdue_tasks", 0) or 0,
            "tasks_open": (row.get("tasks_total", 0) or 0) - (row.get("tasks_done", 0) or 0),
            "completion_pct": row.get("completion_pct", 0) or 0,
        }

        cells.append({
            "id": row["slug"],
            "region": "work",
            "group": _group(row),
            "label": row.get("title") or row["slug"],
            "measures": measures,
            "state": derive_state(measures, now),
            "why": explain_state(measures, now),
            "overlays": [],
            "detail": {
                "brief": row.get("brief"),
                "next": row.get("task_current"),
                "roadmap": _roadmap(row),
                "tasks": {"done": row.get("tasks_done", 0) or 0,
                          "total": row.get("tasks_total", 0) or 0},
            },
        })
    return cells


def _group(row: dict) -> str:
    """P1/P2/P3, or R for recreational. R is not a priority -- it carries
    no obligation, and rendering it as P4 would imply one."""
    if "recreational" in (row.get("tags") or []):
        return "R"
    priority = row.get("priority")
    return f"P{priority}" if priority in (1, 2, 3) else "R"


OPEN_TASK_STATUSES = {"queued", "active", "waiting"}


def attach_overdue(projects: list, tasks: list, today) -> list:
    """Join Marlin's task list onto project rows as an `overdue_tasks` count.

    Marlin's /api/projects carries no overdue count, so without this every
    Work cell would derive `quiet` or `moving` forever and the foreground
    half of the map would never light. Tasks come from the webhook on 7832,
    a different service from the dashboard on 7833.

    Returns new dicts -- never mutates the caller's rows.
    """
    counts = {}
    for task in tasks:
        if task.get("status") not in OPEN_TASK_STATUSES:
            continue
        slug = _project_slug(task.get("project"))
        if not slug:
            continue
        goal = _parse_date(task.get("goal_date"))
        # `today` is not overdue: a task due today is due, not late.
        if goal is not None and goal < today:
            counts[slug] = counts.get(slug, 0) + 1
    return [dict(row, overdue_tasks=counts.get(row["slug"], 0)) for row in projects]


def _project_slug(value):
    """Normalise a frontmatter wikilink to a bare slug.

    Handles "", "[[lmf]]", "[[Projects/lmf|LMF]]", and a bare "lmf".
    """
    if not value:
        return None
    text = value.strip()
    if text.startswith("[[") and text.endswith("]]"):
        text = text[2:-2]
    text = text.split("|", 1)[0]          # drop a display alias
    text = text.rsplit("/", 1)[-1]        # drop a folder prefix
    return text.removesuffix(".md").strip() or None


def _parse_date(value):
    from datetime import date as _date
    if not value:
        return None
    try:
        return _date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def _roadmap(row: dict):
    """None when the project has no roadmap file. Absent is not zero:
    tiers 2-4 have no roadmap by design, and a 0% bar would misreport that
    as no progress rather than no forward view."""
    total = row.get("phase_total") or 0
    if not total:
        return None
    return {"index": row.get("phase_index"), "total": total,
            "current": row.get("phase_current")}
