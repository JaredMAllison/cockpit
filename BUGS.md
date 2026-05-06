# Cockpit Bug Log

---

## BUG-001 — Corner flourishes hidden behind inner content box ✓ FIXED

**Screen:** All (Items shown in screenshot)
**Symptom:** OoT chrome corner ornaments not visible at content pane corners.
**Root cause:** `zelda-frame.jsx:128–131` — corner wrapper divs are painted before the inner black box (line 132) in DOM order. The inner box has `position: relative`, creating a stacking context that paints over the corners wherever they overlap.
**Fix:** Add `zIndex: 2` to each corner wrapper div.

---

## BUG-001b — Corner flourishes misaligned (right/bottom corners displaced) ✓ FIXED

**Screen:** All
**Symptom:** After BUG-001 fix made corners visible, right and bottom corners appeared displaced ~36px off the frame edges. Top-left appeared correct.
**Root cause:** `CornerFlourish` SVG had `position: absolute` which removed it from flow, collapsing the wrapper div to 0×0. For right/bottom-anchored wrappers (`right: -4`, `bottom: -4`), the SVG then anchored from the wrong edge. Left-side corners appeared correct by coincidence.
**Fix:** Replace `position: 'absolute'` with `display: 'block'` on the SVG — keeps it in flow so the wrapper sizes correctly to 36×36 and all four corners land on the frame.

---

## BUG-002 — Tab clicks are no-ops

**Screen:** All
**Symptom:** Clicking top tabs does nothing. Arrow keys and 1/2/3 shortcuts work fine.
**Root cause:** Global variable collision. Both `zelda-frame.jsx` and `app.jsx` declare `const SUBS` at module scope. In the Babel CDN setup all top-level consts are globals — app.jsx loads last and overwrites zelda-frame's `[{id, fallback, ...}]` object array with `['quest','map','items']` string array. Inside ZeldaFrame, `s.id` is always `undefined`, so onClick fires `onSubscreenChange(undefined)` (no-op).
**Fix:** Rename `SUBS` in `app.jsx` to `SUBSCREEN_IDS`.

---

## BUG-003 — Tab buttons look wrong (janky floating boxes, no labels)

**Screen:** All
**Symptom:** Tabs appear as plain bordered boxes with only number badges; no label text; active tab doesn't connect to content pane.
**Root cause:** Same as BUG-002 — `fallbackLabel` prop receives `undefined` (from `s.fallback` where `s` is a string), so E renders an empty span; active state is always `false` (since `undefined === 'quest'`), so no tab ever gets the active style.
**Fix:** Same rename fix as BUG-002.

---

## BUG-004 — TTF balloons all gold; color strategy not working

**Screen:** Map
**Symptom:** All lanterns render in gold regardless of event category/tags.
**Likely cause:** `colorStrategy` defaults to `'tags'` but events from TTF have a `category` field, not a `tags` array. `TTF_eventColor` maps `(ev.tags || [])[0]` which is always empty. The frontmatter color field (`ev.color`) is also not set on any events.
**Fix:** Drop the tag/frontmatter color strategy entirely. Pick one coherent color per event based on `category` → mode color mapping, with gold as fallback. Remove the `colorStrategy` tweak prop.

---

## BUG-005 — TTF tag labels overlap and are unclickable

**Screen:** Map
**Symptom:** Tag/category labels on lanterns collide with each other and don't respond to clicks.
**Likely cause:** Labels are SVG `<text>` elements with no collision avoidance beyond the lantern x-placement pass. No pointer event handlers on the text elements.
**Fix:** Suppress label rendering when lanterns are too close (collision threshold). Add click handler to show event detail.

---

## BUG-006 — TTF balloons not clickable (no event detail view)

**Screen:** Map
**Symptom:** Clicking a lantern does nothing.
**Fix:** Add onClick to each lantern SVG group. Show a detail overlay or popover with full event info (title, date, time, description, category).

---

## BUG-007 — `/api/projects` slow (2.4s) — no caching

**Endpoint:** `GET http://localhost:7833/api/projects`
**Symptom:** Quest Log takes ~2.4s to populate on load and on every 30s poll.
**Root cause:** `project_dashboard.py` calls `find_projects()` on every request, which globs and `read_frontmatter()`s every `.md` in `Projects/`. No in-memory cache.
**Fix:** Add a module-level TTL cache in `project_dashboard.py`. Cache the project summary list for 30s (or until a write invalidates it). The vault changes at human pace — stale-for-30s is fine.

---

## BUG-008 — ADLs have no "done" clickbox

**Screen:** Map (QuickhacksPanel)
**Symptom:** ADLs display title and start_time but offer no way to mark them done from the cockpit.
**Fix:** Add a checkbox or button to each ADL row that fires a PATCH/POST to the marlin webhook to mark the ADL done. Determine correct endpoint — may need a new route in `webhook.py`.

---

## BUG-009 — Inventory panel folders not collapsible

**Screen:** Items (VaultPanel)
**Symptom:** All folder contents are expanded; no toggle arrow; default should be collapsed.
**Fix:** Add collapse/expand toggle per folder. Track collapsed state in component state. Default: collapsed.

---

## BUG-010 — Inventory panel scrollbar too bright

**Screen:** Items (VaultPanel)
**Symptom:** Scrollbar styling is too visually prominent against the dark theme.
**Fix:** Style the scrollbar via CSS (`::-webkit-scrollbar`, `scrollbar-color`) to a dim muted tone matching the panel chrome.

---

## BUG-011 — Print font size not configurable

**Screen:** All (file previewer / print)
**Symptom:** Print output uses a fixed font size. Operator wants larger text and the ability to configure it.
**Fix:** Add a font size control to the print/preview UI. Persist preference (localStorage or state).

---

## BUG-012 — File previewer not agnostic / no Ariel Dashboard mode

**Screen:** Items (ArielPanel / file preview)
**Symptom:** File previewer is tightly coupled to current content. Ariel should be able to present file write requests in this space. No clear close button.
**Fix:** Generalize the preview pane to an "Ariel Dashboard" slot — receives content from any source (Ariel write proposals, file previews). Add a visible close button. Remove hard coupling to current ArielPanel logic.

---

## BUG-013 — L/R shoulder hint icons visible at top of frame

**Screen:** All
**Symptom:** Left/right navigation hint icons appear in the top frame chrome. Operator does not want them.
**Fix:** Remove the L/R shoulder icon elements from `zelda-frame.jsx`.

---

## BUG-014 — No pane-switch animation

**Screen:** All
**Symptom:** Switching between subscreens (quest/map/items) has no transition animation. `SubscreenTransition` may be broken or not rendering.
**Fix:** Verify `SubscreenTransition` is mounted and receiving the correct `active` prop. Confirm CSS transitions or JS animation are firing. Debug why animation is absent.

---

## BUG-015 — Nothing surfacing despite "available" mode

**Screen:** N/A (Marlin engine, not cockpit)
**Symptom:** Operator is in "available" mode but no tasks are being surfaced to phone via Ntfy/pull dashboard.
**Fix:** Check `marlin.py` filter logic — `available_from`, `status`, `context` fields. Check `state.json` for current mode value. Check systemd timer is running (`systemctl --user status marlin-surface.timer`). Separate from cockpit codebase.

---

## FEAT-001 — Bottom tool panel (customizable utilities tray)

**Request:** A collapsible panel at the bottom of the cockpit with swappable tool slots. Proposed tools:
- **Sketchpad** — freeform drawing/scratch space
- **Notepad** — quick plain-text scratch notes
- **Calculator**
- **Inbox** — shows `Inbox.md` content; supports appending new captures directly from the cockpit
- Customizable: operator can choose which tools occupy the slots

**Notes:** Inbox tool needs read+append access to `Inbox.md` via the webhook or project_dashboard backend. Other tools are likely pure client-side.

---
