// panels/ariel.jsx — Ariel chat panel. POST /chat, local turn history.

function ArielPanel({ onCiteFile }) {
  const [online, setOnline] = React.useState(null);  // null=checking, true, false
  const [turns, setTurns] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [activity, setActivity] = React.useState(null);  // { inferring, elapsed }
  const scrollRef = React.useRef(null);
  const startRef = React.useRef(null);

  // Health check on mount and every 30s
  React.useEffect(() => {
    const check = () =>
      fetch(`${HOSTS.ariel}/health`)
        .then(r => setOnline(r.ok))
        .catch(() => setOnline(false));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  // Activity polling while loading — hits /status every 2s
  React.useEffect(() => {
    if (!loading) { setActivity(null); return; }
    startRef.current = Date.now();
    const poll = () => {
      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      fetch(`${HOSTS.ariel}/status`)
        .then(r => r.json())
        .then(d => setActivity({ inferring: d.inference_in_progress, elapsed }))
        .catch(() => setActivity(prev => ({ inferring: false, elapsed: Math.round((Date.now() - startRef.current) / 1000) })));
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [loading]);

  // Auto-scroll to bottom on new content
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, loading]);

  const timeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const send = React.useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setTurns(prev => [...prev, { role: 'user', time: timeStr(), text: msg }]);
    setLoading(true);
    try {
      const data = await fetch(`${HOSTS.ariel}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      }).then(r => r.json());
      const text = data.response || data.error || 'no response';
      const ms = data.response_ms;
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text, ms }]);
    } catch (e) {
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text: `[error: ${e.message}]` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const onKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  const offline = online === false;
  const checking = online === null;

  const activityLabel = () => {
    if (!activity) return 'working…';
    const t = `${activity.elapsed}s`;
    return activity.inferring ? `generating… ${t}` : `processing… ${t}`;
  };

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <E path="panel.ariel" fallback="Ariel" style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}/>
        <span style={{ fontSize: 9, color: offline ? '#c95a52' : loading ? '#d4a84a' : checking ? '#5a5249' : '#6c9a5a' }}>
          {offline ? 'offline' : loading ? activityLabel() : checking ? 'connecting…' : 'online'}
        </span>
      </div>
      <div ref={scrollRef} className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {turns.length === 0 && !loading && (
          <div style={{ color: '#5a5249', paddingTop: 8 }}>
            {offline ? 'Ariel is unreachable' : 'no conversation yet'}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#5a5249', marginBottom: 2 }}>
              {t.role} · {t.time}
              {t.ms && <span style={{ marginLeft: 6 }}>{(t.ms / 1000).toFixed(1)}s</span>}
            </div>
            <div style={{ color: t.role === 'ariel' ? '#9a9286' : '#e8e3d8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.text}</div>
            {t.file && (
              <button onClick={() => onCiteFile && onCiteFile(t.file)} style={{ background: 'none', border: 'none', color: '#c96442', fontSize: 9, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>↗ open in vault</button>
            )}
          </div>
        ))}
        {loading && <div style={{ color: '#5a5249', fontStyle: 'italic' }}>Ariel is thinking…</div>}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1d1a16', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={offline ? 'Ariel offline' : loading ? 'waiting for response…' : 'ask Ariel…'}
          disabled={offline || loading}
          style={{ flex: 1, background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          onClick={send}
          disabled={offline || loading || !input.trim()}
          style={{ background: '#2a2520', border: '1px solid #3a342d', borderRadius: 3, padding: '6px 12px', color: loading ? '#5a5249' : '#9a9286', cursor: offline || loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}
        >
          {loading ? '…' : 'send'}
        </button>
      </div>
    </div>
  );
}
