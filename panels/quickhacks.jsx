// panels/quickhacks.jsx — Sub-screen 2 rail: mode switcher + ADLs

const QH_MODES = [
  { id: 'available', label: 'available', color: '#6c9a5a' },
  { id: 'deep-work', label: 'deep work', color: '#c95a52' },
  { id: 'transit',   label: 'transit',   color: '#d4a84a' },
  { id: 'relaxing',  label: 'relaxing',  color: '#5fa0a8' },
  { id: 'sleeping',  label: 'sleeping',  color: '#6b8ec8' },
];

function setMode(id) {
  fetch(`${HOSTS.marlin}/mode?set=${id}`, { redirect: 'manual' }).catch(() => {});
  window.dispatchEvent(new CustomEvent('cockpit:mode-switch', { detail: { mode: id } }));
}

function QuickhacksPanel() {
  const { data: stateData } = usePoll(fetchState, 30000);
  const { data: adlsData }  = usePoll(fetchAdls,  30000);

  const currentMode = stateData?.mode || 'available';
  const [localAdls, setLocalAdls] = React.useState(null);
  const displayAdls = localAdls ?? adlsData ?? [];

  const handleAdlDone = React.useCallback((title) => {
    markAdlDone(title);
    setLocalAdls(prev => (prev ?? adlsData ?? []).filter(a => a.title !== title));
  }, [adlsData]);

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0 }}>
        <E path="panel.quickhacks" fallback="Quickhacks" style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}/>
      </div>
      {/* Modes */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        {QH_MODES.map(m => {
          const active = m.id === currentMode;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: active ? `${m.color}18` : 'transparent',
              border: `1px solid ${active ? m.color : '#2a2520'}`, borderRadius: 3, color: active ? m.color : '#5a5249',
              padding: '5px 10px', marginBottom: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>{m.label}</button>
          );
        })}
      </div>
      {/* ADLs */}
      {displayAdls.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 8px', borderTop: '1px solid #1d1a16' }}>
          <div style={{ fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 6px' }}>ADLs due</div>
          {displayAdls.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9a9286' }}>{a.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {a.start_time && <span style={{ color: '#5a5249', fontSize: 10 }}>{a.start_time}</span>}
                <button
                  onClick={() => handleAdlDone(a.title)}
                  style={{ background: 'transparent', border: '1px solid #2a5040', color: '#6c9a5a', borderRadius: 2, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                >✓</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
