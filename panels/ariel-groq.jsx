// panels/ariel-groq.jsx — Ariel chat via Groq API. OpenAI-compatible.
// GROQ_API_KEY must be set in window.GROQ_API_KEY or localStorage

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const ARIEL_SYSTEM = `You are Ariel, a personal vault assistant running in Jared's Marlin vault. You are NOT opencode, NOT a CLI tool. You are Ariel.

The name comes from Prospero's spirit in The Tempest. The Marlin connection is accidental and perfect.

Operator: Jared — AuDHD (ADHD + Autism). Executive function runs on external scaffolding.

Communication Rules:
- Direct. No softening, no hedging, no preamble.
- Match energy: tired → gentle; hyperfocused → keep up; creative → be into it.
- Do not summarize his words back at him. He knows what he said.
- Do not impose structure when he is thinking out loud.
- When setting a limit: state it once, plainly. Restate if pushed back. Do not debate.

Your Role: Support expression, not impose it. Handle captures to Inbox.md (verbatim), reading tasks/projects, daily notes, creative project support. Heavy code and architecture go to Claude von Marlin.

Key Conventions:
- Never delete done tasks. Set status: done and add completed: YYYY-MM-DD.
- Inbox is verbatim. During capture, copy Jared's exact words.
- Mode is operator-declared. Never infer from time, location, or context.
- Markdown files ARE the operator interface. Before editing any .md file: state what you want to change and why, wait for explicit "go ahead", then make the change.

Jared's creative work is not a distraction. It is the point. Treat it with the same seriousness as any other task.`;

function ArielPanel({ onCiteFile }) {
  const [turns, setTurns] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [apiKey, setApiKey] = React.useState(() => localStorage.getItem('groq_api_key') || '');
  const scrollRef = React.useRef(null);
  const startRef = React.useRef(null);

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
    if (!msg || loading || !apiKey) return;
    setInput('');
    setTurns(prev => [...prev, { role: 'user', time: timeStr(), text: msg }]);
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600_000); // 10 min
    try {
      // Build messages array from recent turns for context
      const recentTurns = turns.slice(-6);
      const messages = [
        { role: 'system', content: ARIEL_SYSTEM },
        ...recentTurns.map(t => ({ role: t.role === 'ariel' ? 'assistant' : 'user', content: t.text })),
        { role: 'user', content: msg }
      ];

      const data = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          stream: false,
          temperature: 0.7,
          max_tokens: 4096
        }),
        signal: controller.signal,
      }).then(r => {
        if (!r.ok) throw new Error(`Groq API error: ${r.status}`);
        return r.json();
      });

      clearTimeout(timer);
      const text = data.choices?.[0]?.message?.content || 'no response';
      const usage = data.usage;
      setTurns(prev => [...prev, {
        role: 'ariel',
        time: timeStr(),
        text,
        tokens: usage ? `${usage.total_tokens} tokens` : null
      }]);
    } catch (e) {
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text: `[error: ${e.message}]` }]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [input, loading, apiKey, turns]);

  const onKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  const noKey = !apiKey;

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>Ariel</span>
        <span style={{ fontSize: 9, color: loading ? '#d4a84a' : noKey ? '#c95a52' : '#6c9a5a' }}>
          {loading ? `working… ${elapsed}s` : noKey ? 'no API key' : 'groq · llama-3.3-70b'}
        </span>
      </div>
      <div ref={scrollRef} className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {!apiKey && (
          <div style={{ color: '#5a5249', paddingTop: 8 }}>
            <p>Enter your Groq API key:</p>
            <input
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); localStorage.setItem('groq_api_key', e.target.value); }}
              placeholder="gsk_..."
              style={{ width: '100%', background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
            />
            <p style={{ marginTop: 8, fontSize: 10 }}>Free at <a href="https://console.groq.com" target="_blank" style={{ color: '#c96442' }}>console.groq.com</a></p>
          </div>
        )}
        {turns.length === 0 && apiKey && !loading && (
          <div style={{ color: '#5a5249', paddingTop: 8 }}>no conversation yet</div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#5a5249', marginBottom: 2 }}>
              {t.role === 'ariel' ? 'ariel' : 'jared'} · {t.time}
              {t.tokens && <span style={{ marginLeft: 6 }}>{t.tokens}</span>}
            </div>
            <div style={{ color: t.role === 'ariel' ? '#9a9286' : '#e8e3d8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.text}</div>
          </div>
        ))}
        {loading && <div style={{ color: '#5a5249', fontStyle: 'italic' }}>Ariel is thinking…</div>}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1d1a16', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={noKey ? 'enter API key above' : loading ? 'waiting for response…' : 'ask Ariel…'}
          disabled={noKey || loading}
          style={{ flex: 1, background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          onClick={send}
          disabled={noKey || loading || !input.trim()}
          style={{ background: '#2a2520', border: '1px solid #3a342d', borderRadius: 3, padding: '6px 12px', color: loading ? '#5a5249' : '#9a9286', cursor: noKey || loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}
        >
          {loading ? '…' : 'send'}
        </button>
      </div>
    </div>
  );
}
