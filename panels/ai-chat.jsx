// panels/ai-chat.jsx — AI chat via LMF orchestrator (vault context + tools)

const AI_NAME = window.APP_CONFIG?.aiName || 'Ariel';
const ORCHESTRATOR_URL = 'http://localhost:8002';

function AiChatPanel({ onCiteFile }) {
  const [turns, setTurns] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [turbo, setTurbo] = React.useState(false);
  const [orchStatus, setOrchStatus] = React.useState('checking');
  const scrollRef = React.useRef(null);
  const startRef = React.useRef(null);

  // Check orchestrator status on mount
  React.useEffect(() => {
    fetch(`${ORCHESTRATOR_URL}/status`)
      .then(r => r.json())
      .then(data => {
        setOrchStatus(data.orchestrator === 'ok' ? 'ok' : 'error');
        setTurbo(data.turbo_mode || false);
      })
      .catch(() => setOrchStatus('unreachable'));
  }, []);

  React.useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [loading]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, loading]);

  const timeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const send = React.useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading || orchStatus === 'unreachable') return;
    setInput('');
    setTurns(prev => [...prev, { role: 'user', time: timeStr(), text: msg }]);
    setLoading(true);
    try {
      const resp = await fetch(`${ORCHESTRATOR_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, timeout_s: 300 }),
      });
      if (!resp.ok) throw new Error(`orchestrator error: ${resp.status}`);
      const data = await resp.json();
      const text = data.response || 'no response';
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text }]);
    } catch (e) {
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text: `[error: ${e.message}]` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, orchStatus]);

  const onKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  const toggleTurbo = React.useCallback(async () => {
    try {
      const resp = await fetch(`${ORCHESTRATOR_URL}/turbo`, { method: 'POST' });
      const data = await resp.json();
      setTurbo(data.turbo);
    } catch {
      setTurbo(t => !t);
    }
  }, []);

  const statusColor = () => {
    if (orchStatus === 'unreachable') return '#c95a52';
    if (loading) return '#d4a84a';
    return '#6c9a5a';
  };

  const statusText = () => {
    if (orchStatus === 'unreachable') return 'orchestrator unreachable';
    if (loading) return `working… ${elapsed}s`;
    return 'connected';
  };

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>{AI_NAME}</span>
          <span style={{ fontSize: 9, color: '#5a5249' }}>via orchestrator</span>
          <button onClick={toggleTurbo} title={turbo ? 'Disable turbo (pacing ON)' : 'Enable turbo (remove pacing delay)'} style={{ background: turbo ? '#5a4d24' : '#16130f', border: `1px solid ${turbo ? '#d4b76a' : '#2a2520'}`, borderRadius: 3, padding: '2px 8px', color: turbo ? '#d4b76a' : '#5a5249', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: 0.5 }}>
            {turbo ? '⚡TURBO' : 'pacing'}
          </button>
        </div>
        <span style={{ fontSize: 9, color: statusColor() }}>{statusText()}</span>
      </div>
      <div ref={scrollRef} className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {orchStatus === 'unreachable' && (
          <div style={{ color: '#5a5249', paddingTop: 8 }}>
            <p>Orchestrator not reachable at {ORCHESTRATOR_URL}</p>
            <p style={{ fontSize: 10 }}>Start it with the rest of the LMF stack.</p>
          </div>
        )}
        {turns.length === 0 && orchStatus !== 'unreachable' && !loading && <div style={{ color: '#5a5249', paddingTop: 8 }}>connected to orchestrator — ask anything about your vault</div>}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#5a5249', marginBottom: 2 }}>
              {t.role === 'ariel' ? AI_NAME.toLowerCase() : 'operator'} · {t.time}
            </div>
            <div style={{ color: t.role === 'ariel' ? '#9a9286' : '#e8e3d8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.text}</div>
          </div>
        ))}
        {loading && <div style={{ color: '#5a5249', fontStyle: 'italic' }}>{AI_NAME} is thinking…</div>}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1d1a16', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder={orchStatus === 'unreachable' ? 'orchestrator unavailable' : loading ? 'waiting…' : `ask ${AI_NAME} about your vault…`} disabled={orchStatus === 'unreachable' || loading} style={{ flex: 1, background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={send} disabled={orchStatus === 'unreachable' || loading || !input.trim()} style={{ background: '#2a2520', border: '1px solid #3a342d', borderRadius: 3, padding: '6px 12px', color: loading ? '#5a5249' : '#9a9286', cursor: orchStatus === 'unreachable' || loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          {loading ? '…' : 'send'}
        </button>
      </div>
    </div>
  );
}
