// Shared TTF nav bar — small floating control to step the inspection day.
// Sits inside each variant; styled per-variant accent passed in.
function TtfNavBar({ ctrl, accent, label }) {
  const { theme } = useTheme();
  const p = theme.palette;
  const H = window.TTF_helpers;
  const off = ctrl.centerOffset;

  // Resolve current center date string for display
  const today = H.todayStr();
  const d = H.parseDate(today);
  d.setDate(d.getDate() + off);
  const dateStr = d.toLocaleDateString('en-US',
    { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  const isToday = off === 0;

  const btn = {
    background: 'rgba(0,0,0,0.55)',
    color: accent,
    border: `1px solid ${accent}`,
    fontFamily: theme.fonts.pixel,
    fontSize: 14, lineHeight: 1,
    width: 26, height: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    letterSpacing: 1,
  };

  return (
    <div style={{
      position: 'absolute', top: 6, right: 6, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 4,
      fontFamily: theme.fonts.pixel, fontSize: 10,
      pointerEvents: 'auto',
    }}>
      <button style={btn} onClick={() => ctrl.advance(-1)} title="previous day">‹</button>
      <div style={{
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${accent}`,
        color: isToday ? '#ffffff' : accent,
        padding: '4px 10px',
        letterSpacing: 1.5,
        minWidth: 110, textAlign: 'center',
        boxShadow: isToday ? `0 0 8px ${accent}55` : 'none',
      }}>{isToday ? '◆ TODAY' : dateStr}</div>
      <button style={btn} onClick={() => ctrl.advance(1)} title="next day">›</button>
      {!isToday && (
        <button style={{ ...btn, width: 'auto', padding: '0 8px', fontSize: 9 }}
                onClick={() => ctrl.warpTo(0)} title="jump to today">↻</button>
      )}
    </div>
  );
}

window.TtfNavBar = TtfNavBar;
