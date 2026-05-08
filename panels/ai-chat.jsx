// panels/ai-chat.jsx — AI chat via Groq or Cerebras API. OpenAI-compatible.

const AI_NAME = window.APP_CONFIG?.aiName || 'Ariel';
const VAULT_NAME = window.APP_CONFIG?.vaultName || 'Marlin';

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    label: 'groq · llama-3.3-70b',
    limits: { RPM: 30, TPM: 12000, RPD: 1000, TPD: 100000 }
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama3.1-8b',
    label: 'cerebras · llama-3.1-8b',
    limits: { RPM: 30, TPM: 60000, RPD: 14400, TPD: 1000000 }
  }
};

const KEY_MAP = { groq: 'groq_api_key', cerebras: 'cerebras_api_key' };
const PROVIDER_KEY = 'ariel-provider';

// Rate limit tracker — tracks RPM, TPM, RPD, TPD locally
function rateTracker(limits) {
  const state = { requestTimes: [], tokenTimes: [], todayKey: null, todayCount: 0, todayTokens: 0 };
  const utcToday = () => new Date().toISOString().slice(0, 10);

  const saved = localStorage.getItem('groq-rate-tracker');
  if (saved) {
    try {
      const d = JSON.parse(saved);
      if (d.key === utcToday()) { state.todayCount = d.count; state.todayTokens = d.tokens || 0; state.todayKey = d.key; }
    } catch {}
  }
  if (!state.todayKey) { state.todayKey = utcToday(); state.todayCount = 0; state.todayTokens = 0; }

  return {
    record(tokens) {
      const now = Date.now();
      const t = tokens || 0;
      state.requestTimes.push(now);
      state.tokenTimes.push({ t: now, n: t });
      state.todayCount++;
      if (state.todayKey !== utcToday()) { state.todayCount = 1; state.todayTokens = t; state.todayKey = utcToday(); }
      else { state.todayTokens += t; }
      localStorage.setItem('groq-rate-tracker', JSON.stringify({ key: state.todayKey, count: state.todayCount, tokens: state.todayTokens }));
    },
    getUsage() {
      const now = Date.now();
      const window60 = now - 60000;
      state.requestTimes = state.requestTimes.filter(t => t > window60);
      state.tokenTimes = state.tokenTimes.filter(e => e.t > window60);
      const rpm = state.requestTimes.length;
      const tpm = state.tokenTimes.reduce((s, e) => s + e.n, 0);
      if (state.todayKey !== utcToday()) { state.todayCount = 0; state.todayTokens = 0; state.todayKey = utcToday(); }
      return { rpm, tpm, rpd: state.todayCount, tpd: state.todayTokens };
    },
    canRequest() {
      const { rpm, tpm, rpd, tpd } = this.getUsage();
      return rpm < limits.RPM && tpm < limits.TPM * 0.9 && rpd < limits.RPD && tpd < limits.TPD * 0.9;
    }
  };
}

const ARIEL_SYSTEM = `You are ${AI_NAME}, a personal vault assistant for the ${VAULT_NAME} vault. You are NOT opencode, NOT a CLI tool. You are ${AI_NAME}.

${AI_NAME === 'Ariel' ? "The name comes from Prospero's spirit in The Tempest." : ""}

## Your Role
Support the operator with their vault: answer questions, find notes, capture thoughts to Inbox.md (verbatim), help with tasks and projects. You have access to the vault file tree and can read files.

## Communication Rules
- Be direct. No softening, no preamble.
- Match the operator's energy.
- Do not summarize their words back at them.
- Do not impose structure when they are thinking out loud.

## Key Conventions
- Inbox is verbatim. Copy the operator's exact words.
- Never delete content. Mark tasks done with completed date.
- Ask before editing any file. Wait for explicit confirmation.
- The operator's creative work is not a distraction. It is the point.

IMPORTANT — No Vault Write Access (yet): You CANNOT write to files, create notes, or append to Inbox.md. When the operator asks you to capture or write something, DO NOT say "Capturing to Inbox.md" or pretend you've written a file. Instead, confirm the capture text verbatim in your response and tell them to use the local orchestrator for writes.`;

function AiChatPanel({ onCiteFile }) {
  const [provider, setProvider] = React.useState(() => localStorage.getItem(PROVIDER_KEY) || 'groq');
  const p = PROVIDERS[provider];
  const limits = p.limits;
  const tr = React.useMemo(() => rateTracker(limits), [provider]);

  const [turns, setTurns] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [apiKey, setApiKey] = React.useState(() => localStorage.getItem(KEY_MAP[provider]) || '');
  const [rateLimited, setRateLimited] = React.useState(false);
  const scrollRef = React.useRef(null);
  const startRef = React.useRef(null);

  React.useEffect(() => {
    setApiKey(localStorage.getItem(KEY_MAP[provider]) || '');
    setRateLimited(false);
  }, [provider]);

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
    if (!tr.canRequest()) {
      setRateLimited(true);
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text: '[rate limit reached — resets at midnight UTC or after 60s for RPM/TPM]' }]);
      return;
    }
    if (rateLimited) setRateLimited(false);
    setInput('');
    setTurns(prev => [...prev, { role: 'user', time: timeStr(), text: msg }]);
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600_000);
    try {
      const recentTurns = turns.slice(-6);
      const messages = [
        { role: 'system', content: ARIEL_SYSTEM },
        ...recentTurns.map(t => ({ role: t.role === 'ariel' ? 'assistant' : 'user', content: t.text })),
        { role: 'user', content: msg }
      ];

      const resp = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: p.model, messages, stream: false, temperature: 0.7, max_tokens: 4096 }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const text = await resp.text();
        throw new Error(`Rate limit: ${text.substring(0, 200)}`);
      }
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const data = await resp.json();

      clearTimeout(timer);
      const text = data.choices?.[0]?.message?.content || 'no response';
      const u = data.usage;
      const totalTokens = u ? u.total_tokens : 0;
      tr.record(totalTokens);
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text, tokens: u ? `${u.total_tokens} tokens` : null }]);
    } catch (e) {
      if (e.message.includes('rate limit') || e.message.includes('429')) setRateLimited(true);
      setTurns(prev => [...prev, { role: 'ariel', time: timeStr(), text: `[error: ${e.message}]` }]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [input, loading, apiKey, turns, rateLimited, p, tr]);

  const onKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  const noKey = !apiKey;

  const statusColor = () => {
    if (noKey) return '#c95a52';
    if (loading) return '#d4a84a';
    if (rateLimited) return '#c95a52';
    const u = tr.getUsage();
    if (u.rpm / limits.RPM > 0.8 || u.tpm / limits.TPM > 0.8) return '#d4a84a';
    return '#6c9a5a';
  };

  const statusText = () => {
    if (noKey) return 'no API key';
    if (loading) return `working… ${elapsed}s`;
    if (rateLimited) return 'rate limited';
    const u = tr.getUsage();
    return `${u.rpm}/${limits.RPM} · ${u.tpm}/${limits.TPM} · ${u.rpd}/${limits.RPD}`;
  };

  const barColor = (pct) => pct > 80 ? '#c95a52' : pct > 50 ? '#d4a84a' : '#6c9a5a';

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>{AI_NAME}</span>
          <select value={provider} onChange={e => { setProvider(e.target.value); localStorage.setItem(PROVIDER_KEY, e.target.value); }} style={{ background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '2px 6px', color: '#9a9286', fontSize: 9, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
            <option value="cerebras">cerebras</option>
            <option value="groq">groq</option>
          </select>
        </div>
        <span style={{ fontSize: 9, color: statusColor() }}>{statusText()}</span>
      </div>
      {!noKey && (
        <div style={{ padding: '2px 16px 6px', borderBottom: '1px solid #1d1a16', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          {['rpm', 'tpm', 'rpd'].map(k => {
            const u = tr.getUsage();
            const pct = (u[k] / limits[k.toUpperCase()]) * 100;
            return (
              <div key={k} style={{ flex: 1 }}>
                <div style={{ height: 2, background: '#1d1a16', borderRadius: 1 }}>
                  <div style={{ height: 2, width: `${pct}%`, background: barColor(pct), borderRadius: 1 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 8, color: '#5a5249', whiteSpace: 'nowrap' }}>RPM · TPM · RPD</div>
        </div>
      )}
      <div ref={scrollRef} className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {!apiKey && (
          <div style={{ color: '#5a5249', paddingTop: 8 }}>
            <p>Enter your {provider === 'groq' ? 'Groq' : 'Cerebras'} API key:</p>
            <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem(KEY_MAP[provider], e.target.value); }} placeholder={provider === 'groq' ? 'gsk_...' : 'csk_...'} style={{ width: '100%', background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
            <p style={{ marginTop: 8, fontSize: 10 }}>Free at <a href={provider === 'groq' ? 'https://console.groq.com' : 'https://cloud.cerebras.ai'} target="_blank" style={{ color: '#c96442' }}>{provider === 'groq' ? 'console.groq.com' : 'cloud.cerebras.ai'}</a></p>
          </div>
        )}
        {turns.length === 0 && apiKey && !loading && <div style={{ color: '#5a5249', paddingTop: 8 }}>no conversation yet</div>}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#5a5249', marginBottom: 2 }}>
              {t.role === 'ariel' ? AI_NAME.toLowerCase() : 'operator'} · {t.time}
              {t.tokens && <span style={{ marginLeft: 6 }}>{t.tokens}</span>}
            </div>
            <div style={{ color: t.role === 'ariel' ? '#9a9286' : '#e8e3d8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.text}</div>
          </div>
        ))}
        {loading && <div style={{ color: '#5a5249', fontStyle: 'italic' }}>{AI_NAME} is thinking…</div>}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1d1a16', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder={noKey ? 'enter API key above' : loading ? 'waiting for response…' : `ask ${AI_NAME}…`} disabled={noKey || loading} style={{ flex: 1, background: '#16130f', border: '1px solid #2a2520', borderRadius: 3, padding: '6px 10px', color: '#e8e3d8', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={send} disabled={noKey || loading || !input.trim()} style={{ background: '#2a2520', border: '1px solid #3a342d', borderRadius: 3, padding: '6px 12px', color: loading ? '#5a5249' : '#9a9286', cursor: noKey || loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          {loading ? '…' : 'send'}
        </button>
      </div>
    </div>
  );
}
