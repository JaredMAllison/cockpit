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
        return f"failing: {measures.get('failure_reason', 'no reason provided')}"

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
