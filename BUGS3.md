# Cockpit Bug Log v3

Current as of 2026-05-08. Post-TTF-iframe-swap landscape.

---

## B3-001 — Terminal tab doesn't exist in ZeldaFrame chrome

**Screen:** All
**Status:** FIXED (2026-05-08)
**Fix:** Added terminal entry to `SUBS` array in `zelda-frame.jsx`. Tab renders with hotkey `4`, bottom nav shows 4 dots, keyboard hint reads "1–4 screen".

---

## B3-002 — Terminal session lost on tab switch

**Screen:** Terminal
**Status:** FIXED (2026-05-08)
**Fix:** Changed from conditional rendering (`active === X ? component : null`) to always-mounted with `display: none` toggle in `app.jsx`. The ttyd iframe stays in the DOM, preserving the terminal session across tab switches.

---

## B3-003 — Dead code: old TTF panel + helpers still loaded

**Screen:** n/a (load time)
**Symptom:** `index.html` still loads `panels/ttf.jsx`, `hooks/ttf-helpers.js`, `hooks/ttf-belt-controller.jsx`, and `hooks/ttf-nav-bar.jsx` — none of which are used anymore since the Map screen now embeds the real TTF via iframe.
**Fix:** Remove the `<script>` tags from `index.html` for these four files.

---

## B3-004 — `markAdlDone` was missing from api.js

**Screen:** Map (QuickhacksPanel)
**Status:** FIXED (2026-05-08)
**Fix:** Added `function markAdlDone(title)` to `hooks/api.js`. ADL checkmarks now fire `GET /done?task=...` against the marlin webhook.

---

## B3-005 — USB deployment needs TTF server

**Screen:** n/a (deployment)
**Symptom:** The cockpit now relies on the TTF server being reachable at `http://localhost:3000` (the "alpha" systemd service). The USB deployment scripts at `deploy/windows/` currently only handle cockpit + marlin + ollama. TTF (Node.js app) must be bundled and launched for the Map screen to work on a USB-booted instance.
**Fix:** Add TTF to the USB deploy stack — bundle Node.js runtime, the TTF repo, and a launch script. Separate task.

---

## B3-006 — TTF aesthetic config reference

**Screen:** Map
**Note:** The TTF appearance is configurable at:
- `config/default.json` — categories, colors, display name
- `src/frontend/css/main.css` — visual theme
- `src/frontend/js/canvas/` — balloon rendering, layout, animation
Repo: `/home/jared/git/the-time-factory`

---

## Archived (BUGS.md / BUGS2.md)

All prior bugs now either fixed or irrelevant after the iframe swap. Key wins:
- TTF now runs the full canvas app — create/edit/delete events, sync, warp, urgency, recurring events.
- Terminal has a tab and persists across switches.
- ADL checkmarks actually work.
- Corner flourishes, scrollbar, labels, animation, vault folders — all clean.
