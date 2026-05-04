// panels/ttf.jsx — Sub-screen 2 main: TTF balloon timeline (STUBBED)
// Requires Claude Design handoff for balloon layout before full implementation.
// Stub: shows event list with title + time.

function TtfPanel() {
  const { data, error } = usePoll(fetchTtfEvents, 30000);
  const events = data || [];

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <E path="panel.ttf" fallback="Time Factory" style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}/>
        <span style={{ fontSize: 9, color: '#5a5249' }}>balloon design pending{error ? ' · ⚠ unreachable' : ''}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {events.map((ev, i) => (
          <div key={ev.id || i} style={{ padding: '6px 0', borderBottom: '1px solid #1d1a16' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9a9286' }}>{ev.title}</span>
              <span style={{ color: '#5a5249', fontSize: 10 }}>{ev.date}{ev.start_time ? ` ${ev.start_time}` : ''}</span>
            </div>
          </div>
        ))}
        {events.length === 0 && !error && <div style={{ color: '#5a5249' }}>no events this week</div>}
      </div>
    </div>
  );
}
