# Map — one model, spoken first — design

**Date:** 2026-10-01
**Status:** design approved in conversation; spec awaiting operator review
**Decision records:** `Marlin/Decisions/marlin-adr-057-marlin-state-map.md` (and its 2026-09-30 amendment), `Marlin/Projects/wearable-marlin-terminal-commands.md` (Quickhacks)
**Builds on:** `docs/superpowers/specs/2026-08-08-marlin-state-map-design.md`, `statemap/`, `/api/state-map`

---

## Problem

"Map" keeps resurfacing as one need in several forms: the cockpit's State Map panel (2026-08-08), the wearable's spoken `map` Quickhack, the phone cockpit, a morning system check, and "show me the map" in a session. The model behind the State Map exists and is correct. **The panel is not used.** Operator, 2026-10-01: *"I dont use the statemap. Its too overwhelming. We need to pull some ADHD-Autism UI trickery."*

So the need is the model's **content**, in a rendering that costs almost nothing to take in.

## Intent (operator's words)

- The voice `map` is the main consumer: *"I feel like a map voice command is going to have the highest profile and get the most use. This will probably happen soon."*
- **Brief first; more on request.** *"if I get a brief, and the following word is \"elaborate\", it sends the verbose."*
- **Editable over time.** *"this map should be easily modifiable later. Adding things, taking things out. Depending on what I find useful or noise."*
- **A fallback with its age.** *"Time-stamp-Stated cached copy on phone?"*; *"always speak it with the age."*
- **Interruptible.** *"if I hear 9 days old. I click PTT to skip."*
- **Generalizable** toward LMF, without building that pass now.

## Goals

1. One host endpoint, `/api/map`, returns the map as **sections of text**, each with a brief and a verbose form, in an order set by a vault file.
2. Sections are **plug-ins**: a section is one function, registered by name. Removing or reordering is a vault edit; adding a new kind is one function plus one line.
3. Every rendering (voice, phone cockpit, morning check, chat) draws on this one endpoint. Nothing assembles its own version of the day.
4. The phone speaks it, keeps a timestamped copy, and speaks the copy **age-first** when the host is down.

## Non-goals

- Replacing or redesigning the State Map panel. It stays as it is. A calm visual rendering is a later, separate design.
- The Marlin Calendar itself (seeded; the `calendar` section is an empty slot until it exists).
- Promoting `map` to an LMF feature (seeded; trigger below).
- `query` and the other Quickhacks.

## Architecture

```
vault: System/StateMap/map-sections.yaml        ← the operator's list: which sections, what order
          │
cockpit: GET /api/map?detail=brief|verbose      (new; beside /api/state-map)
          │   for each listed section: fn(ctx) → Section{id, brief, verbose, as_of, ok}
          │   sources (fetched once per request, shared by all sections):
          │     tasks       ← Marlin webhook  :7832/api/tasks        (existing)
          │     projects    ← dashboard       :7833/api/projects     (existing)
          │     surfaced    ← Marlin webhook  :7832/api/surfaced     (NEW, small)
          │     machine     ← System/StateMap/machine.json           (existing snapshot)
          │     voice base  ← :7840/status and /liveness/gaps        (existing, token)
          ▼
phone (LMF voice-capture app): prepends its live line (mode, home/away)
          → speaks with on-device TTS → caches the response with its timestamp
```

### The section file

`System/StateMap/map-sections.yaml`, edited by hand:

```yaml
# Order = speaking order. Delete a line to drop a section; move it to reorder.
sections:
  - due_today
  - next_up
  - calendar
  - systems
brief_list_cap: 2      # items named in a brief list before "and N more"
```

Unknown names are **skipped and reported** in `systems` (*"map: unknown section 'due_tody'"*), never silently dropped. A missing or unreadable file falls back to the default list above, and `systems` says so.

### The section contract

```python
@dataclass
class Section:
    id: str
    brief: str          # one or two short sentences; "" means silent in brief
    verbose: str        # the expanded form
    as_of: str | None   # ISO time of the data, when it isn't "now"
    ok: bool            # False when its source failed; the text then says so
```

`SECTIONS: dict[str, Callable[[Context], Section]]`, where `Context` holds the shared fetched sources, `today` and `now`. Section functions are pure over `Context`, so they unit-test without a network.

**Facts, not judgment** (ADR-057 §4): sections report measured facts. Any assistant interpretation, if a future section has one, must be spoken as such (*"looks like…"*).

### The starting sections

| id | brief | verbose | source |
|---|---|---|---|
| *(phone)* | "You're home, Passive is on." | + mic, and since when | phone, live |
| `due_today` | "Two things due today: A and B." / "Nothing due today." (+ "and one overdue") | each item with its project; overdue items listed | tasks: `goal_date` ≤ today, status not `done`/`cancelled`/`mothballed`, `available_from` ≤ today |
| `next_up` | "Next up: call WorkSource." / "Nothing surfaced." | + project, duration, surfaced how long ago | `/api/surfaced` |
| `calendar` | "" (silent) | "No calendar yet." | empty slot until the Marlin Calendar |
| `systems` | "Systems fine." / the single worst problem ("The base is down since 9:14.") | each service, sync backlog, kept-aside segments, last backup age, any unknown section names | machine snapshot, voice base `/status` and `/liveness/gaps` |

Lists in a brief name at most `brief_list_cap` items, then "and N more."

### `/api/surfaced` (Marlin webhook, new)

`GET /api/surfaced` → `{"title": str|null, "project": str|null, "surfaced_at": str|null}`, read from `state.json` the way `dashboard_page()` already does. It is read-only and small, in the webhook because the webhook owns `state.json`.

### `/api/map`

`GET /api/map?detail=brief|verbose` (default `brief`):

```json
{"generated_at": "2026-10-01T15:40:00-07:00", "detail": "brief",
 "sections": [{"id": "due_today", "text": "Two things due today: …", "as_of": null, "ok": true}, …],
 "text": "Two things due today: … Next up: … Systems fine."}
```

`text` is the sections joined in order, skipping empty ones, so a consumer that only wants to speak needs one field. Cached 30 s, as `/api/state-map` is.

**Auth:** served on the same cockpit as `/api/state-map`. Production (`:9100`) is behind nginx basic auth; the phone stores that credential the way it stores the base token. Dev (`:9110`) has no auth.

## The phone side (in the LMF voice-capture app; its own plan)

- **Trigger:** side-button **hold**, by registering as Android's default digital assistant (`ACTION_ASSIST`). Unverified on One UI 8.5; checked with the first build. Fallback: a quick-settings tile. Later, the `map` Quickhack over PTT.
- **Speech:** Android `TextToSpeech`, on-device. The phone's live line first, then `text`.
- **"Elaborate":** after a brief, saying *elaborate* fetches `detail=verbose` for the same request. This needs a listening window; until PTT exists, the verbose version is a second press.
- **Barge-in:** any trigger press while speaking stops speech at once (amends FR-032 in LMF spec 004).
- **Cache:** the last good response, stored with `generated_at`. When the cockpit is unreachable: the live line, then *"From 7:40 this morning: …"* (the age is always spoken first, never refused). With no cache: *"No map yet; the host hasn't answered since the app started."* Refreshed quietly every 15 min while the cockpit answers.

## Failure handling

| Failure | Behaviour |
|---|---|
| A section's source fails | That section's text says so (*"Tasks unreadable right now."*), `ok=false`; the others still speak |
| An unknown section name | Skipped; named in `systems` |
| A missing section file | Default list; `systems` says so |
| The cockpit is unreachable (phone) | Live line + cached map, age first |
| An empty day | Short honest lines (*"Nothing due today."*), never a gap |

## Testing

- **Section functions:** unit tests over a fixed `Context` (no network) for each section, brief and verbose, including empty, overdue, a failed source, and the list cap.
- **Section file:** order respected, unknown name reported, missing file falls back.
- **Route:** `/api/map` brief and verbose, with sources stubbed at the HTTP boundary (the same pattern as the existing `/api/state-map` tests).
- **Wording:** snapshot tests on `text`, so wording changes are deliberate.
- **`/api/surfaced`:** a webhook test against a temporary `state.json`.
- **Phone:** on the A16: speaks, barge-in, cache age-first (stop the cockpit and ask), and the side-button hold.

## Generalization (seams now, feature later)

- No Marlin names in section code; sections read LMF vault conventions (task frontmatter).
- Which sections, order, URLs and tokens are instance config.
- 🌱 **Seeded:** promote `map` to an LMF feature (`~/git/lmf/features/`, with a spec). **Trigger:** a second instance wants a map (Tori's cockpit `:9200`; Jason's LMF kit).

## Open

- The exact `systems` "worst problem" ranking (base down > sync backlog > kept aside > backup age is the starting order).
- Whether `elaborate` should also work as a standalone Quickhack later ("elaborate" after any brief answer).
