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

function spellbookStyle(size, p) {
  const base = {
    position: 'fixed', zIndex: 1000,
    background: p.feltOuter,
    border: `2px solid ${p.goldDeep}`,
    boxShadow: `0 0 0 1px ${p.gold}, 0 8px 32px rgba(0,0,0,.7)`,
    overflow: 'hidden',
  };
  if (size === 'quarter') return { ...base, right: FRAME.right + 4, bottom: FRAME.bottom + RAIL_H + 4, width: '40vw', height: '28vh' };
  if (size === 'half')    return { ...base, right: FRAME.right + 4, bottom: FRAME.bottom + RAIL_H + 4, width: '50vw', height: '48vh' };
  // full — covers entire content pane including rail
  return { ...base, top: FRAME.top, left: FRAME.left, right: FRAME.right, bottom: FRAME.bottom };
}

function TerminalButton({ open, size, onToggle, onSize, ttydPort }) {
  const { theme } = useTheme();
  const p = theme.palette;
  const initialized = React.useRef(false);

  // Lazy-initialize iframe on first open — but only once the operator's port is
  // known, so the session can never be opened against a guessed port.
  if (open && ttydPort && !initialized.current) initialized.current = true;

  const slot = useButtonRailSlot('bottom');

  // Rail button
  const railBtn = slot ? ReactDOM.createPortal(
    <button
      onClick={onToggle}
      disabled={!ttydPort}
      title={ttydPort ? 'Spellbook' : 'Resolving operator…'}
      style={{
        order: 3,
        background: open ? p.tabBgActive : p.tabBg,
        border: `1px solid ${open ? p.gold : p.goldDeep}`,
        color: open ? p.parchText : p.parchTextDim,
        fontFamily: theme.fonts.pixel, fontSize: 13, letterSpacing: 1,
        padding: '3px 12px', cursor: ttydPort ? 'pointer' : 'wait', height: 26,
        opacity: ttydPort ? 1 : 0.5,
        boxShadow: open ? `0 0 8px ${p.cursorGlow}` : 'none',
        transition: 'all 0.12s',
      }}
    >
      SPELL
    </button>,
    slot
  ) : null;

  // Spellbook iframe — always in DOM after first open, hidden when minimized
  const spellbook = initialized.current && ttydPort ? ReactDOM.createPortal(
    <div style={{ ...spellbookStyle(size, p), display: open ? 'block' : 'none' }}>
      <iframe
        src={`http://localhost:${ttydPort}`}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Spellbook"
      />
    </div>,
    document.body
  ) : null;

  // Size controls — visible whenever open (not minimized)
  const ctrlBtnStyle = {
    background: p.tabBg, border: `1px solid ${p.goldDeep}`,
    color: p.parchTextDim, fontFamily: theme.fonts.pixel, fontSize: 11,
    padding: '2px 8px', cursor: 'pointer',
    transition: 'all 0.1s',
  };

  const sizeLabel = { quarter: '¼', half: '½', full: '↗' };

  const controls = open ? ReactDOM.createPortal(
    <div style={{
      position: 'fixed', zIndex: 1002,
      right: FRAME.right + 8, bottom: FRAME.bottom + 8,
      display: 'flex', gap: 4, alignItems: 'center',
      background: p.feltOuter,
      border: `1px solid ${p.goldDeep}`,
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
        style={{ ...ctrlBtnStyle, color: p.parchText }}
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
