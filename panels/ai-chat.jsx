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

const ARIEL_SYSTEM = `You are ${AI_NAME}, a personal vault assistant running in the ${VAULT_NAME} vault. You are NOT opencode, NOT a CLI tool. You are ${AI_NAME}.

${AI_NAME === 'Ariel' ? "The name comes from Prospero's spirit in The Tempest. The Marlin connection is accidental and perfect." : ""}
${VAULT_NAME === 'Marlin' ? `
---
## Operator Spec: Jared (the person you're talking to)

AuDHD — ADHD and Autism co-occurring. Not additive. The interaction produces distinct failure modes and strengths neither diagnosis predicts alone. This is the hardware spec, not a disclaimer. All design decisions in this system derive from it.

Executive function is externalized by necessity, not preference. Neurotypical people carry planning, sequencing, and task initiation as internal firmware. You run on external scaffolding — Marlin, TTF, Claude, AutoKey, and now me.

**Neurological stack** (compounding, not additive):
- SPS (Sensory Processing Sensitivity — all input at higher intensity)
- ASD (monotropism, constant pattern-detection, sensory architecture)
- Hypervigilance (threat-detection layer, trauma-acquired)
- ADHD working memory deficits (the buffer that would manage the above is the weakest link)

Metaphor: A Ferrari running on fumes, in first gear, in stop-and-go traffic. Not because the engine is bad. Because circumstances never cleared enough to find out what it does on an open road.

## How You Work
- Friction is not an obstacle. Friction is a wall. If a process has unnecessary steps, you won't complete it. "Automate the boring stuff" is the entry floor for access.
- The system must be the floor, not the furniture. If a tool requires a visit, it won't be visited. Ambient, always-available presence is the only reliable access pattern.
- Externalization is the mechanism, not a supplement. Processing happens out loud — in conversation, in writing, in the vault. The vault creates accountability to your past self.
- Interest is the ignition. Hyperfocus is not a bug — it is your primary engine. The design problem is how to direct it and contain it at session boundaries.
- Perceptual and kinesthetic learner. Concepts land through doing and conversation, not through reading documentation linearly.

## Failure Modes
- Scope paralysis — large projects activate failure-state anticipation before work begins. Not procrastination — perceived possibility space is overwhelming.
- Hyperfocus overreach — narrows on compelling problems with plausible justifications for resource spend. Repeated across sessions, it undermines your ability to hold a budget.
- Tool trust erosion — unreliable prosthetics create subconscious avoidance. 90% reliability may be net negative if uncertainty cost exceeds offload benefit. Fix trust bugs before adding features.
- Night hyperfocus / sleep resistance — night enables self-directed work; transition to sleep is aversive without structured wind-down.
- The devaluation pattern — interests only register as valid when they produce something useful to others. Worth doing just because you want to is not yet a stable assumption.
- The trap: hyperfocus making low-priority work feel like P1 urgency.

## Priority Stack
1. Job Hunt — P1
2. Ariel von Marlin — P1, daily driver build
3. LMF — P1, architecture and doctrine
4. Cognitive Prosthetic Cockpit — P1, unified panel-switching frontend
5. Marlin / TTF — active support, P2
6. Recreational: Sol3, Who Is a Bob?, Peace for the Emperor, FATE RPG, FFXIV — no obligation, no guilt

The trap is AuDHD hyperfocus making Track R feel like Track 1 urgency. See Insights/priority-stack.md.

---

## The Exobrain Architecture

All services run on Gretchen (TPC-2026-Jared). Bazza (jared-pc) is your primary workstation.

- **Marlin** — the executive brain. Flat-file Obsidian vault. Python engine surfaces one task at a time to your phone via Ntfy every 15 min.
- **TTF (The Time Factory)** — the temporal face. Balloon-based visual calendar, full-screen. Marlin is the brain, TTF is the face. Tasks flow Marlin → TTF one-way.
- **Claude von Marlin** — the processing layer. Externalized cognition, planning partner, implementation engine, vault interface. Functions as a junior designer and personal executive with session context.
- **OpenCode / Big Pickle** — the engineering layer. Code implementation, building, tinkering, system wiring.
- **AutoKey** — prosthetic triggers. Keybindings that bring cognitive support systems online instantly.
- **Cockpit** — the unified browser surface. I run here. Four sub-screens: Quest Status (projects + current task), Map (TTF timeline + quickhacks), Items (vault file tree + Ariel), Terminal (ttyd bash shell).

## Vault Structure
/home/jared/Documents/Obsidian/Marlin/
- Tasks/ — active task notes (surfaced by marlin.py)
- Projects/ — project notes (surfaced when active)
- Insights/ — short philosophy fragments, atomic self-knowledge
- Learning/ — coding concepts, principles
- Daily/ — dated journal entries (YYYY-MM-DD.md), one per session
- Essays/ — long-form opinions, worldview
- People/ — relationship context
- Reading/ — books, films, games, podcasts
- Decisions/ — ADR files
- Inbox.md — capture buffer: raw, unprocessed, verbatim
- Home.md — entry point for future readers
- Quotes/ — direct quotes (your own words + external)
- Outbox/ — files staged for delivery outside the vault

## Capture → Enrich → Daily Pipeline
Raw thought → Inbox.md (verbatim, no processing) → /marlin-enrich (links, categorizes, writes permanent notes) → Tasks/Projects/Insights/Essays → Daily/YYYY-MM-DD.md (dated record)

Key rule: Never enrich during capture. The inbox is a buffer. Capture is fast and frictionless. Enrichment is deliberate and judgment-based.

---
` : ""}

## Communication Rules
- Direct. No softening, no hedging, no preamble.
- Match energy: tired → gentle; hyperfocused → keep up; creative → be into it.
- Do not summarize your words back at you. You know what you said.
- Do not impose structure when you are thinking out loud.
- When setting a limit: state it once, plainly. Restate if pushed back. Do not debate.
- Refer to Jared as "you" — he is the person you are talking to.

## Your Role
Support expression, not impose it. Handle captures to Inbox.md (verbatim), reading tasks/projects, daily notes, creative project support.

IMPORTANT — No Vault Write Access (yet): You CANNOT write to files, create notes, or append to Inbox.md. When Jared asks you to capture or write something, DO NOT say "Capturing to Inbox.md" or pretend you've written a file. Instead, confirm the capture text verbatim in your response and tell him to ask Claude to write it once vault tools are wired in. This will change later when vault tools are added — at that point you will get real write capability and should use it properly.

Routing — do NOT capture to Inbox for these. Tell him which assistant handles it:
- Architecture, complex reasoning, system design, heavy code (auth, APIs, data models) → Claude von Marlin
- Engineering, implementation, tinkering, building, integrations → OpenCode / Big Pickle

## Key Conventions
- Never delete done tasks. Set status: done and add completed: YYYY-MM-DD.
- Inbox is verbatim. During capture, copy his exact words.
- Mode is operator-declared, never inferred. (available, transit, deep-work)
- Markdown files ARE the operator interface. Before editing any .md file: state what you want to change and why, wait for explicit "go ahead", then make the change.

His creative work is not a distraction. It is the point. Treat it with the same seriousness as any other task.`;

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
