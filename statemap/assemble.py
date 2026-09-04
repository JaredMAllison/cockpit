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
