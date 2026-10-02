"""Map sections: each turns shared, already-fetched sources into a few words.

Pure: no I/O, no clock reads. A section reports measured facts (ADR-057 §4).
Add a section by writing one function and registering it in SECTIONS; the
operator then lists it in the map sections file.
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Callable, Optional

CLOSED = {"done", "cancelled", "mothballed"}
NOT_OVERDUE = {"waiting"}  # blocked on someone else (operator, 2026-10-01)
NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]


@dataclass
class Section:
    id: str
    brief: str           # "" means silent in the brief
    verbose: str
    as_of: Optional[str] = None
    ok: bool = True


@dataclass
class Context:
    today: date
    now: datetime
    tasks: Optional[list]            # None = Marlin unreachable
    state: Optional[dict]            # Marlin /api/state; None = unreachable
    machine: Optional[list]          # statemap machine cells; None = no snapshot
    machine_stale: str = ""          # why the snapshot is stale, or ""
    voice: Optional[dict] = None     # {"up", "lapsed", "worker_error"}; None = not configured
    cap: int = 2
    verbose_cap: int = 5
    expected_off: list = field(default_factory=list)  # names off by the operator's choice
    problems: list = field(default_factory=list)  # config problems, spoken by `systems`


def number(n: int) -> str:
    return NUMBERS[n] if 0 <= n < len(NUMBERS) else str(n)


def listing(items: list, cap: int) -> str:
    """'A', 'A and B', 'A, B and 2 more'."""
    if len(items) <= cap:
        return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]
    return ", ".join(items[:cap]) + f" and {len(items) - cap} more"


def _title(t: dict) -> str:
    return t.get("title") or "an untitled task"


def _due(value) -> Optional[date]:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def due_today(ctx: Context) -> Section:
    if ctx.tasks is None:
        msg = "Tasks unreadable right now: Marlin isn't answering."
        return Section("due_today", msg, msg, ok=False)
    open_ = [t for t in ctx.tasks if str(t.get("status", "")).lower() not in CLOSED
             and (_due(t.get("available_from")) or ctx.today) <= ctx.today]
    today = [t for t in open_ if _due(t.get("goal_date")) == ctx.today]
    late = [t for t in open_ if (_due(t.get("goal_date")) or ctx.today) < ctx.today
            and str(t.get("status", "")).lower() not in NOT_OVERDUE]
    titles = [_title(t) for t in today]
    if titles:
        thing = "thing" if len(titles) == 1 else "things"
        brief = f"{number(len(titles)).capitalize()} {thing} due today: {listing(titles, ctx.cap)}."
    else:
        brief = "Nothing due today."
    if late:
        brief += f" {number(len(late)).capitalize()} overdue."
    parts = []
    if today:
        parts.append("Due today: " + "; ".join(f"{_title(t)} ({t.get('project') or 'no project'})" for t in today) + ".")
    else:
        parts.append("Nothing due today.")
    if late:
        # Brief-first inside verbose too: the count, then the most recently due few.
        recent = sorted(late, key=lambda t: str(t.get("goal_date")), reverse=True)
        shown = "; ".join(f"{_title(t)} (due {t['goal_date']})" for t in recent[:ctx.verbose_cap])
        more = f"; and {len(recent) - ctx.verbose_cap} more" if len(recent) > ctx.verbose_cap else ""
        parts.append(f"Overdue: {number(len(late))}. Most recently due: {shown}{more}.")
    return Section("due_today", brief, " ".join(parts))


def next_up(ctx: Context) -> Section:
    if ctx.state is None:
        msg = "Next up is unknown: Marlin isn't answering."
        return Section("next_up", msg, msg, ok=False)
    title = ctx.state.get("last_surfaced_task")
    if not title:
        return Section("next_up", "Nothing surfaced.", "Nothing surfaced right now.")
    brief = f"Next up: {title}."
    detail = [brief]
    task = next((t for t in ctx.tasks or [] if t.get("title") == title), None)
    if task and task.get("project"):
        detail.append(f"Project: {task['project']}.")
    if task and task.get("duration"):
        detail.append(f"Duration: {task['duration']}.")
    at = ctx.state.get("last_surfaced_at")
    try:
        mins = int((ctx.now - datetime.fromisoformat(at)).total_seconds() // 60) if at else None
    except (ValueError, TypeError):  # unparseable, or offset-aware against our naive clock
        mins = None
    if mins is not None and mins >= 0:
        detail.append(f"Surfaced {mins} minute{'' if mins == 1 else 's'} ago.")
    return Section("next_up", brief, " ".join(detail), as_of=at)


def calendar(ctx: Context) -> Section:
    # An empty slot until the Marlin Calendar exists: silent in the brief.
    return Section("calendar", "", "No calendar yet.")


def systems(ctx: Context) -> Section:
    # Ranking: the first problem found leads the brief, so the checks run worst-first:
    # the voice base (capture itself), then failing services, then the snapshot, then config.
    problems = []   # spoken in full by verbose; the first one leads the brief
    brief_first = None  # a shorter brief for the first problem, when its full text is long
    # Expected off (operator, 2026-10-01): silent in brief, always named in verbose, no expiry.
    # Only the named thing being off is silenced; anything else it reports still speaks.
    off = set(ctx.expected_off)
    off_now, back_on = [], []

    def offness(name: str, is_off: bool) -> bool:
        """True when this off-ness is expected and should not be spoken as a problem."""
        if name in off:
            (off_now if is_off else back_on).append(name)
            return is_off
        return False

    v = ctx.voice
    if v is not None:
        if not v.get("up"):
            if not offness("voice-base", True):
                problems.append("The voice base is down.")
        else:
            if v.get("error"):
                problems.append(f"Voice base: {v['error']}.")
            offness("voice-base", False)
            if not offness("phone-agent", bool(v.get("lapsed"))) and v.get("lapsed"):
                problems.append("The phone agent has gone quiet.")
            if v.get("worker_error"):
                # Upstream text spoken aloud: one line, bounded; the brief names only the fact.
                line = str(v["worker_error"]).splitlines()[0][:80] if str(v["worker_error"]).strip() else "unknown error"
                if not problems:
                    brief_first = "Transcription is failing."
                problems.append(f"Transcription is failing: {line}.")
    for cell in ctx.machine or []:
        down = cell.get("state") == "degraded"
        if cell.get("group") == "services" and offness(cell.get("label"), down):
            continue
        if down:
            problems.append(f"{cell.get('label', cell.get('id'))}: {cell.get('why', 'failing')}.")
    if ctx.machine is None:
        problems.append("No machine snapshot.")
    elif ctx.machine_stale:
        problems.append(f"The machine snapshot is stale: {ctx.machine_stale}.")
    if ctx.machine is not None:
        known = {"voice-base", "phone-agent"} | {c.get("label") for c in ctx.machine if c.get("group") == "services"}
        problems += [f"Expected off, but nothing is called {name}." for name in ctx.expected_off if name not in known]
    problems += [p[:1].upper() + p[1:] + ("" if p.endswith(".") else ".") for p in ctx.problems]
    in_list_order = lambda names: [x for x in ctx.expected_off if x in names]  # spoken in the operator's order
    tail = [f"{name} is running again but still marked off." for name in in_list_order(back_on)]
    if off_now:
        tail.append("Off by choice: " + ", ".join(in_list_order(off_now)) + ".")
    if not problems:
        notes = [f"{c.get('label', c.get('id'))}: {c.get('why')}." for c in ctx.machine or [] if c.get("state") == "needs-you"]
        if len(notes) > ctx.verbose_cap:
            notes = notes[:ctx.verbose_cap] + [f"And {len(notes) - ctx.verbose_cap} more needing you."]
        return Section("systems", "Systems fine.", " ".join(["All systems fine."] + notes + tail))
    brief = (brief_first or problems[0]) + (f" And {number(len(problems) - 1)} more." if len(problems) > 1 else "")
    return Section("systems", brief, " ".join(problems + tail))


SECTIONS: dict[str, Callable[[Context], Section]] = {
    "due_today": due_today,
    "next_up": next_up,
    "calendar": calendar,
    "systems": systems,
}
