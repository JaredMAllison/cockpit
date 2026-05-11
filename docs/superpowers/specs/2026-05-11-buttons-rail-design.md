# Buttons Rail — Design Spec
**Date:** 2026-05-11
**Status:** Approved

---

## Overview

A persistent HUD layer that encircles the subscreen pane. Panel-agnostic — always present regardless of which subscreen is active. Three initial components: service indicator lights, an inbox capture field, and a Spellbook (terminal) popup trigger. Designed for clean future expansion via a declarative button registry.

---

## Architecture

### ButtonRail (CSS Grid Wrapper)

`ButtonRail` wraps `SubscreenTransition` in a CSS grid with five named areas: `top`, `left`, `content`, `right`, `bottom`. Each edge is a slot. An edge renders only when it has registered buttons — empty edges collapse to zero height/width and take no space. The content pane fills the remaining grid area.

A `ButtonRailContext` allows button components to self-register by declaring `{ edge, order, component }`. No changes to `ZeldaFrame` or `SubscreenTransition` internals — `App` simply wraps `SubscreenTransition` in `ButtonRail`.

**Default active edge:** Bottom.

### File Structure

```
buttons/
  ButtonRail.jsx       — grid wrapper, context, edge renderer
  ServiceLights.jsx    — health polling + indicator lights
  InboxField.jsx       — inbox capture input
  TerminalButton.jsx   — Spellbook trigger + popup shell
```

### App Changes

- `TerminalScreen` and `MagicScreen` removed from `SUBSCREEN_IDS`
- Remaining subscreens: `['quest', 'map', 'items', 'ink', 'health']` — keys `1`–`5`
- Backtick `` ` `` added as global Spellbook toggle (does not conflict with subscreen keys)
- `terminalOpen` / `terminalSize` state added to `App`
- Spellbook popup rendered as a portal at `App` level (above rail, above panels)

---

## Button Components

### ServiceLights

- Polls `GET /api/health` on a 30s interval
- One indicator per service
- Three states: `ok`, `degraded`, `error`
- Ambient — no interaction required to show status
- Clicking a light opens a small inline tooltip: service name, latency, last checked
- No popup, no navigation — tooltip closes on blur/click-away

### InboxField

- Text input, always visible in the bottom rail
- Submit on Enter → `POST /api/vault/append-inbox`
- Clears on successful submit
- Brief inline flash confirmation ("✓") — no modal
- Focused by a keyboard shortcut (TBD, must not conflict with `1`–`5` or `` ` ``)
- Escape blurs back to panel navigation context

### TerminalButton

- Single button in the bottom rail
- Pressing it (or hitting `` ` ``) toggles the Spellbook popup
- Spellbook state machine: **Minimized → Quarter → Half → Full**
  - Minimized: iframe in DOM, session alive, `display:none`
  - Quarter: bottom-right corner (~40% wide, ~30% tall) — panel content remains visible
  - Half: bottom-right corner (~50% wide, ~50% tall) — panel content partially visible
  - Full: entire content pane (covers rail)
- Size toggle button inside Spellbook header cycles Quarter → Half → Full → Quarter
- Close button → Minimized (session preserved)
- Backtick from any context: Minimized ↔ last used size

---

## Spellbook (Terminal) Integration

- ttyd already runs in the existing stack (was `MagicScreen`)
- Spellbook iframe repoints to existing ttyd endpoint — no new docker-compose service
- Popup rendered as a portal at `App` level, z-index above all panels and rail
- Iframe kept in DOM at all states; `display:none` when Minimized — session never dies
- First open lazy-initializes the iframe

**Keyboard behaviour inside Spellbook:**
- Escape passes through to the shell — does not close or minimize
- Backtick `` ` `` closes/minimizes (cockpit intercepts before iframe)

**Backtick guard:** Backtick only triggers Spellbook when no `INPUT`, `TEXTAREA`, or `contentEditable` element has focus. Follows the same guard pattern already used by the subscreen number keys. Typing backtick in `InboxField` is unaffected.

---

## Aesthetic

Match the OOT Zelda chrome exactly using existing `ZELDA` tokens.

| Element | Treatment |
|---|---|
| Rail background | `feltInner` (`#0a1f17`) |
| Rail border | `goldDeep` (`#5a4d24`) top edge, `gold` (`#d4b76a`) accent |
| Rail text | `parchText` (`#f4e8c8`) / `parchTextDim` (`#c8b896`) |
| Service lights | Recessed gem indicators using existing glow/boxShadow pattern |
| Light: ok | `#6c9a5a` (available green) |
| Light: degraded | `#d4a84a` (transit amber) |
| Light: error | `#c95a52` (deep-work red) |
| Spellbook header | `feltInner` bg, `goldDeep` border, `parchText` title in pixel font |
| Spellbook buttons | Follow existing ZeldaFrame button style |

**Frontend-design skill brief:** Match ZELDA token palette exactly. Bottom rail reads as an instrument panel inset into the ZeldaFrame — same inset box-shadow language already used by the frame. Service lights use the existing mode color glow pattern (cursor dot / mode indicator dot). Spellbook header consistent with existing panel headers. No new color tokens introduced.

---

## Expansion Contract

To add a future button to the rail:

1. Create `buttons/MyButton.jsx`
2. Self-register: `useButtonRail({ edge: 'top', order: 3 })`
3. The target edge appears automatically if previously empty

No changes to `ButtonRail`, `App`, or any existing component required.

---

## Out of Scope

- Draggable rail (future)
- Rail position customization UI (future)
- InboxField keyboard shortcut (TBD during implementation)
