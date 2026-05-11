# Buttons Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent HUD rail encircling the subscreen pane with three components: service indicator lights, inbox capture field, and Spellbook (ttyd terminal) popup — replacing the existing full-screen terminal and magic subscreens.

**Architecture:** `ButtonRail` wraps `SubscreenTransition` in a CSS grid with named edge slots. Button components self-register via React context portals. The Spellbook popup is a portal at document.body level; iframe stays alive in DOM across all states. Terminal and Magic subscreens are removed only after Spellbook is verified working.

**Tech Stack:** Vanilla React 18 + Babel (CDN), no bundler, plain JSX files loaded via `<script type="text/babel">`. Global symbol exposure via `Object.assign(window, ...)`. Existing ZELDA tokens from `window.ZELDA`.

> **⚠️ Build note:** Tasks 1–5 can be completed in the current MagicScreen session. Do NOT remove terminal/magic subscreens (Task 6) until Spellbook is verified working — the user is currently using MagicScreen as their terminal launcher. Task 6 requires switching to a plain terminal window first.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `buttons/ButtonRail.jsx` | Create | CSS grid wrapper, slot refs, context, `useButtonRailSlot` hook |
| `buttons/ServiceLights.jsx` | Create | Health polling, indicator dots, click tooltip |
| `buttons/InboxField.jsx` | Create | Inbox capture input, POST to vault |
| `buttons/TerminalButton.jsx` | Create | Rail button + Spellbook iframe popup + size controls |
| `app.jsx` | Modify | Add ButtonRail wrapper, TerminalButton state + props, backtick handler |
| `zelda-frame.jsx` | Modify (Task 6) | Remove terminal/magic from SUBS, add backtick hint |
| `subscreen-transition.jsx` | Modify (Task 6) | Update SUBSCREEN_ORDER |
| `index.html` | Modify | Add script tags for 4 new button files, remove terminal panel |

---

## Task 1: ButtonRail — grid wrapper, slot refs, context

**Files:**
- Create: `buttons/ButtonRail.jsx`
- Modify: `index.html`

- [ ] **Step 1: Create `buttons/` directory and `ButtonRail.jsx`**

```jsx
// buttons/ButtonRail.jsx

const ButtonRailContext = React.createContext(null);

function useButtonRailSlot(edge) {
  const ctx = React.useContext(ButtonRailContext);
  // Re-render once when ButtonRail finishes mounting (refs populated)
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (ctx?.mounted && !ready) setReady(true);
  }, [ctx?.mounted]);
  if (!ctx?.mounted) return null;
  const map = { top: ctx.topRef, bottom: ctx.bottomRef, left: ctx.leftRef, right: ctx.rightRef };
  return map[edge]?.current || null;
}

function ButtonRail({ children }) {
  const topRef    = React.useRef(null);
  const bottomRef = React.useRef(null);
  const leftRef   = React.useRef(null);
  const rightRef  = React.useRef(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Inject CSS so empty edge slots collapse rather than taking up grid space
    const style = document.createElement('style');
    style.textContent = '.rail-edge:empty { display: none !important; }';
    document.head.appendChild(style);
    setMounted(true);
    return () => document.head.removeChild(style);
  }, []);

  const ctx = { topRef, bottomRef, leftRef, rightRef, mounted };

  const hEdge = (ref, area, borderProp) => ({
    ref,
    className: 'rail-edge',
    style: {
      gridArea: area,
      display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10,
      background: ZELDA.feltInner,
      [borderProp]: `1px solid ${ZELDA.goldDeep}`,
      padding: '0 12px', minHeight: 38,
    },
  });

  const vEdge = (ref, area, borderProp) => ({
    ref,
    className: 'rail-edge',
    style: {
      gridArea: area,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: ZELDA.feltInner,
      [borderProp]: `1px solid ${ZELDA.goldDeep}`,
      padding: '8px 0', minWidth: 38,
    },
  });

  return (
    <ButtonRailContext.Provider value={ctx}>
      <div style={{
        width: '100%', height: '100%',
        display: 'grid',
        gridTemplateAreas: '"top top top" "left content right" "bottom bottom bottom"',
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateColumns: 'auto 1fr auto',
      }}>
        <div {...hEdge(topRef,    'top',    'borderBottom')} />
        <div {...vEdge(leftRef,   'left',   'borderRight')} />
        <div style={{ gridArea: 'content', overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
        <div {...vEdge(rightRef,  'right',  'borderLeft')} />
        <div {...hEdge(bottomRef, 'bottom', 'borderTop')} />
      </div>
    </ButtonRailContext.Provider>
  );
}

Object.assign(window, { ButtonRail, useButtonRailSlot, ButtonRailContext });
```

- [ ] **Step 2: Add script tag to `index.html`**

Add before `<script type="text/babel" src="app.jsx">`:

```html
  <script type="text/babel" src="buttons/ButtonRail.jsx"></script>
```

- [ ] **Step 3: Manual smoke test**

Temporarily wrap `SubscreenTransition` in `ButtonRail` in `app.jsx`:
```jsx
<ButtonRail>
  <SubscreenTransition active={active}>
    ...
  </SubscreenTransition>
</ButtonRail>
```
Reload cockpit. Subscreen pane should look identical (no visible rail — all edges empty, all collapsed).  
Revert the App change after confirming — Task 5 does the permanent wiring.

- [ ] **Step 4: Commit**

```bash
git add buttons/ButtonRail.jsx index.html
git commit -m "feat: add ButtonRail CSS grid wrapper with slot context"
```

---

## Task 2: ServiceLights — health indicator dots

**Files:**
- Create: `buttons/ServiceLights.jsx`
- Modify: `index.html`

**Background:** `GET /api/health` returns `{ services: [{name, status, latency}], checked: ISO }`. Status values: `"ok"`, `"degraded"`, `"error"`. The endpoint already exists in `cockpit.py:112`.

- [ ] **Step 1: Create `buttons/ServiceLights.jsx`**

```jsx
// buttons/ServiceLights.jsx

const LIGHT = { ok: '#6c9a5a', degraded: '#d4a84a', error: '#c95a52' };

function ServiceLights() {
  const [services, setServices] = React.useState([]);
  const [lastChecked, setLastChecked]   = React.useState(null);
  const [tooltip, setTooltip]   = React.useState(null); // name of open tooltip

  React.useEffect(() => {
    const poll = () =>
      fetch('/api/health')
        .then(r => r.json())
        .then(d => { setServices(d.services || []); setLastChecked(d.checked); })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  // Close tooltip on click outside
  React.useEffect(() => {
    if (!tooltip) return;
    const close = (e) => {
      if (!e.target.closest('[data-svc-light]')) setTooltip(null);
    };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [tooltip]);

  const slot = useButtonRailSlot('bottom');
  if (!slot) return null;

  const content = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {services.map(svc => {
        const color = LIGHT[svc.status] || ZELDA.goldDim;
        const open  = tooltip === svc.name;
        return (
          <div
            key={svc.name}
            data-svc-light={svc.name}
            onClick={() => setTooltip(open ? null : svc.name)}
            style={{
              position: 'relative', cursor: 'pointer',
              width: 10, height: 10, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}, inset 0 0 3px rgba(0,0,0,.4)`,
              border: '1px solid rgba(0,0,0,.3)',
              flexShrink: 0,
            }}
          >
            {open && (
              <div style={{
                position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
                background: ZELDA.feltOuter, border: `1px solid ${ZELDA.goldDeep}`,
                color: ZELDA.parchText, fontFamily: ZELDA_FONT_PIXEL, fontSize: 11,
                padding: '6px 10px', whiteSpace: 'nowrap', zIndex: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,.6)',
                lineHeight: 1.6,
              }}>
                <div style={{ color: ZELDA.gold }}>{svc.name}</div>
                <div>{svc.latency}</div>
                <div style={{ color: ZELDA.parchTextDim, fontSize: 9 }}>
                  {lastChecked ? new Date(lastChecked).toLocaleTimeString() : '—'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return ReactDOM.createPortal(content, slot);
}

Object.assign(window, { ServiceLights });
```

- [ ] **Step 2: Add script tag to `index.html`**

After the ButtonRail script tag:
```html
  <script type="text/babel" src="buttons/ServiceLights.jsx"></script>
```

- [ ] **Step 3: Manual test**

With ButtonRail + ServiceLights rendered (App wired per Task 5 or temporary test wiring):
- 5–6 colored dots appear in the bottom rail, one per service
- Click a dot → tooltip shows service name, latency, timestamp
- Click anywhere outside → tooltip closes
- Wait 30s → dots update (or adjust interval temporarily to 5s to verify)

- [ ] **Step 4: Commit**

```bash
git add buttons/ServiceLights.jsx index.html
git commit -m "feat: add ServiceLights health indicator dots to bottom rail"
```

---

## Task 3: InboxField — capture input

**Files:**
- Create: `buttons/InboxField.jsx`
- Modify: `index.html`

**Background:** `POST /api/vault/append-inbox` takes `{ text: string }` and appends to `Inbox.md`. Already exists in `cockpit.py:177`. Returns `{ appended: true, inbox_entry }`.

- [ ] **Step 1: Create `buttons/InboxField.jsx`**

```jsx
// buttons/InboxField.jsx

function InboxField() {
  const [value, setValue]   = React.useState('');
  const [flash, setFlash]   = React.useState(false); // "✓" confirmation

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    fetch('/api/vault/append-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(r => r.json())
      .then(() => {
        setValue('');
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      })
      .catch(() => {});
  };

  const slot = useButtonRailSlot('bottom');
  if (!slot) return null;

  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 420 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') e.target.blur();
        }}
        placeholder="capture..."
        style={{
          flex: 1, background: 'rgba(0,0,0,.4)', border: `1px solid ${ZELDA.goldDeep}`,
          color: ZELDA.parchText, fontFamily: ZELDA_FONT_PIXEL, fontSize: 13,
          padding: '4px 10px', outline: 'none', height: 26,
        }}
        onFocus={e => { e.target.style.borderColor = ZELDA.gold; }}
        onBlur={e  => { e.target.style.borderColor = ZELDA.goldDeep; }}
      />
      {flash && (
        <span style={{ color: '#6c9a5a', fontFamily: ZELDA_FONT_PIXEL, fontSize: 14, lineHeight: 1 }}>
          ✓
        </span>
      )}
    </div>
  );

  return ReactDOM.createPortal(content, slot);
}

Object.assign(window, { InboxField });
```

- [ ] **Step 2: Add script tag to `index.html`**

After the ServiceLights script tag:
```html
  <script type="text/babel" src="buttons/InboxField.jsx"></script>
```

- [ ] **Step 3: Manual test**

- Input is visible in the bottom rail (centered, placeholder "capture...")
- Type text + Enter → field clears, green ✓ flashes briefly
- Verify entry appears in `Inbox.md`: `grep "capture" ~/Documents/Obsidian/Marlin/Inbox.md`
- Escape while typing → field blurs, number key navigation resumes

- [ ] **Step 4: Commit**

```bash
git add buttons/InboxField.jsx index.html
git commit -m "feat: add InboxField capture input to bottom rail"
```

---

## Task 4: TerminalButton + Spellbook popup

**Files:**
- Create: `buttons/TerminalButton.jsx`
- Modify: `index.html`

**Background:**  
- ttyd is at port 7682 (from `panels/terminal.jsx`)  
- Spellbook states: `minimized` (iframe hidden) | `quarter` (~40vw × ~28vh, bottom-right) | `half` (~50vw × ~48vh, bottom-right) | `full` (covers entire content pane)  
- Content pane viewport coordinates: top 120px, right 50px, bottom 74px, left 50px (derived from ZeldaFrame layout: outer div at top:102/right:32/bottom:56/left:32 + 3px border + 14px padding + 1px inner border)  
- Size controls: fixed overlay at bottom-right of content pane, z-index above Spellbook, visible whenever not minimized  
- Props: `{ open, size, onToggle, onSize }` — state lives in App (Task 5)

- [ ] **Step 1: Create `buttons/TerminalButton.jsx`**

```jsx
// buttons/TerminalButton.jsx
// Spellbook: ttyd popup with four display states.
// iframe stays in DOM always so terminal session never dies.

const SPELL_SIZES = ['quarter', 'half', 'full'];

function nextSize(s) {
  return SPELL_SIZES[(SPELL_SIZES.indexOf(s) + 1) % SPELL_SIZES.length];
}

// Viewport-coordinate boundaries of the ZeldaFrame content pane.
// Derived from ZeldaFrame: outer div top:102 left:32 right:32 bottom:56
// + 3px border + 14px padding + 1px inner border = 18px per edge
const FRAME = { top: 120, right: 50, bottom: 74, left: 50 };
const RAIL_H = 38; // bottom rail height — Spellbook quarter/half sit above it

function spellbookStyle(size) {
  const base = {
    position: 'fixed', zIndex: 1000,
    background: ZELDA.feltOuter,
    border: `2px solid ${ZELDA.goldDeep}`,
    boxShadow: `0 0 0 1px ${ZELDA.gold}, 0 8px 32px rgba(0,0,0,.7)`,
    overflow: 'hidden',
  };
  if (size === 'quarter') return { ...base, right: FRAME.right + 4, bottom: FRAME.bottom + RAIL_H + 4, width: '40vw', height: '28vh' };
  if (size === 'half')    return { ...base, right: FRAME.right + 4, bottom: FRAME.bottom + RAIL_H + 4, width: '50vw', height: '48vh' };
  // full — covers entire content pane including rail
  return { ...base, top: FRAME.top, left: FRAME.left, right: FRAME.right, bottom: FRAME.bottom };
}

function TerminalButton({ open, size, onToggle, onSize }) {
  const initialized = React.useRef(false);

  // Lazy-initialize iframe on first open
  if (open && !initialized.current) initialized.current = true;

  const slot = useButtonRailSlot('bottom');

  // Rail button
  const railBtn = slot ? ReactDOM.createPortal(
    <button
      onClick={onToggle}
      style={{
        background: open ? ZELDA.tabBgActive : ZELDA.tabBg,
        border: `1px solid ${open ? ZELDA.gold : ZELDA.goldDeep}`,
        color: open ? ZELDA.parchText : ZELDA.parchTextDim,
        fontFamily: ZELDA_FONT_PIXEL, fontSize: 13, letterSpacing: 1,
        padding: '3px 12px', cursor: 'pointer', height: 26,
        boxShadow: open ? `0 0 8px ${ZELDA.cursorGlow}` : 'none',
        transition: 'all 0.12s',
      }}
    >
      SPELL
    </button>,
    slot
  ) : null;

  // Spellbook iframe — always in DOM after first open, hidden when minimized
  const spellbook = initialized.current ? ReactDOM.createPortal(
    <div style={{ ...spellbookStyle(size), display: open ? 'block' : 'none' }}>
      <iframe
        src="http://localhost:7682"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Spellbook"
      />
    </div>,
    document.body
  ) : null;

  // Size controls — visible whenever open (not minimized)
  const ctrlBtnStyle = {
    background: ZELDA.tabBg, border: `1px solid ${ZELDA.goldDeep}`,
    color: ZELDA.parchTextDim, fontFamily: ZELDA_FONT_PIXEL, fontSize: 11,
    padding: '2px 8px', cursor: 'pointer',
    transition: 'all 0.1s',
  };

  const sizeLabel = { quarter: '¼', half: '½', full: '↗' };

  const controls = open ? ReactDOM.createPortal(
    <div style={{
      position: 'fixed', zIndex: 1002,
      right: FRAME.right + 8, bottom: FRAME.bottom + 8,
      display: 'flex', gap: 4, alignItems: 'center',
      background: ZELDA.feltOuter,
      border: `1px solid ${ZELDA.goldDeep}`,
      padding: '3px 6px',
      boxShadow: '0 2px 8px rgba(0,0,0,.5)',
    }}>
      <button
        onClick={() => onSize(nextSize(size))}
        style={ctrlBtnStyle}
        title={`Switch to ${nextSize(size)}`}
      >
        {sizeLabel[size]}
      </button>
      <button
        onClick={onToggle}
        style={{ ...ctrlBtnStyle, color: ZELDA.parchText }}
        title="Minimize Spellbook"
      >
        ×
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {railBtn}
      {spellbook}
      {controls}
    </>
  );
}

Object.assign(window, { TerminalButton, nextSize });
```

- [ ] **Step 2: Add script tag to `index.html`**

After the InboxField script tag:
```html
  <script type="text/babel" src="buttons/TerminalButton.jsx"></script>
```

- [ ] **Step 3: Commit (components only — App wiring is Task 5)**

```bash
git add buttons/TerminalButton.jsx index.html
git commit -m "feat: add TerminalButton and Spellbook popup component"
```

---

## Task 5: Wire into App

**Files:**
- Modify: `app.jsx`

This task does the permanent wiring: ButtonRail wraps SubscreenTransition, TerminalButton state + props, backtick handler.

- [ ] **Step 1: Add `terminalOpen` and `terminalSize` state to `App`**

In the `App()` function body, after existing state declarations:

```jsx
const [terminalOpen, setTerminalOpen] = React.useState(false);
const [terminalSize, setTerminalSize] = React.useState('quarter');
```

- [ ] **Step 2: Add backtick handler to the existing keydown `useEffect`**

Current guard block (around line 103):
```jsx
const tag = e.target.tagName;
if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
```

Immediately after that guard, before the `if (e.key === '1')` chain, add:
```jsx
if (e.key === '`') { setTerminalOpen(prev => !prev); return; }
```

Full updated keydown `useEffect` body (replace the existing one entirely):
```jsx
React.useEffect(() => {
  const handler = (e) => {
    if (e.key === 'Escape') {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
        ae.blur();
        e.preventDefault();
        return;
      }
      setEditMode(false);
      return;
    }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === '`') { setTerminalOpen(prev => !prev); return; }
    const idx = SUBSCREEN_IDS.indexOf(active);
    if (e.key === '1') setActive('quest');
    else if (e.key === '2') setActive('map');
    else if (e.key === '3') setActive('items');
    else if (e.key === '4') setActive('terminal');
    else if (e.key === '5') setActive('magic');
    else if (e.key === '6') setActive('ink');
    else if (e.key === '7') setActive('health');
    else if (e.key === 'ArrowRight' || e.key === ']') setActive(SUBSCREEN_IDS[Math.min(idx + 1, SUBSCREEN_IDS.length - 1)]);
    else if (e.key === 'ArrowLeft'  || e.key === '[') setActive(SUBSCREEN_IDS[Math.max(idx - 1, 0)]);
    else if (e.key === 'e') setEditMode(em => !em);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [active]);
```

Note: subscreen key numbers stay 1–7 until Task 6. Only backtick is added here.

- [ ] **Step 3: Wrap SubscreenTransition with ButtonRail and add button children**

Current render in `App` (lines 126–135):
```jsx
<SubscreenTransition active={active}>
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    ...subscreen divs...
  </div>
</SubscreenTransition>
```

Replace with:
```jsx
<ButtonRail>
  <SubscreenTransition active={active}>
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div key="quest"    style={{ position: 'absolute', inset: 0, display: show('quest') }}><QuestStatus /></div>
      <div key="map"      style={{ position: 'absolute', inset: 0, display: show('map') }}><MapScreen /></div>
      <div key="items"    style={{ position: 'absolute', inset: 0, display: show('items') }}><ItemsScreen arielFile={arielFile} setArielFile={setArielFile} setActive={setActive} /></div>
      <div key="terminal" style={{ position: 'absolute', inset: 0, display: show('terminal') }}><TerminalScreen /></div>
      <div key="magic"    style={{ position: 'absolute', inset: 0, display: show('magic') }}><MagicScreen /></div>
      <div key="ink"      style={{ position: 'absolute', inset: 0, display: show('ink') }}><InkScreen /></div>
      <div key="health"   style={{ position: 'absolute', inset: 0, display: show('health') }}><HealthScreen /></div>
    </div>
  </SubscreenTransition>
  <ServiceLights />
  <InboxField />
  <TerminalButton
    open={terminalOpen}
    size={terminalSize}
    onToggle={() => setTerminalOpen(prev => !prev)}
    onSize={setTerminalSize}
  />
</ButtonRail>
```

- [ ] **Step 4: Manual test — bottom rail**

Reload cockpit. Bottom rail should appear with:
- 6 colored service indicator dots (left side)
- "capture..." input field (center)
- "SPELL" button (right side, or wherever portal order falls)

- [ ] **Step 5: Manual test — Spellbook**

- Click SPELL button or press backtick → Spellbook iframe appears at bottom-right (~40% wide, ~28% tall)
- Size controls overlay visible in bottom-right of content pane
- Click ¼ → cycles to ½ (Spellbook grows)
- Click ½ → cycles to ↗ (Spellbook goes full, covers rail)
- Click × → Spellbook minimizes, session preserved (type something in terminal, minimize, reopen — text is still there)
- Type backtick again → Spellbook reopens at last used size
- Type in InboxField → backtick in that field does NOT trigger Spellbook (guard works)

- [ ] **Step 6: Commit**

```bash
git add app.jsx
git commit -m "feat: wire ButtonRail into App with Spellbook state and backtick toggle"
```

---

## Task 6: Remove terminal + magic subscreens

> **⚠️ STOP — switch to a plain terminal window before starting this task.**  
> You are currently using MagicScreen as your terminal launcher. Once Task 5 is verified and Spellbook (backtick) works, open a new plain terminal and continue from there. This task makes MagicScreen and TerminalScreen no longer reachable.

**Files:**
- Modify: `app.jsx`
- Modify: `zelda-frame.jsx`
- Modify: `subscreen-transition.jsx`
- Modify: `index.html`

- [ ] **Step 1: Update `app.jsx` — remove SUBSCREEN_IDS entries and screen components**

Change line 1:
```jsx
const SUBSCREEN_IDS = ['quest', 'map', 'items', 'ink', 'health'];
```

Change default active state from `'terminal'` to `'quest'`:
```jsx
const [active, setActive] = React.useState('quest');
```

Update key bindings in the keydown handler (replace the 1–7 block):
```jsx
if (e.key === '1') setActive('quest');
else if (e.key === '2') setActive('map');
else if (e.key === '3') setActive('items');
else if (e.key === '4') setActive('ink');
else if (e.key === '5') setActive('health');
```

Remove these two components from app.jsx entirely:
```jsx
// DELETE: const TerminalScreen = () => ( <TerminalPanel /> );
// DELETE: const MAGIC_LAUNCHERS = [...];
// DELETE: const MagicScreen = () => ( ... );
```

Remove these two divs from the `ButtonRail > SubscreenTransition > div` block:
```jsx
// DELETE: <div key="terminal" style={{ ... }}><TerminalScreen /></div>
// DELETE: <div key="magic" style={{ ... }}><MagicScreen /></div>
```

- [ ] **Step 2: Update `zelda-frame.jsx` — remove terminal/magic tabs, add backtick hint**

In the `SUBS` array (lines 21–29), replace the 7-entry array with:
```jsx
const SUBS = [
  { id: 'quest',  fallback: 'Quest Status',  s: 's1', hotkey: '1' },
  { id: 'map',    fallback: 'Map',           s: 's2', hotkey: '2' },
  { id: 'items',  fallback: 'Items',         s: 's3', hotkey: '3' },
  { id: 'ink',    fallback: 'Ink Blotter',   s: 's4', hotkey: '4' },
  { id: 'health', fallback: 'Health',        s: 's5', hotkey: '5' },
];
```

In the bottom keyboard hint block (lines 148–152), add the backtick hint:
```jsx
<div style={{ color: ZELDA.parchTextDim, fontFamily: ZELDA_FONT_PIXEL, fontSize: 12, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 10 }}>
  <span><kbd style={kbdS}>1</kbd>–<kbd style={kbdS}>{SUBS.length}</kbd> screen</span>
  <span><kbd style={kbdS}>L</kbd>/<kbd style={kbdS}>R</kbd> tab</span>
  <span><kbd style={kbdS}>e</kbd> edit</span>
  <span><kbd style={kbdS}>`</kbd> spell</span>
</div>
```

- [ ] **Step 3: Update `subscreen-transition.jsx` — extend SUBSCREEN_ORDER**

Line 4, replace:
```jsx
const SUBSCREEN_ORDER = ['quest', 'map', 'items', 'ink', 'health'];
```

(This ensures directional slide animation works for ink and health tabs.)

- [ ] **Step 4: Update `index.html` — remove terminal panel script tag**

Remove this line:
```html
<script type="text/babel" src="panels/terminal.jsx"></script>
```

`panels/terminal.jsx` is no longer referenced. Keep the file — no need to delete it.

- [ ] **Step 5: Manual test — full regression**

- Reload cockpit. Five tabs visible (Quest, Map, Items, Ink Blotter, Health). Keys 1–5 navigate. No terminal or magic tabs.
- Backtick opens Spellbook (the only terminal now)
- Arrow keys / [ ] navigate between 5 tabs correctly
- Bottom rail: service lights, inbox field, SPELL button all present
- Keyboard hint in ZeldaFrame footer shows `` ` spell ``

- [ ] **Step 6: Commit**

```bash
git add app.jsx zelda-frame.jsx subscreen-transition.jsx index.html
git commit -m "feat: remove terminal + magic subscreens, Spellbook is now the only terminal"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] ButtonRail CSS grid with 5 named areas → Task 1
- [x] Self-registration via context (portal slots) → Task 1
- [x] Empty edges collapse → Task 1 (CSS `:empty`)
- [x] ServiceLights: 30s poll, 3 states, click tooltip → Task 2
- [x] InboxField: Enter submit, Escape blur, ✓ flash → Task 3
- [x] TerminalButton: bottom rail, Minimized/Quarter/Half/Full → Task 4
- [x] Spellbook iframe always in DOM, `display:none` when minimized → Task 4
- [x] Size controls: fixed bottom-right overlay, independent of Spellbook size → Task 4
- [x] Cycle button: Quarter→Half→Full→Quarter → Task 4
- [x] Close/minimize button → Task 4
- [x] Backtick guard (no INPUT/TEXTAREA/contentEditable focus) → Task 5
- [x] Backtick: Minimized ↔ last used size → Task 5 (toggle uses `terminalOpen`, size preserved separately)
- [x] Remove terminal + magic subscreens → Task 6
- [x] ZELDA token palette used throughout → all tasks
- [x] Backtick hint added to ZeldaFrame footer → Task 6
- [x] SubscreenTransition SUBSCREEN_ORDER updated → Task 6

**Placeholder scan:** None found.

**Type consistency:** `terminalOpen: boolean`, `terminalSize: 'quarter'|'half'|'full'`. Used consistently across App (Task 5) and TerminalButton (Task 4). `nextSize` function uses the same `SPELL_SIZES` array. `useButtonRailSlot(edge)` returns `HTMLElement | null` in both TaskB 2, 3, 4.
