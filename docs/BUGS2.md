# Cockpit Bug Log v2

Current as of 2026-05-08. All bugs verified against running code. BUGS.md v1 entries that are confirmed fixed are not carried forward.

---

## B2-001 — TTF panel shows "UNREACHABLE" (always)

**Screen:** Map (TtfPanel)
**Symptom:** The TTF timeline never loads. The top-left badge shows "⚠ UNREACHABLE" and "0 EVENTS".
**Root cause:** `ttf.jsx:16` calls `usePoll(fetchTtfEvents, 30000)` — no arguments. `fetchTtfEvents(from, to)` in `api.js:43` expects two date strings. `from` and `to` are both `undefined`, producing URL `?from=undefined&to=undefined`. The TTF API returns HTTP 400. `_fetch` throws on non-OK status.
**Fix:** The day-offset date strings (`fromStr`, `toStr`) are already computed at lines 53-54. Bind them to the poll call:

```js
const fetchTtf = React.useCallback(() => fetchTtfEvents(fromStr, toStr), [fromStr, toStr]);
const { data, error } = usePoll(fetchTtf, 30000);
```

(usePoll ignores fetchFn reference changes per its design — only intervalMs triggers re-subscribe, so this won't cause thrash.)

---

## B2-002 — ADL "done" button throws ReferenceError

**Screen:** Map (QuickhacksPanel)
**Symptom:** Clicking the ✓ button on any ADL row does nothing. Console throws `ReferenceError: markAdlDone is not defined`.
**Root cause:** `quickhacks.jsx:25` calls `markAdlDone(title)` but the function is **never defined** in `api.js` or anywhere else. The docs plan mentions adding it but it was never wired.
**Fix:** Add to `api.js`:

```js
function markAdlDone(title) {
  return fetch(`${HOSTS.marlin}/done?task=${encodeURIComponent(title)}`, { redirect: 'manual' });
}
```

---

## B2-003 — 4th sub-screen (Terminal) has no tab / bottom nav wrong

**Screen:** All
**Symptom:** `app.jsx` defines `SUBSCREEN_IDS = ['quest', 'map', 'items', 'terminal']` with keyboard shortcuts 1-4, but `zelda-frame.jsx`'s `SUBS` only has 3 entries. The bottom bar shows "1–3 screen" and only 3 nav dots. The terminal screen is reachable via keyboard (key `4` or arrow right from items) but has no tab button.
**Root cause:** Two separate sub-screen lists. The frame chrome doesn't know about Terminal.
**Fix:** Either:
- Add `'terminal'` to zelda-frame's `SUBS` (with appropriate `fallback`), OR
- Move terminal to its own dedicated screen outside the 3-sub-screen OoT metaphor

---

## B2-004 — File previewer lacks close button / hard-coupled to vault

**Screen:** Items (VaultPanel)
**Symptom:** The "Items" screen shows vault file browser + preview but:
1. The preview pane has a close button only when content is loaded
2. Ariel citations open files in the preview but there's no generalized slot for Ariel to present write proposals or other content
**Root cause:** `vault.jsx` `ContentPane` conditionally renders close button only when `onClose` is provided. The preview is exclusively vault-file-driven.
**Fix:** Needs design work — this is the "Ariel Dashboard" slot concept from the original spec.

---

## B2-005 — Canvas scrollbar theme inconsistent

**Screen:** Quest (ProjectsPanel + MarlinPanel)
**Symptom:** The outer content panels have custom scrollbar styling (`#2a2520` thumb) but they use class name `panel-scroll`, which shares CSS with other elements. The scrollbar styling may appear inconsistent between the tree and preview panes.
**Root cause:** `index.html` defines `.panel-scroll`, `.vault-tree`, and `.preview-pane` scrollbar styles but the inner project/marlin panels use `.panel-scroll` which uses the shared dim styling — may not match the actual panel chrome.
**Priority:** Low. Cosmetic.

---

## Archived

| Bug | Status | Notes |
|-----|--------|-------|
| BUG-001 (corner flourishes) | FIXED | zIndex fix applied |
| BUG-001b (corner alignment) | FIXED | SVG display:block fix applied |
| BUG-002 (tab clicks no-op) | FIXED | SUBSCREEN_IDS rename in app.jsx |
| BUG-003 (tab labels) | FIXED | Same root cause as BUG-002 |
| BUG-004 (TTF balloon colors) | FIXED | category→mode color mapping in ttf-helpers.js |
| BUG-005 (TTF label overlap) | FIXED | Collision detection + suppressLabel |
| BUG-006 (TTF clickable) | FIXED | onClick + TtfEventDetail overlay |
| BUG-007 (projects slow) | FIXED | TTL cache in project_dashboard.py |
| BUG-009 (vault folders) | FIXED | Collapse/expand with localStorage |
| BUG-010 (scrollbar bright) | FIXED | Dimmed CSS styling |
| BUG-011 (print font size) | FIXED | A+/A− buttons + localStorage |
| BUG-013 (L/R shoulder icons) | FIXED | ShoulderHint defined but never rendered |
| BUG-014 (no animation) | FIXED | SubscreenTransition fully implemented |
