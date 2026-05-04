// panels/ariel.jsx — Sub-screen 3 right: Ariel chat (STUBBED)
// Polls :8742 every 5s. Shows "Bazza offline" on error.
// Full implementation requires Ariel API audit.

function ArielPanel({ onCiteFile }) {
  const { data, error } = usePoll(fetchArielTurns, 5000);
  const [input, setInput] = React.useState('');

  const turns = data || [];
  const offline = !!error;

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <E path="panel.ariel" fallback="Ariel" style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}/>
        {offline && <span style={{ fontSize: 9, color: '#c95a52' }}>Bazza offline</span>}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {turns.length === 0 && (
          <div style={{ color: '#5a5249', paddingTop: 8 }}>
            {offline ? 'Bazza is unreachable — Ariel unavailable' : 'no conversation yet'}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={t.id || i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#5a5249', marginBottom: 2 }}>{t.role} · {t.time}</div>
            <div style={{ color: t.role === 'ariel' ? '#9a9286' : '#e8e3d8', lineHeight: 1.5 }}>{t.text}</div>
            {t.file && <button onClick={() => onCiteFile && onCiteFile(t.file)} style={{ background: 'none', border: 'none', color: '#c96442', fontSize: 9, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>↗ open in vault</button>}
          </div>
        ))}
      </div>
      {/* Composer — stubbed, POST endpoint TBD */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1d1a16', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          placeholder={offline ? 'Bazza offline' : 'ask Ariel…'}
          disabled={offline}
          style={{ flex: 1, background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
        />
        <button disabled={offline || !input.trim()} style={{ background: '#2a2520', border: '1px solid #3a342d', borderRadius: 3, padding: '6px 12px', color: '#9a9286', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          send
        </button>
      </div>
    </div>
  );
}
