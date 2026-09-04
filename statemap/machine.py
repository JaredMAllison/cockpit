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
