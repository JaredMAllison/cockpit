"""The operator's map section file: which sections, in what order.

A strict subset of YAML, read with the standard library (the cockpit has no
third-party dependencies):

    sections:
      - due_today
      - next_up
    brief_list_cap: 2
    verbose_list_cap: 5

Anything this reader doesn't understand is reported, never silently ignored.
"""
from pathlib import Path

DEFAULT_SECTIONS = ["due_today", "next_up", "calendar", "systems"]
DEFAULT_CAP = 2
DEFAULT_VERBOSE_CAP = 5


def read_sections(path: Path):
    """Return (names, brief_list_cap, verbose_list_cap, problems). Never raises."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError:
        return list(DEFAULT_SECTIONS), DEFAULT_CAP, DEFAULT_VERBOSE_CAP, ["map sections file missing; using the default list"]
    except ValueError:  # not UTF-8
        return list(DEFAULT_SECTIONS), DEFAULT_CAP, DEFAULT_VERBOSE_CAP, ["map sections file unreadable; using the default list"]
    names, cap, vcap, problems, in_list = [], DEFAULT_CAP, DEFAULT_VERBOSE_CAP, [], False
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.strip() == "sections:":
            in_list = True
        elif in_list and line.lstrip().startswith("- "):
            name = line.lstrip()[2:].strip().strip("\"'")
            if name in names:
                problems.append(f"map sections file line {n}: {name} is listed twice")
            else:
                names.append(name)
        elif line.startswith(("brief_list_cap:", "verbose_list_cap:")):
            in_list = False
            key, value = (part.strip() for part in line.split(":", 1))
            if value.isdigit() and int(value) > 0:
                if key == "brief_list_cap":
                    cap = int(value)
                else:
                    vcap = int(value)
            else:
                problems.append(f"map sections file line {n}: {key} must be a positive number")
        else:
            in_list = False
            problems.append(f"map sections file line {n} not understood")
    if not names:
        problems.append("map sections file lists no sections; using the default list")
        names = list(DEFAULT_SECTIONS)
    return names, cap, vcap, problems
