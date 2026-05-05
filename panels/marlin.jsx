// panels/marlin.jsx — Sub-screen 1 right: current task + today's tasks
const MODE_COLORS = {
  'available': '#6c9a5a', 'deep-work': '#c95a52',
  'transit': '#d4a84a', 'relaxing': '#5fa0a8', 'sleeping': '#6b8ec8',
};

function MarlinPanel() {
  const { data: stateData, error: stateErr } = usePoll(fetchState, 30000);
  const { data: todayRaw, error: todayErr }  = usePoll(fetchTodayTasks, 30000);

  const mode       = stateData?.mode || 'available';
  const modeColor  = MODE_COLORS[mode] || '#9a9286';
  const current    = stateData?.last_surfaced_task || '—';
  const todayGroups = todayRaw || [];
  const allTasks   = todayGroups.flatMap(g => g.tasks || []);
  const error      = stateErr || todayErr;

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <E path="panel.marlin" fallback="Marlin"/>
        </span>
        <span style={{ fontSize: 10, color: modeColor }}>{mode}{error ? ' · ⚠' : ''}</span>
      </div>
      {/* Current task hero */}
      <div style={{ padding: '12px 16px', borderBottom: '2px solid #1d1a16', borderLeft: `3px solid ${modeColor}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>now surfaced</div>
        <div style={{ fontSize: 12, color: '#e8e3d8', lineHeight: 1.4 }}>{current}</div>
      </div>
      {/* Today's tasks */}
      <div className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        <div style={{ fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>today</div>
        {allTasks.map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1d1a16' }}>
            <span style={{ color: '#9a9286', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.title}</span>
            {t.duration && <span style={{ color: '#5a5249', fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{t.duration}</span>}
          </div>
        ))}
        {allTasks.length === 0 && <div style={{ color: '#5a5249' }}>no tasks today</div>}
      </div>
    </div>
  );
}
