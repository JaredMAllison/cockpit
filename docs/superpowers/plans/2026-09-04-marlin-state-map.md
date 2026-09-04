# Marlin State Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build cockpit panel five — a derived, zoomable, always-current rendering of Marlin system state that answers "what exists, and what shape is it in" at a glance.

**Architecture:** All derivation logic lives in a new stdlib-only Python package `statemap/` inside the cockpit repo, where `state` is a pure function of `measures` and therefore unit-testable. The cockpit server exposes one new endpoint, `GET /api/state-map`, that assembles cells from two sources: the **Work** half from Marlin's existing `/api/projects` (the cockpit does not re-parse vault frontmatter — it owns no logic), and the **Machine** half from a snapshot file written by a host-side collector. A thin React panel renders Orbit and Cell zoom levels over that one JSON payload.

**Tech Stack:** Python 3.12 stdlib only (no new runtime deps — the container has no `requirements.txt`), pytest 9.x for tests, React 18 via CDN with `@babel/standalone` in-browser JSX (ADR-027, no build step).

**Spec:** `docs/superpowers/specs/2026-08-08-marlin-state-map-design.md`
**Decision record:** `Marlin/Decisions/marlin-adr-057-marlin-state-map.md`

---

## Global Constraints

- **No new runtime dependencies.** The cockpit Dockerfile has no `requirements.txt`; `statemap/` must import stdlib only. `pytest` is a dev dependency, never imported by shipped code.
- **No build step for frontend** (ADR-027). Panels are `.jsx` served as static text, transpiled in-browser. No `package.json` changes, no bundler.
- **`state` is a pure function of `measures`** (spec, Data model). It takes a dict and returns a string. No I/O, no clock reads inside it — pass `now` in.
- **Four states only:** `needs-you`, `moving`, `quiet`, `degraded`. More than four and the field stops being glanceable.
- **`quiet` is not an alarm.** A parked project is supposed to be quiet.
- **Orbit does not scroll.** Off-screen means nonexistent.
- **Positions are fixed**, derived from stable keys (region, group, then slug) — never from data that changes.
- **A stale render must say so.** Every payload carries `generated_at`; the panel renders staleness visibly.
- **Judgment never colours a cell.** Overlays are out of scope for v1 (see Deferred), but the `overlays` key ships in the payload as an empty list so v2 needs no shape change.
- **Read-only.** No writes to the vault from this panel, ever.
- **Never commit to `main`** — the repo's `.githooks/pre-commit` blocks it. Work on branch `feat/marlin-state-map`.
- **Cockpit container sees only `/vault`.** It has no `~/git`, no Docker socket, no systemd. Task 4 exists because of this.

---

## Architectural finding that shaped this plan

The spec's source table (`git` per repo, `docker ps`, restic log) assumes subprocess access to the host. **The cockpit container has exactly one mount — the vault — and no Docker socket.** Mounting the socket into a web-facing container would be a privilege-escalation path and is rejected.

Resolution: a **host-side collector** (`statemap/collect.py`) runs on a systemd user timer on Gretchen and writes `System/StateMap/machine.json` into the vault. The cockpit reads that file through its existing mount.

This brushes the spec's *"No writable store sits behind the map."* The prohibition is on a **hand-edited** file the map trusts. `machine.json` is machine-generated, regenerated wholesale every run, carries its own `generated_at`, and is `.gitignore`d — nothing about it is maintained. **If a human ever edits it, ADR-057 is violated.** Task 4 writes that warning into the file itself.

---

## File structure

| File | Responsibility |
|---|---|
| `statemap/__init__.py` | Package marker. Empty. |
| `statemap/state.py` | The state rule. `derive_state(measures, now)` → one of four strings. Pure. |
| `statemap/work.py` | Shape Marlin's `/api/projects` rows into Work cells. Pure — takes rows, returns cells. |
| `statemap/machine.py` | Shape a collector snapshot dict into Machine cells. Pure. |
| `statemap/collect.py` | **Host-side only.** Runs git/docker/systemd subprocesses, writes `machine.json`. Never imported by the server. |
| `statemap/assemble.py` | Join Work + Machine cells into the final payload with ordering and staleness. Pure. |
| `tests/test_state.py` | Tests for the state rule. |
| `tests/test_work.py` | Tests for Work cell shaping. |
| `tests/test_machine.py` | Tests for Machine cell shaping and staleness. |
| `tests/test_assemble.py` | Tests for payload assembly and fixed ordering. |
| `cockpit.py` | Modify: add `GET /api/state-map` route. I/O only — no logic. |
| `panels/state-map.jsx` | The panel. Orbit + Cell zoom rendering. |
| `hooks/api.js` | Modify: add `fetchStateMap()`. |
| `index.html` | Modify: add the panel `<script>` tag. |
| `app.jsx` | Modify: register subscreen `state`, keyboard `6`. |
| `deploy/statemap-collect.service` / `.timer` | systemd user units for the collector. |

---

## Deferred to v2 — explicitly out of scope

Named so an executor does not build them and does not think they were forgotten:

- **Detail zoom (level 3).** Orbit and Cell only in v1.
- **Judgment overlays.** Payload ships `overlays: []`; no producer.
- **Knowledge Loom graph edges** drawn over the map.
- **TTF balloon drift** measure.
- **A map for Tori's cockpit (`:9200`).** Spec open question 4; ADR-057 does not rule, and the 2026-08-07 "HUDs are private" argument suggests per-operator maps. Not decided here.

---

### Task 1: The state rule

**Files:**
- Create: `statemap/__init__.py`, `statemap/state.py`
- Create: `tests/test_state.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `derive_state(measures: dict, now: datetime) -> str` returning one of `"needs-you" | "moving" | "quiet" | "degraded"`. Also `STATES: tuple[str, ...]` and `explain_state(measures, now) -> str` returning a one-sentence reason.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_state.py
from datetime import datetime, timedelta
import pytest
from statemap.state import derive_state, explain_state, STATES

NOW = datetime(2026, 9, 4, 9, 0, 0)

def test_four_states_only():
    assert STATES == ("needs-you", "moving", "quiet", "degraded")

def test_degraded_wins_over_everything():
    m = {"failing": True, "overdue_tasks": 3, "last_activity": NOW}
    assert derive_state(m, NOW) == "degraded"

def test_needs_you_when_overdue_tasks():
    assert derive_state({"overdue_tasks": 1}, NOW) == "needs-you"

def test_needs_you_when_dirty_working_tree():
    assert derive_state({"dirty_files": 4}, NOW) == "needs-you"

def test_moving_when_activity_within_seven_days():
    m = {"last_activity": NOW - timedelta(days=6)}
    assert derive_state(m, NOW) == "moving"

def test_quiet_when_activity_is_older_than_seven_days():
    m = {"last_activity": NOW - timedelta(days=8)}
    assert derive_state(m, NOW) == "quiet"

def test_quiet_when_nothing_measured():
    assert derive_state({}, NOW) == "quiet"

def test_zero_overdue_is_not_needs_you():
    # A parked project is supposed to be quiet. Zero must not read as a threshold crossing.
    assert derive_state({"overdue_tasks": 0, "dirty_files": 0}, NOW) == "quiet"

def test_explain_names_the_number():
    # "If a cell is lit, 'why' answers with a number."
    assert "2" in explain_state({"overdue_tasks": 2}, NOW)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_state.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'statemap'`

- [ ] **Step 3: Write the implementation**

```python
# statemap/state.py
"""The state rule. A cell's state is a pure function of its measures.

Four states, and no more: past four the field stops being glanceable.
Every rule here must be stateable in one sentence, and `explain_state`
must answer "why is this lit" with a number.
"""
from datetime import datetime, timedelta

STATES = ("needs-you", "moving", "quiet", "degraded")

ACTIVITY_WINDOW = timedelta(days=7)


def derive_state(measures: dict, now: datetime) -> str:
    """Map measures to exactly one state. Pure: no I/O, no clock read."""
    # degraded is machine-half only and outranks everything: a failing
    # service is not "quiet" just because nobody touched it.
    if measures.get("failing"):
        return "degraded"

    if _threshold_crossed(measures):
        return "needs-you"

    last = measures.get("last_activity")
    if last is not None and (now - last) <= ACTIVITY_WINDOW:
        return "moving"

    return "quiet"


def explain_state(measures: dict, now: datetime) -> str:
    """One sentence naming the number that produced the state."""
    if measures.get("failing"):
        return f"failing: {measures.get('failure_reason', 'unreachable')}"

    overdue = measures.get("overdue_tasks", 0)
    if overdue:
        return f"{overdue} overdue task(s)"

    dirty = measures.get("dirty_files", 0)
    if dirty:
        return f"{dirty} uncommitted file(s)"

    last = measures.get("last_activity")
    if last is None:
        return "no activity measured"
    days = (now - last).days
    if (now - last) <= ACTIVITY_WINDOW:
        return f"activity {days}d ago"
    return f"no activity for {days}d"


def _threshold_crossed(measures: dict) -> bool:
    """A measured threshold crossing. Zero is never a crossing."""
    return bool(measures.get("overdue_tasks", 0)) or bool(measures.get("dirty_files", 0))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_state.py -v`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git checkout -b feat/marlin-state-map
touch statemap/__init__.py
git add statemap/ tests/test_state.py
git commit -m "feat(statemap): state is a pure function of measures"
```

---

### Task 2: Work cells from Marlin's projects API

**Files:**
- Create: `statemap/work.py`
- Create: `tests/test_work.py`

**Interfaces:**
- Consumes: `derive_state`, `explain_state` from `statemap.state`.
- Produces: `work_cells(projects: list[dict], now: datetime) -> list[dict]`. Each cell is `{id, region, group, label, measures, state, why, overlays, detail}`. Also `attach_overdue(projects: list[dict], tasks: list[dict], today: date) -> list[dict]`, which returns new project rows carrying an `overdue_tasks` count.

**⚠️ Pre-flight finding, ruled before dispatch:** Marlin's `/api/projects` does **not** return an `overdue_tasks` field — verified against the live endpoint on 2026-09-04. Without a join, no Work cell could ever reach `needs-you` and the foreground half of the map would be permanently `quiet`/`moving`. `attach_overdue` closes that. Tasks come from a **different port**: `http://marlin:7832/api/tasks` (the webhook), not 7833 (the dashboard). Its shape is `{"generated", "count", "tasks": [{"slug", "title", "status", "project", "goal_date", "available_from", ...}]}`, and `project` is a wikilink string like `"[[oral-surgery-preop]]"` or `""`.

**Context for the implementer:** Marlin already serves project rows at `http://marlin:7833/api/projects` (host: `http://localhost:7833`). It has already parsed the vault's frontmatter, so **do not re-parse it here** — the cockpit owns no logic. A real row looks like:

```json
{"slug": "ariel-von-marlin", "title": "Ariel von Marlin", "priority": 1,
 "status": "active", "brief": "Local Qwen-based ...", "phase_current": null,
 "phase_index": null, "phase_total": 0, "task_current": null,
 "tasks_done": 0, "tasks_total": 0, "completion_pct": 0}
```

Note `phase_*` is `null`/`0` for projects with no roadmap file — that is tiers 2–4, which is most of them (spec open question 2). **Absent roadmap renders as absent, never as zero progress.**

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_work.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_work.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'statemap.work'`

- [ ] **Step 3: Write the implementation**

```python
# statemap/work.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_work.py -v`
Expected: 16 passed

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add statemap/work.py tests/test_work.py
git commit -m "feat(statemap): shape Marlin project rows into Work cells"
```

---

### Task 3: Machine cells from a collector snapshot

**Files:**
- Create: `statemap/machine.py`
- Create: `tests/test_machine.py`

**Interfaces:**
- Consumes: `derive_state`, `explain_state` from `statemap.state`.
- Produces: `machine_cells(snapshot: dict, now: datetime) -> list[dict]` and `snapshot_age(snapshot: dict, now: datetime) -> float | None` (seconds), and `SNAPSHOT_STALE_AFTER: timedelta`.

**Context:** the snapshot is written by Task 4's host collector. Its shape is fixed here first so the collector has a contract to satisfy:

```json
{"generated_at": "2026-09-04T09:00:00",
 "repos":    [{"name": "cockpit", "branch": "main", "last_commit": "2026-08-16", "dirty_files": 0}],
 "services": [{"name": "git-marlin-1", "running": true}],
 "backup":   {"unit": "ivy-backup.service", "last_run": "2026-09-04T00:13:52", "result": "success"}}
```

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_machine.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_machine.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'statemap.machine'`

- [ ] **Step 3: Write the implementation**

```python
# statemap/machine.py
"""Machine half of the map: repos, services, backup.

Ambient channel (ADR-054) -- near-invisible when healthy. These cells are
allowed to be a list because they demand no response; the eye should skip
them entirely at rest and only be caught when one asserts.

Input is the snapshot written by collect.py on the host. This module never
runs a subprocess: the cockpit container has no ~/git, no Docker socket,
and no systemd.
"""
from datetime import datetime, timedelta

from .state import derive_state, explain_state

SNAPSHOT_STALE_AFTER = timedelta(minutes=30)
BACKUP_STALE_AFTER = timedelta(hours=48)


def machine_cells(snapshot: dict, now: datetime) -> list:
    cells = []

    for repo in snapshot.get("repos", []):
        measures = {
            "dirty_files": repo.get("dirty_files", 0) or 0,
            "last_activity": _parse(repo.get("last_commit")),
        }
        cells.append(_cell(f"repo:{repo['name']}", "repos", repo["name"],
                           measures, now, detail={"branch": repo.get("branch")}))

    for svc in snapshot.get("services", []):
        # A running service is `quiet`, never `moving`. Ambient cells that
        # are fine must not draw the eye -- "up" is the resting state, not news.
        measures = {"failing": not svc.get("running", False),
                    "failure_reason": "container not running"}
        cells.append(_cell(f"service:{svc['name']}", "services", svc["name"],
                           measures, now, detail={}))

    backup = snapshot.get("backup")
    if backup:
        last = _parse(backup.get("last_run"))
        overdue = last is None or (now - last) > BACKUP_STALE_AFTER
        failed = backup.get("result") not in (None, "success")
        # No `last_activity` here on purpose. A backup that ran is not
        # "activity" the operator should be drawn to -- succeeding quietly is
        # the resting state of an ambient cell, so it must derive `quiet`,
        # never `moving`. The age still reaches the operator through `why`.
        measures = {
            "failing": overdue or failed,
            "failure_reason": ("backup failed" if failed else
                               f"last run {_age_hours(last, now)}h ago"),
        }
        cells.append(_cell("backup", "backup", backup.get("unit", "backup"),
                           measures, now, detail={"result": backup.get("result")},
                           why=f"last run {_age_hours(last, now)}h ago"))

    return cells


def snapshot_age(snapshot: dict, now: datetime):
    """Seconds since the collector last ran, or None if it never has."""
    generated = _parse(snapshot.get("generated_at"))
    return None if generated is None else (now - generated).total_seconds()


def _cell(cid, group, label, measures, now, detail, why=None):
    state = derive_state(measures, now)
    return {"id": cid, "region": "machine", "group": group, "label": label,
            "measures": measures, "state": state,
            "why": why if (why and state != "degraded") else explain_state(measures, now),
            "overlays": [], "detail": detail}


def _parse(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _age_hours(last, now):
    return "?" if last is None else int((now - last).total_seconds() // 3600)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_machine.py -v`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add statemap/machine.py tests/test_machine.py
git commit -m "feat(statemap): shape collector snapshot into ambient Machine cells"
```

---

### Task 4: The host-side collector

**Files:**
- Create: `statemap/collect.py`
- Create: `deploy/statemap-collect.service`, `deploy/statemap-collect.timer`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing from earlier tasks (it is standalone; it must be runnable on a host that has never imported the package).
- Produces: `System/StateMap/machine.json` in the vault, matching the shape declared in Task 3.

**Why this task exists:** `docker inspect git-cockpit-1` shows exactly one mount — the vault at `/vault`. There is no `~/git`, no `/var/run/docker.sock`, no systemd. Mounting the Docker socket into a web-facing container is a privilege-escalation path and is rejected. The collector runs on the host instead and hands the container a file through the mount it already has.

- [ ] **Step 1: Write the collector**

```python
#!/usr/bin/env python3
"""Host-side state collector for the Marlin State Map.

Runs on Gretchen under a systemd user timer. Writes a snapshot of machine
state into the vault, where the cockpit container can read it through its
existing /vault mount.

MACHINE-GENERATED. Regenerated wholesale on every run. Never hand-edit the
output: the State Map's contract (marlin-adr-057) is that everything it
shows is derived, and a hand-edited file it trusts violates that.
"""
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

GIT_ROOT = Path(os.environ.get("STATEMAP_GIT_ROOT", Path.home() / "git"))
VAULT = Path(os.environ.get("VAULT_PATH", Path.home() / "Documents/Obsidian/Marlin"))
OUT = VAULT / "System" / "StateMap" / "machine.json"
BACKUP_UNIT = os.environ.get("STATEMAP_BACKUP_UNIT", "ivy-backup.service")


def _run(args, cwd=None):
    """Return stdout, or None if the command fails. Never raises: a broken
    repo must not take the whole snapshot down."""
    try:
        out = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=15)
        return out.stdout.strip() if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def collect_repos():
    repos = []
    for path in sorted(GIT_ROOT.iterdir()):
        if not (path / ".git").is_dir():
            continue
        branch = _run(["git", "branch", "--show-current"], cwd=path)
        last = _run(["git", "log", "-1", "--format=%cs"], cwd=path)
        status = _run(["git", "status", "--porcelain"], cwd=path)
        repos.append({
            "name": path.name,
            "branch": branch,
            "last_commit": last,
            "dirty_files": len(status.splitlines()) if status else 0,
        })
    return repos


def collect_services():
    names = _run(["docker", "ps", "--all", "--format", "{{.Names}}\t{{.State}}"])
    services = []
    for line in (names or "").splitlines():
        name, _, state = line.partition("\t")
        if name:
            services.append({"name": name, "running": state == "running"})
    return services


def collect_backup():
    props = _run(["systemctl", "--user", "show", BACKUP_UNIT,
                  "--property=ExecMainExitTimestamp", "--property=Result"])
    last_run, result = None, None
    for line in (props or "").splitlines():
        key, _, value = line.partition("=")
        if key == "Result":
            result = value or None
        elif key == "ExecMainExitTimestamp" and value:
            # systemd format: "Fri 2026-09-04 00:13:52 PDT"
            parts = value.split()
            if len(parts) >= 3:
                try:
                    last_run = datetime.strptime(" ".join(parts[1:3]),
                                                 "%Y-%m-%d %H:%M:%S").isoformat()
                except ValueError:
                    last_run = None
    return {"unit": BACKUP_UNIT, "last_run": last_run, "result": result}


def main():
    snapshot = {
        "_warning": "MACHINE-GENERATED by statemap/collect.py. Do not hand-edit.",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "repos": collect_repos(),
        "services": collect_services(),
        "backup": collect_backup(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    # Atomic replace: the cockpit polls this file and must never read a
    # half-written snapshot.
    tmp.replace(OUT)
    print(f"[statemap] wrote {OUT} — {len(snapshot['repos'])} repos, "
          f"{len(snapshot['services'])} services")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it and verify the output against Task 3's contract**

```bash
cd ~/git/cockpit && python3 statemap/collect.py
python3 -c "
import json,pathlib
p = pathlib.Path.home()/'Documents/Obsidian/Marlin/System/StateMap/machine.json'
d = json.loads(p.read_text())
assert set(d) >= {'generated_at','repos','services','backup'}, d.keys()
assert d['repos'] and 'dirty_files' in d['repos'][0]
assert d['services'] and 'running' in d['services'][0]
print('contract OK:', len(d['repos']), 'repos,', len(d['services']), 'services')
"
```

Expected: `contract OK: 10 repos, 9 services` (counts will vary)

- [ ] **Step 3: Confirm the snapshot is already git-ignored**

✅ **Already done by the controller** (Marlin vault commit `2e6c3d3`). **Do not touch the Marlin vault repo** — it is a different repository from this one. Just verify:

```bash
cd ~/Documents/Obsidian/Marlin && git check-ignore -v System/StateMap/machine.json
```

Expected: a line naming `.gitignore` and the `System/StateMap/` pattern.

- [ ] **Step 4: Write the systemd user units — install the files, do NOT enable**

⚠️ **Ruling (pre-flight):** this build runs in a git worktree at `~/git/cockpit-statemap`, which is deleted after merge. `ExecStart` points at the post-merge path `~/git/cockpit`, and `enable --now` is deferred to the Post-merge section — enabling a timer that executes a path inside a doomed worktree would leave a broken unit behind. Write the files, then verify the collector by running it directly from the worktree.

```bash
cat > ~/.config/systemd/user/statemap-collect.service <<'EOF'
[Unit]
Description=Marlin State Map — host state collector

[Service]
Type=oneshot
ExecStart=%h/git/cockpit/statemap/collect.py
EOF

cat > ~/.config/systemd/user/statemap-collect.timer <<'EOF'
[Unit]
Description=Run the Marlin State Map collector every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=true

[Install]
WantedBy=timers.target
EOF

chmod +x ~/git/cockpit-statemap/statemap/collect.py
systemctl --user daemon-reload
```

Expected: `daemon-reload` returns silently. Do **not** run `enable --now` here — that happens post-merge, once `~/git/cockpit` actually contains `statemap/collect.py`.

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
cp ~/.config/systemd/user/statemap-collect.{service,timer} deploy/
git add statemap/collect.py deploy/statemap-collect.service deploy/statemap-collect.timer
git commit -m "feat(statemap): host-side collector — container has no docker socket"
```

---

### Task 5: Assemble the payload

**Files:**
- Create: `statemap/assemble.py`
- Create: `tests/test_assemble.py`

**Interfaces:**
- Consumes: `work_cells`, `machine_cells`, `snapshot_age`, `SNAPSHOT_STALE_AFTER`.
- Produces: `assemble(projects, snapshot, now) -> dict` with keys `generated_at`, `stale`, `stale_reason`, `cells`, `groups`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_assemble.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/git/cockpit && python3 -m pytest tests/test_assemble.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'statemap.assemble'`

- [ ] **Step 3: Write the implementation**

```python
# statemap/assemble.py
"""Join the two halves into one payload.

Ordering is the load-bearing part. Positions are fixed so spatial memory
can form -- a cell must not move because its data changed, only because
the operator added or removed a project.
"""
from datetime import datetime

from .machine import SNAPSHOT_STALE_AFTER, machine_cells, snapshot_age
from .work import work_cells

GROUP_ORDER = ["P1", "P2", "P3", "R", "services", "repos", "backup"]


def assemble(projects: list, snapshot: dict, now: datetime) -> dict:
    cells = work_cells(projects, now) + machine_cells(snapshot or {}, now)
    cells.sort(key=lambda c: (_group_rank(c["group"]), c["id"]))

    age = snapshot_age(snapshot or {}, now)
    if age is None:
        stale, reason = True, "collector has never run"
    elif age > SNAPSHOT_STALE_AFTER.total_seconds():
        stale, reason = True, f"machine snapshot {int(age // 60)} minutes old"
    else:
        stale, reason = False, ""

    # datetime is not JSON-serialisable and measures carry them; the panel
    # only ever reads `state` and `why`, so drop them at the boundary.
    for cell in cells:
        cell["measures"] = {k: v for k, v in cell["measures"].items()
                            if not isinstance(v, datetime)}

    return {"generated_at": now.isoformat(timespec="seconds"), "stale": stale,
            "stale_reason": reason, "groups": GROUP_ORDER, "cells": cells}


def _group_rank(group: str) -> int:
    return GROUP_ORDER.index(group) if group in GROUP_ORDER else len(GROUP_ORDER)
```

- [ ] **Step 4: Run the whole suite**

Run: `cd ~/git/cockpit && python3 -m pytest tests/ -v`
Expected: 41 passed

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add statemap/assemble.py tests/test_assemble.py
git commit -m "feat(statemap): assemble payload with fixed ordering and staleness"
```

---

### Task 6: The `/api/state-map` endpoint

**Files:**
- Modify: `cockpit.py` — add a route in `do_GET`, alongside the existing `api/health` and `api/vault/context` handlers (around line 148–170).

**Interfaces:**
- Consumes: `statemap.assemble.assemble`.
- Produces: `GET /api/state-map` returning the Task 5 payload as JSON.

**Context:** `do_GET` matches on `rel` (the path minus leading `/` and query string) and calls `self._respond(code, body, ctype)`. `_json(obj)` returns a `(code, ctype, body)` triple. Marlin's projects API is at `http://marlin:7833/api/projects` inside Docker; use the `MARLIN_URL` env var so it works on the host too.

- [ ] **Step 1: Add the route**

Insert immediately after the `api/vault/context` block in `do_GET`:

```python
        if rel == "api/state-map":
            code, ctype, body = _json(_state_map_payload())
            self._respond(code, body, ctype)
            return
```

- [ ] **Step 2: Add the helper and its cache near `vault_context()`**

```python
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

    projects = _fetch_json(MARLIN_PROJECTS_URL, default=[])
    tasks = (_fetch_json(MARLIN_TASKS_URL, default={}) or {}).get("tasks", [])
    projects = attach_overdue(projects, tasks, date.today())

    try:
        snapshot = json.loads(STATEMAP_SNAPSHOT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        snapshot = {}

    payload = assemble(projects, snapshot, datetime.now())
    if not projects:
        payload["stale"] = True
        payload["stale_reason"] = (payload["stale_reason"] + "; " if payload["stale_reason"] else "") + "Marlin unreachable"

    _statemap_cache.update(at=now_mono, payload=payload)
    return payload


def _fetch_json(url, default):
    """GET JSON, or `default` on any failure. Never raises: one unreachable
    upstream must degrade a half of the map, not blank the whole panel."""
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, OSError, ValueError):
        return default
```

- [ ] **Step 3: Add the import at the top of `cockpit.py`**

```python
from statemap.assemble import assemble
```

- [ ] **Step 4: Verify the endpoint end to end**

```bash
cd ~/git/cockpit
MARLIN_PROJECTS_URL=http://localhost:7833/api/projects \
 MARLIN_TASKS_URL=http://localhost:7832/api/tasks \
 COCKPIT_PORT=9199 python3 cockpit.py &
sleep 2
curl -s http://localhost:9199/api/state-map | python3 -m json.tool | head -40
kill %1
```

Expected: JSON with `generated_at`, `stale: false`, `groups`, and a `cells` array whose first entries are `region: "work"`, `group: "P1"`.

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add cockpit.py
git commit -m "feat(cockpit): serve GET /api/state-map"
```

---

### Task 7: The Orbit panel

**Files:**
- Create: `panels/state-map.jsx`
- Modify: `hooks/api.js` — add `fetchStateMap`
- Modify: `index.html` — add the script tag

**Interfaces:**
- Consumes: `GET /api/state-map`, `usePoll`, `LabelsContext`/`E` (from `editable.jsx`).
- Produces: global `StateMapPanel` component.

**Context:** panels are plain globals loaded by `<script type="text/babel">`. Follow `panels/projects.jsx` for the house style: inline styles, `PANEL_FONT_MONO`, dark palette `#0e0c0a` / `#e8e3d8` / `#1d1a16` / `#5a5249`. **This panel must not scroll** — no `className="panel-scroll"`, no `overflow: auto` on the Orbit container.

- [ ] **Step 1: Add the fetch helper to `hooks/api.js`**

```javascript
// State Map — cockpit server (same origin), see statemap/ for derivation
function fetchStateMap() {
  return fetch('/api/state-map').then(r => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} — /api/state-map`);
    return r.json();
  });
}
```

- [ ] **Step 2: Write the panel**

```jsx
// panels/state-map.jsx — cockpit panel five: the Marlin State Map (marlin-adr-057)
// Orbit + Cell zoom. Read-only. Never scrolls: off-screen means nonexistent.

const SM_FONT = '"Berkeley Mono","JetBrains Mono","IBM Plex Mono",ui-monospace,monospace';
const SM_STATE_COLOR = {
  'needs-you': '#c96442',
  'moving':    '#5fa0a8',
  'quiet':     '#3a352e',
  'degraded':  '#b8503c',
};
const SM_WORK_GROUPS    = ['P1', 'P2', 'P3', 'R'];
const SM_MACHINE_GROUPS = ['services', 'repos', 'backup'];

function StateMapCell({ cell, onZoom }) {
  return (
    <div
      onClick={() => onZoom(cell.id)}
      title={cell.why}
      style={{
        padding: '5px 9px', borderRadius: 2, cursor: 'pointer',
        background: '#141210', border: `1px solid ${SM_STATE_COLOR[cell.state]}`,
        color: cell.state === 'quiet' ? '#7a7268' : '#e8e3d8',
        fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', maxWidth: 190,
      }}
    >
      {cell.label}
    </div>
  );
}

function StateMapGroup({ label, cells, onZoom, dim }) {
  if (!cells.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: '#5a5249', letterSpacing: 1,
                    textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, opacity: dim ? 0.55 : 1 }}>
        {cells.map(c => <StateMapCell key={c.id} cell={c} onZoom={onZoom} />)}
      </div>
    </div>
  );
}

function StateMapDetail({ cell, onBack }) {
  const d = cell.detail || {};
  const row = (k, v) => (
    <div style={{ display: 'flex', gap: 12, padding: '3px 0' }}>
      <span style={{ width: 90, color: '#5a5249', flexShrink: 0 }}>{k}</span>
      <span style={{ color: '#e8e3d8' }}>{v}</span>
    </div>
  );
  return (
    <div style={{ padding: '18px 22px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    borderBottom: '1px solid #1d1a16', paddingBottom: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15, color: '#e8e3d8' }}>{cell.label}</span>
        <span style={{ fontSize: 10, color: SM_STATE_COLOR[cell.state] }}>
          {cell.group} · {cell.state}
        </span>
      </div>
      <div style={{ fontSize: 11 }}>
        {row('why', cell.why)}
        {d.brief   && row('brief', d.brief)}
        {d.next    && row('next', d.next)}
        {d.branch  && row('branch', d.branch)}
        {d.result  && row('result', d.result)}
        {d.roadmap
          ? row('roadmap', `${d.roadmap.current || ''} — phase ${d.roadmap.index} of ${d.roadmap.total}`)
          : (cell.region === 'work' && row('roadmap', 'no roadmap file'))}
        {d.tasks && row('tasks', `${d.tasks.done} / ${d.tasks.total} done`)}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 10, color: '#5a5249' }}>
        press Esc or click to return to orbit
      </div>
      <div onClick={onBack} style={{ position: 'absolute', inset: 0, cursor: 'zoom-out' }} />
    </div>
  );
}

function StateMapPanel() {
  const { data, error } = usePoll(fetchStateMap, 30000);
  const [zoomed, setZoomed] = React.useState(null);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cells = (data && data.cells) || [];
  const byGroup = (g) => cells.filter(c => c.group === g);
  const zoomedCell = zoomed && cells.find(c => c.id === zoomed);

  const shell = (children) => (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: SM_FONT,
                  width: '100%', height: '100%', position: 'relative',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #1d1a16',
                    display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <E path="panel.stateMap" fallback="State Map"/>
        </span>
        <span style={{ fontSize: 10, color: (data && data.stale) || error ? '#c96442' : '#5a5249' }}>
          {error ? '⚠ unreachable'
                 : data && data.stale ? `⚠ stale — ${data.stale_reason}`
                 : `${cells.length} cells`}
        </span>
      </div>
      {children}
    </div>
  );

  if (zoomedCell) return shell(<StateMapDetail cell={zoomedCell} onBack={() => setZoomed(null)} />);

  return shell(
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid #1d1a16', minWidth: 0 }}>
        {SM_WORK_GROUPS.map(g =>
          <StateMapGroup key={g} label={g} cells={byGroup(g)} onZoom={setZoomed} />)}
      </div>
      {/* Machine half is ambient (ADR-054): dimmed at rest, asserts when degraded. */}
      <div style={{ width: 260, flexShrink: 0, padding: '14px 16px' }}>
        {SM_MACHINE_GROUPS.map(g =>
          <StateMapGroup key={g} label={g} cells={byGroup(g)} onZoom={setZoomed}
                         dim={!byGroup(g).some(c => c.state === 'degraded')} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register the script in `index.html`**

Add after the `panels/health.jsx` line (line 64):

```html
  <script type="text/babel" src="panels/state-map.jsx"></script>
```

- [ ] **Step 4: Verify it renders**

```bash
cd ~/git/cockpit
MARLIN_PROJECTS_URL=http://localhost:7833/api/projects \
 MARLIN_TASKS_URL=http://localhost:7832/api/tasks \
 COCKPIT_PORT=9199 python3 cockpit.py &
sleep 2 && xdg-open http://localhost:9199
```

Expected: no console errors; `StateMapPanel` is defined (check via devtools console). It is not yet reachable in the UI — that is Task 8.

- [ ] **Step 5: Commit**

```bash
cd ~/git/cockpit
git add panels/state-map.jsx hooks/api.js index.html
git commit -m "feat(cockpit): State Map panel — orbit and cell zoom"
```

---

### Task 8: Wire it in as subscreen six

**Files:**
- Modify: `app.jsx` — `SUBSCREEN_IDS`, a `StateScreen` component, the keyboard handler, the render block.

**Interfaces:**
- Consumes: global `StateMapPanel` from Task 7.
- Produces: subscreen `'state'`, reachable by pressing `6` and by arrow/bracket cycling.

**Context:** `app.jsx` currently declares `const SUBSCREEN_IDS = ['quest', 'map', 'items', 'ink', 'health'];` — five subscreens, not the three in the old roadmap. Each gets a `<div key=... style={{...display: show('id')}}>` in the render block, and a numeric key in the `keydown` handler.

- [ ] **Step 1: Add the subscreen id**

```javascript
const SUBSCREEN_IDS = ['quest', 'map', 'items', 'ink', 'health', 'state'];
```

- [ ] **Step 2: Add the screen component beside `HealthScreen`**

```jsx
const StateScreen = () => (
  <div style={{ width: '100%', height: '100%' }}><StateMapPanel /></div>
);
```

- [ ] **Step 3: Add the keyboard binding**

In the `keydown` handler, after the `'5'` case:

```javascript
      else if (e.key === '6') setActive('state');
```

- [ ] **Step 4: Add it to the render block**

After the `health` div:

```jsx
              <div key="state"    style={{ position: 'absolute', inset: 0, display: show('state') }}><StateScreen /></div>
```

- [ ] **Step 5: Verify the whole thing**

```bash
cd ~/git/cockpit && python3 -m pytest tests/ -v
python3 statemap/collect.py
MARLIN_PROJECTS_URL=http://localhost:7833/api/projects \
 MARLIN_TASKS_URL=http://localhost:7832/api/tasks \
 COCKPIT_PORT=9199 python3 cockpit.py &
sleep 2 && xdg-open http://localhost:9199
```

Then, in the browser, confirm each acceptance criterion by hand:

- [ ] Press `6` — the State Map appears.
- [ ] **No navigation:** every project is visible without clicking anything.
- [ ] **No query:** nothing is typed to find a cell.
- [ ] **Always current:** `git stash`-free dirty edit in any repo, wait for the collector or run it by hand, and the repo cell turns `needs-you` within 30s of the next poll.
- [ ] **Glanceable:** fixed positions — reload twice, cells do not move.
- [ ] **Does not scroll:** shrink the window; the Orbit field must not produce a scrollbar (if it does, the group layout needs tightening, not an `overflow: auto`).
- [ ] **Shows state not history:** no dates in the Orbit view.
- [ ] **Staleness is visible:** `systemctl --user stop statemap-collect.timer`, wait 30 minutes (or hand-edit `generated_at` backwards), and the header turns orange with the reason.
- [ ] Click a cell — it zooms; `Esc` returns to Orbit at the same coordinates.

- [ ] **Step 6: Commit and open the PR**

```bash
cd ~/git/cockpit
git add app.jsx
git commit -m "feat(cockpit): State Map as subscreen six, keyboard 6"
git push -u origin feat/marlin-state-map
gh pr create --title "feat: Marlin State Map — cockpit panel five" \
  --body "Implements marlin-adr-057. Spec: docs/superpowers/specs/2026-08-08-marlin-state-map-design.md

Work half derives from Marlin's /api/projects; Machine half from a host-side
collector, because the cockpit container has only the vault mounted and no
Docker socket. 41 unit tests over the pure derivation layer.

Deferred to v2: detail zoom, judgment overlays, Loom edges, TTF balloon drift,
Tori's map.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Post-merge

### ⛔ REQUIRED FIRST — the Work half is empty in production without this

**Found by the final whole-branch review, 2026-09-04, and verified.** `cockpit.py`'s shipped defaults are `http://marlin:7833/api/projects` and `http://marlin:7832/api/tasks`. Neither resolves from inside the cockpit container:

- The real Marlin APIs are **host processes** (`ss` shows pids 1119/1120 on `0.0.0.0:7832-3`), not containers.
- `git-marlin-1` is on **no Docker network at all** and exposes only `7832/tcp`, so the name `marlin` does not resolve from `git-cockpit-1`.
- Port **7833 exists in no container whatsoever**.

Proven with the shipped defaults: `regions: {machine: 21}`, **zero work cells**, `stale_reason: "... Marlin projects unreachable; Marlin tasks unreachable"`. The panel would render its ambient half and nothing else — and, because the endpoint degrades rather than erroring, it would look like a working map with no projects.

⚠️ **A host-side smoke test cannot catch this**, because on the host the overrides are supplied on the command line. That is exactly how it was missed during the build.

**Edit `~/git/docker-compose.yml`** — the operator's deploy file, outside this repo — adding to **both** `cockpit` and `cockpit-tori`:

```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - MARLIN_PROJECTS_URL=http://host.docker.internal:7833/api/projects
      - MARLIN_TASKS_URL=http://host.docker.internal:7832/api/tasks
```

Prefer `host.docker.internal:host-gateway` over hardcoding `172.20.0.1` — the bridge subnet moves when Docker recreates the network.

**While in that file:** add `TZ=America/Los_Angeles` to `cockpit-dev`, which lacks it. Both prod services already set it. This closes the deferred TZ finding for the only target that had it — a TZ-less container also makes `date.today()` roll a day early after 17:00, counting tasks overdue before they are.

**Verify after `up -d`, from inside the container rather than the host:**

```bash
docker exec git-cockpit-1 python3 -c "
import json,urllib.request
d=json.load(urllib.request.urlopen('http://localhost:8080/api/state-map'))
from collections import Counter
print('cells:', len(d['cells']), Counter(c['region'] for c in d['cells']))
print('stale:', d['stale'], d['stale_reason'])"
```

Expect both regions populated. **Work cells at zero means this step did not take.**

### Then rebuild


Per ADR-055, production images build from a committed ref, never a dirty tree.

**Both cockpit services rebuild.** Operator decision, 2026-09-04: *"Rebuild both. Tori's cockpit is her specific window into My Exobrain. Its not a shared surface for her material also. Its all me and she is another operator."* This resolves the design spec's open question 4. The "HUDs do not federate" argument concerned a surface accruing **other people's** state; `cockpit-tori` mounts the same vault and shows only Jared's material, so the concern does not apply — this is one private HUD viewed through a second operator's window, not a federated one. After merge, rebuild and restart the cockpit container:

```bash
cd ~/git && docker compose build cockpit cockpit-tori && docker compose up -d cockpit cockpit-tori
```

Then enable the collector timer against the merged path:

```bash
systemctl --user daemon-reload
systemctl --user enable --now statemap-collect.timer
systemctl --user list-timers statemap-collect.timer
```

Expected: the timer is listed with a NEXT time inside 10 minutes.

Then update the stale roadmap: `Projects/cognitive-prosthetic-cockpit-roadmap.md` still says "Phase 1 — Shell: implementation not started", which has been false since at least 2026-08-16.
