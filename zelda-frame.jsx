// zelda-frame.jsx — Ocarina of Time pause-menu chrome (editable labels)
//
// Sub-screen tab labels and screen titles route through LabelsContext.

const ZELDA = {
  feltOuter: '#0d2a1f', feltInner: '#0a1f17',
  gold: '#d4b76a', goldDim: '#8a7a3e', goldDeep: '#5a4d24', goldHighlight: '#f0e0a0',
  tabBg: '#1a3a2c', tabBgActive: '#2a5040',
  cursor: '#ffe66a', cursorGlow: 'rgba(255, 230, 100, 0.5)',
  parchText: '#f4e8c8', parchTextDim: '#c8b896',
};

const ZELDA_FONT_DISPLAY = '"Cinzel", "Trajan Pro", "Cormorant Garamond", serif';
const ZELDA_FONT_PIXEL = '"VT323", "Press Start 2P", "Courier New", monospace';

const MODE_COLORS = {
  'available': '#6c9a5a', 'deep-work': '#c95a52',
  'transit': '#d4a84a', 'relaxing': '#5fa0a8', 'sleeping': '#6b8ec8',
};

const SUBS = [
  { id: 'quest',    fallback: 'Quest Status',  s: 's1', hotkey: '1' },
  { id: 'map',      fallback: 'Map',           s: 's2', hotkey: '2' },
  { id: 'items',    fallback: 'Items',         s: 's3', hotkey: '3' },
  { id: 'terminal', fallback: 'Magic',         s: 's4', hotkey: '4' },
  { id: 'magic',    fallback: 'Summons',       s: 's5', hotkey: '5' },
  { id: 'ink',      fallback: 'Ink Blotter',   s: 's6', hotkey: '6' },
];

function CornerFlourish({ rotation = 0, size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ transform: `rotate(${rotation}deg)`, display: 'block' }}>
      <defs>
        <linearGradient id={`zgold-${rotation}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ZELDA.goldHighlight}/>
          <stop offset="0.5" stopColor={ZELDA.gold}/>
          <stop offset="1" stopColor={ZELDA.goldDeep}/>
        </linearGradient>
      </defs>
      <path d="M 0 4 L 30 4 L 30 8 L 8 8 L 8 30 L 4 30 L 4 8 Z" fill={`url(#zgold-${rotation})`} stroke={ZELDA.goldDeep} strokeWidth="0.5"/>
      <path d="M 12 12 Q 14 10 16 12 Q 14 14 12 12 Z" fill={ZELDA.gold} opacity="0.8"/>
      <circle cx="14" cy="14" r="1.5" fill={ZELDA.goldHighlight}/>
      <circle cx="6" cy="6" r="1.2" fill={ZELDA.goldHighlight}/>
    </svg>
  );
}

function SubScreenTab({ tabId, fallbackLabel, active, onClick, hotkey }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        background: active ? ZELDA.tabBgActive : ZELDA.tabBg,
        border: `2px solid ${active ? ZELDA.cursor : ZELDA.goldDeep}`,
        borderBottom: active ? `2px solid ${ZELDA.tabBgActive}` : `2px solid ${ZELDA.goldDeep}`,
        color: active ? ZELDA.parchText : ZELDA.parchTextDim,
        fontFamily: ZELDA_FONT_DISPLAY,
        fontSize: 13, letterSpacing: 2.5, textTransform: 'uppercase',
        padding: '8px 22px 10px', cursor: 'pointer', marginBottom: -2,
        boxShadow: active ? `0 0 12px ${ZELDA.cursorGlow}, inset 0 0 12px rgba(0,0,0,.3)` : 'inset 0 -4px 8px rgba(0,0,0,.4)',
        transition: 'all 0.15s', fontWeight: active ? 600 : 400,
      }}
    >
      <E path={`subscreen.${tabId}`} fallback={fallbackLabel} style={{}}/>
      {hotkey && (
        <span style={{
          position: 'absolute', top: -8, right: -6,
          background: ZELDA.gold, color: ZELDA.feltOuter,
          fontSize: 9, fontWeight: 700, fontFamily: ZELDA_FONT_PIXEL,
          padding: '1px 5px', borderRadius: 2, border: `1px solid ${ZELDA.goldDeep}`,
        }}>{hotkey}</span>
      )}
    </button>
  );
}

function ShoulderHint({ side, tabId, fallbackLabel }) {
  const isL = side === 'L';
  const chip = (
    <div style={{
      background: ZELDA.gold, color: ZELDA.feltOuter,
      padding: '2px 8px', borderRadius: 8, fontWeight: 700, fontSize: 10, letterSpacing: 1,
      border: `1px solid ${ZELDA.goldDeep}`,
    }}>{side}</div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ZELDA.parchTextDim, fontFamily: ZELDA_FONT_DISPLAY, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
      {isL && chip}
      <E path={`subscreen.${tabId}`} fallback={fallbackLabel} style={{}}/>
      {!isL && chip}
    </div>
  );
}

const kbdS = {
  background: ZELDA.gold, color: ZELDA.feltOuter,
  padding: '1px 5px', borderRadius: 2, fontSize: 10,
  fontFamily: ZELDA_FONT_PIXEL, fontWeight: 700, border: `1px solid ${ZELDA.goldDeep}`,
};

function ZeldaFrame({ activeSubscreen, onSubscreenChange, mode, children }) {
  const idx = SUBS.findIndex(s => s.id === activeSubscreen);
  const safeIdx = idx === -1 ? 0 : idx;
  const prev = SUBS[(safeIdx - 1 + SUBS.length) % SUBS.length];
  const next = SUBS[(safeIdx + 1) % SUBS.length];
  const cur = SUBS[safeIdx];

  const modeColor = MODE_COLORS[mode] || ZELDA.gold;

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative',
      background: `radial-gradient(ellipse at 30% 20%, ${ZELDA.feltOuter} 0%, ${ZELDA.feltInner} 60%, #050d09 100%)`,
      fontFamily: ZELDA_FONT_DISPLAY, overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.25, pointerEvents: 'none', backgroundImage: `radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px)`, backgroundSize: '3px 3px' }}/>
      <div style={{ position: 'relative', height: 52, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ color: ZELDA.parchText, fontSize: 22, letterSpacing: 6, textTransform: 'uppercase', fontWeight: 500, textShadow: `0 0 8px rgba(0,0,0,.6), 0 0 1px ${ZELDA.gold}` }}>
          <E path={`subscreen.${cur.id}`} fallback={cur.fallback} style={{}}/>
        </div>
      </div>
      <div style={{ position: 'relative', padding: '0 56px', display: 'flex', justifyContent: 'center', gap: 6, zIndex: 2 }}>
        {SUBS.map((s, i) => (
          <SubScreenTab key={s.id} tabId={s.id} fallbackLabel={s.fallback} active={s.id === activeSubscreen} onClick={() => onSubscreenChange(s.id)} hotkey={i + 1}/>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 102, left: 32, right: 32, bottom: 56, background: ZELDA.feltInner, border: `3px solid ${ZELDA.goldDeep}`, boxShadow: `0 0 0 1px ${ZELDA.gold}, inset 0 0 24px rgba(0,0,0,.6), 0 8px 32px rgba(0,0,0,.5)`, padding: 14, zIndex: 1 }}>
        <div style={{ position: 'absolute', top: -4, left: -4, zIndex: 2 }}><CornerFlourish rotation={0}/></div>
        <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}><CornerFlourish rotation={90}/></div>
        <div style={{ position: 'absolute', bottom: -4, right: -4, zIndex: 2 }}><CornerFlourish rotation={180}/></div>
        <div style={{ position: 'absolute', bottom: -4, left: -4, zIndex: 2 }}><CornerFlourish rotation={270}/></div>
        <div style={{ width: '100%', height: '100%', background: '#000', border: `1px solid ${ZELDA.goldDim}`, boxShadow: 'inset 0 0 0 2px #000, inset 0 0 16px rgba(0,0,0,.8)', overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(0,0,0,.4)', border: `1px solid ${modeColor}`, color: ZELDA.parchText, fontFamily: ZELDA_FONT_PIXEL, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          <span style={{ width: 7, height: 7, borderRadius: 7, background: modeColor, boxShadow: `0 0 8px ${modeColor}` }}/>
          <span>{mode || 'available'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SUBS.map((s) => (
            <div key={s.id} style={{ width: 8, height: 8, borderRadius: 8, background: s.id === activeSubscreen ? ZELDA.cursor : ZELDA.goldDeep, boxShadow: s.id === activeSubscreen ? `0 0 8px ${ZELDA.cursorGlow}` : 'none' }}/>
          ))}
        </div>
        <div style={{ color: ZELDA.parchTextDim, fontFamily: ZELDA_FONT_PIXEL, fontSize: 12, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span><kbd style={kbdS}>1</kbd>–<kbd style={kbdS}>{SUBS.length}</kbd> screen</span>
          <span><kbd style={kbdS}>L</kbd>/<kbd style={kbdS}>R</kbd> tab</span>
          <span><kbd style={kbdS}>e</kbd> edit</span>
        </div>
      </div>
    </div>
  );
}

function SplitTwo({ left, right, leftFlex = 1, rightFlex = 1 }) {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: leftFlex, minWidth: 0, display: 'flex' }}>{left}</div>
      <div style={{ width: 1, background: ZELDA.goldDeep, opacity: 0.5 }}/>
      <div style={{ flex: rightFlex, minWidth: 0, display: 'flex' }}>{right}</div>
    </div>
  );
}

function SplitMainRail({ main, rail, railWidth = 280, railSide = 'right' }) {
  if (railSide === 'left') {
    return (
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        <div style={{ width: railWidth, flexShrink: 0, display: 'flex' }}>{rail}</div>
        <div style={{ width: 1, background: ZELDA.goldDeep, opacity: 0.5 }}/>
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{main}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{main}</div>
      <div style={{ width: 1, background: ZELDA.goldDeep, opacity: 0.5 }}/>
      <div style={{ width: railWidth, flexShrink: 0, display: 'flex' }}>{rail}</div>
    </div>
  );
}

Object.assign(window, { ZeldaFrame, SplitTwo, SplitMainRail, ZELDA, ZELDA_FONT_DISPLAY, ZELDA_FONT_PIXEL });
