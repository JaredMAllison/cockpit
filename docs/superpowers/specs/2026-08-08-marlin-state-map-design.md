# Marlin State Map — design

**Date:** 2026-08-08
**Status:** design approved, not yet planned
**Decision record:** `Marlin/Decisions/marlin-adr-057-marlin-state-map.md`
**Panel:** cockpit panel five (replaces the "Vault Visualizer" file-browser framing)

---

## Problem

Nothing in the stack carries persistent Marlin state in the visual field. Marlin's push surface is an interrupt — a notification fires, is dismissed, and the state is gone. TTF renders time. The cockpit switches panels. No surface answers *"what exists, and what shape is it in."*

The operator's stated driver: **"I constantly do work that I don't remember."** A census on 2026-08-08 found 14 repositories (≈8 live), three P1 repositories all parked on stale feature branches, `Applications/` holding 2 of ~15 applications, six TTF balloons diverged from the vault, and three founding design documents in no commit anywhere. None of it was visible; all of it was found by deliberate search.

## Non-goals

- **Not a file browser.** Browsing is navigation plus query and fails the HUD test.
- **Not a history surface.** The map shows present state. "What did I do and forget" is a real but separate need requiring its own design.
- **Not a task list.** Marlin's one-at-a-time push (ADR-002) remains the execution interface. This is the awareness interface.
- **Not an editor.** Read-only. Actions, if ever added, come later and separately.

## HUD test (the acceptance criteria)

From the operator's own spec, 2026-08-07. All six must hold:

| Criterion | How this design meets it |
|---|---|
| No navigation | Zoom only; the frame is never lost |
| No query | Everything is on screen or one zoom in; nothing is typed to find it |
| Always current | Derived on render from live sources |
| Glanceable | Fixed positions, small state vocabulary, ambient half stays quiet |
| Shows state, not history | Present tense only; forward view for roadmap |
| Persistent | Lives in the cockpit, up continuously |

**Benchmark:** pill bottles on a desk. A digital HUD has to beat a desk — zero technology, zero interaction, complete at a glance.

---

## Architecture

### Layout

```
┌─ ORBIT ─────────────────────────────────────────────────┐
│ ┌─ WORK ───────────────────────┐┌─ MACHINE ───────────┐ │
│ │ P1                           ││ services  ●●●●○●    │ │
│ │  [job hunt] [ariel] [lmf]    ││ repos     ⚠⚠⚠✓✓✓✓✓  │ │
│ │  [health]  [cockpit][marlin] ││ sync      ⚠ 6       │ │
│ │ P2                           ││ backup    14h       │ │
│ │  [ttf] [dental] [athenaeum]  ││                     │ │
│ │ P3 / R                       ││ (quiet when clean)  │ │
│ │  [keypad][lola][sol3][ffxiv] ││                     │ │
│ └──────────────────────────────┘└─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │ zoom
                          ▼
┌─ ONE CELL FILLS THE FIELD ──────────────────────────────┐
│ ariel                          P1 · active · tier 2     │
│                                                          │
│ next        merge hotfix/recover-persona (75d)          │
│ roadmap     ▓▓▓░░░░  phase 1 of 3                       │
│ open        4 tasks · 1 overdue                         │
│ blocked     Bazza GPU degraded 2026-08-07               │
│ ─────────────────────────────────────────────────────── │
│ ◇ reads as parked rather than active — no commits       │
│   since 05-25 while brief says daily-driver build       │
│   ◇ assistant read, not measured                        │
└─────────────────────────────────────────────────────────┘
```

**Orbit does not scroll.** Every project is present. Growth resolves by grouping or by adding a zoom level — never by a scrollbar.

**Positions are fixed.** A cell's coordinates derive from stable keys (priority tier, then name), not from data that changes. Spatial memory is the point.

### The two halves are not symmetric

| | Work | Machine |
|---|---|---|
| Channel | foreground | **ambient** (ADR-054) |
| At rest | holds the eye | nearly invisible, not read |
| Degraded | cell state changes | band asserts, gains weight |
| Contents | projects | repos, services, sync, backup |

---

## Data model

One record type. Everything on the map is a **cell**.

```
Cell
  id            stable identifier (project slug, repo name, service name)
  region        work | machine
  group         P1 | P2 | P3 | R | services | repos | sync | backup
  label         display name
  measures      { name: value }     ← facts only, each independently sourced
  state         derived from measures by an explicit, readable rule
  overlays      [ { text, source, kind: "judgment" } ]   ← labeled, never affects state
  detail        payload rendered on zoom (roadmap, next action, blockers)
```

**`state` is a pure function of `measures`.** The rule must be stateable in one sentence per state and must be inspectable from the UI. If a cell is lit, "why" answers with a number.

### State vocabulary — keep it small

Four states. More than four and the field stops being glanceable.

| State | Meaning | Example rule |
|---|---|---|
| `needs-you` | a measured threshold is crossed | overdue tasks > 0, or uncommitted files > 0 on a P1 repo |
| `moving` | recent measured activity | commit or task transition within 7d |
| `quiet` | no activity, no threshold crossed | neither of the above |
| `degraded` | machine-half only: a service or sync is failing | container down, balloon drift > 0, backup age > 48h |

`quiet` is not an alarm. A parked project is *supposed* to be quiet, and the map must not imply otherwise — that read belongs in an overlay.

### Sources — all derived, nothing maintained

| Measure | Source | Cost |
|---|---|---|
| project status, priority, tier | vault frontmatter | file read |
| open / overdue task counts | vault `Tasks/*.md` frontmatter | file read |
| roadmap position | project note roadmap section | file read |
| repo branch, staleness, dirty | `git` per repo in `~/git` | subprocess |
| service up/down | `docker ps` | subprocess |
| balloon drift | TTF `/api/events` vs vault `ttf_id` + `goal_date` | HTTP |
| backup age | restic / Ivy log | file or ssh |
| graph edges | Knowledge Loom | HTTP |

**No writable store sits behind the map.** If a future change introduces a hand-edited file the map trusts, ADR-057 is violated.

### Freshness

Render-time derivation, with a short cache to keep the panel responsive. Cache TTL is a tuning knob, not a design decision — but a **stale render must say so**. A map that silently shows old state is the failure mode this whole design exists to prevent.

---

## Judgment overlays

Assistant-derived reads are permitted and useful — "this reads as abandoned rather than parked" is exactly the sentence a measured rule cannot produce. They are constrained:

1. Rendered in a **visually distinct** zone, never as cell colour or position.
2. Marked with their kind and source on their face.
3. **Never** an input to `state`.
4. Absent by default at Orbit; they appear on zoom.

Rationale: the vault has no neutral tier, and format launders its authors' priors. An unlabeled inference presented in the same visual language as a measurement becomes indistinguishable from one.

---

## Zoom

Three levels. More is navigation wearing a zoom costume.

| Level | Shows |
|---|---|
| **Orbit** | all cells, state only, nothing scrolls |
| **Cell** | one cell fills the field: next action, roadmap position, blockers, open counts, overlays |
| **Detail** | the underlying records — the specific tasks, the specific commits, the specific drift rows |

The parent frame remains visible at every level. Zooming out is always one gesture and always returns to the same coordinates.

---

## Open questions

1. **Where do repos map to projects?** `~/git/ariel` ↔ `Projects/ariel-von-marlin.md` is obvious; several are not. Unmapped repos need a home in the Machine half rather than being dropped.
2. **What is "roadmap position" mechanically?** Tier-1 projects have roadmap files; tiers 2–4 do not. The forward view may be thinner for most projects than the sketch implies.
3. **Backup age source.** Whether the restic log is readable from the cockpit container, or needs an exporter.
4. **Does Tori's cockpit (`:9200`) get one?** ADR-057 does not rule. The HUD-is-private argument from 2026-08-07 suggests per-operator maps, not a shared one.

---

## Sequencing note

This panel is downstream of the **desire-path survey**, and the survey's deliverable is *this data model* rather than a written report. Per `Insights/prefer-derived-indexes-over-maintained-ones`, a written survey of a system the operator does not remember building becomes another maintained index and goes stale — the `Applications/` failure one layer up.

Survey defines what state is worth rendering. This spec defines how it renders.
