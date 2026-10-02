"""Build the map: the operator's sections, in order, as text (spec 2026-10-01)."""
from .map_sections import SECTIONS, Context


def build_map(names: list, ctx: Context, detail: str, generated_at: str) -> dict:
    """Unknown names are skipped and reported by `systems`. One failing section never blanks the rest."""
    known = [n for n in names if n in SECTIONS]
    ctx.problems = ctx.problems + [f"map: unknown section '{n}'" for n in names if n not in SECTIONS]
    out = []
    for name in known:
        try:
            s = SECTIONS[name](ctx)
        except Exception as e:  # a bug in one section must not silence the map
            out.append({"id": name, "text": f"The {name} section failed ({type(e).__name__}).", "as_of": None, "ok": False})
            continue
        out.append({"id": s.id, "text": s.verbose if detail == "verbose" else s.brief, "as_of": s.as_of, "ok": s.ok})
    return {"generated_at": generated_at, "detail": detail, "sections": out,
            "text": " ".join(s["text"] for s in out if s["text"])}
