"""The operator's map section file: which sections, in what order.

A strict subset of YAML, read with the standard library (the cockpit has no
third-party dependencies):

    sections:
      - due_today
      - next_up
    brief_list_cap: 2
    verbose_list_cap: 5
    expected_off:        # off by choice: silent in brief, named in verbose
      - some-service

Anything this reader doesn't understand is reported, never silently ignored.
"""
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_SECTIONS = ["due_today", "next_up", "calendar", "systems"]
DEFAULT_CAP = 2
DEFAULT_VERBOSE_CAP = 5


@dataclass
class MapConfig:
    names: list
    brief_cap: int = DEFAULT_CAP
    verbose_cap: int = DEFAULT_VERBOSE_CAP
    expected_off: list = field(default_factory=list)  # off by the operator's choice; no expiry
    problems: list = field(default_factory=list)


LISTS = ("sections", "expected_off")


def read_sections(path: Path) -> MapConfig:
    """The operator's map config. Never raises: what it can't use falls back and is reported."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError:
        return MapConfig(list(DEFAULT_SECTIONS), problems=["map sections file missing; using the default list"])
    except ValueError:  # not UTF-8
        return MapConfig(list(DEFAULT_SECTIONS), problems=["map sections file unreadable; using the default list"])
    cfg, lists, current = MapConfig([]), {"sections": [], "expected_off": []}, None
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.strip().rstrip(":") in LISTS and line.strip().endswith(":"):
            current = line.strip()[:-1]
        elif current and line.lstrip().startswith("- "):
            name = line.lstrip()[2:].strip().strip("\"'")
            if name in lists[current]:
                cfg.problems.append(f"map sections file line {n}: {name} is listed twice")
            else:
                lists[current].append(name)
        elif line.startswith(("brief_list_cap:", "verbose_list_cap:")):
            current = None
            key, value = (part.strip() for part in line.split(":", 1))
            if value.isdigit() and int(value) > 0:
                if key == "brief_list_cap":
                    cfg.brief_cap = int(value)
                else:
                    cfg.verbose_cap = int(value)
            else:
                cfg.problems.append(f"map sections file line {n}: {key} must be a positive number")
        else:
            current = None
            cfg.problems.append(f"map sections file line {n} not understood")
    cfg.names, cfg.expected_off = lists["sections"], lists["expected_off"]
    if not cfg.names:
        cfg.problems.append("map sections file lists no sections; using the default list")
        cfg.names = list(DEFAULT_SECTIONS)
    return cfg
