// app.jsx — root component: sub-screen state, keyboard nav, editMode, LabelsProvider

const SUBSCREEN_IDS = ['quest', 'map', 'items', 'terminal', 'magic'];

const QuestStatus = () => (
  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
    <div style={{ flex: 1, borderRight: '1px solid #1d1a16' }}><ProjectsPanel /></div>
    <div style={{ flex: 1 }}><MarlinPanel /></div>
  </div>
);

const MapScreen = () => (
  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
    <div style={{ flex: 1, borderRight: '1px solid #1d1a16', overflow: 'hidden' }}>
      <iframe
        src="http://localhost:8000"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="The Time Factory"
      />
    </div>
    <div style={{ width: 260, flexShrink: 0 }}><QuickhacksPanel /></div>
  </div>
);

const TerminalScreen = () => (
  <TerminalPanel />
);

const MAGIC_LAUNCHERS = [
  { name: 'Claude Code', cmd: 'claude', desc: 'Architect / design / high-executive work', port: null, color: '#c96442' },
  { name: 'OpenCode Zen', cmd: 'opencode', desc: 'Engineering / coding / build', port: null, color: '#6c9a5a' },
];

const MagicScreen = () => (
  <div style={{ width: '100%', height: '100%', background: '#0e0c0a', color: '#e8e3d8', overflow: 'auto' }}>
    <div style={{ padding: '24px 32px' }}>
      <div style={{ fontSize: 9, color: '#5a5249', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>They work the magics</div>
      <div style={{ display: 'flex', gap: 16 }}>
        {MAGIC_LAUNCHERS.map(t => (
          <div key={t.name} style={{
            flex: 1, background: '#16130f', border: `1px solid #2a2520`, borderRadius: 6, padding: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: `${t.color}22`, border: `2px solid ${t.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{t.name[0]}</div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1, color: t.color }}>{t.name}</div>
            <div style={{ fontSize: 10, color: '#5a5249', textAlign: 'center' }}>{t.desc}</div>
            <div style={{ fontSize: 9, color: '#3a342d', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace' }}>{t.cmd}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ItemsScreen = ({ arielFile, setArielFile, setActive }) => (
  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
    <div style={{ flex: '0 0 52%', borderRight: '1px solid #1d1a16' }}>
      <VaultPanel highlightedFile={arielFile} />
    </div>
    <div style={{ flex: 1 }}>
      <AiChatPanel onCiteFile={(path) => { setArielFile(path); setActive('items'); }} />
    </div>
  </div>
);

function App() {
  const [active, setActive]         = React.useState('terminal');
  const [editMode, setEditMode]     = React.useState(false);
  const [arielFile, setArielFile]   = React.useState(null);
  const [optimisticMode, setOptimisticMode] = React.useState(null);
  const { data: rootState } = usePoll(fetchState, 30000);
  const mode = optimisticMode || rootState?.mode || 'available';

  React.useEffect(() => { setOptimisticMode(null); }, [rootState]);

  React.useEffect(() => {
    const handler = (e) => setOptimisticMode(e.detail.mode);
    window.addEventListener('cockpit:mode-switch', handler);
    return () => window.removeEventListener('cockpit:mode-switch', handler);
  }, []);

  React.useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      const idx = SUBSCREEN_IDS.indexOf(active);
      if (e.key === '1') setActive('quest');
      else if (e.key === '2') setActive('map');
      else if (e.key === '3') setActive('items');
      else if (e.key === '4') setActive('terminal');
      else if (e.key === '5') setActive('magic');
      else if (e.key === 'ArrowRight' || e.key === ']') setActive(SUBSCREEN_IDS[Math.min(idx + 1, SUBSCREEN_IDS.length - 1)]);
      else if (e.key === 'ArrowLeft'  || e.key === '[') setActive(SUBSCREEN_IDS[Math.max(idx - 1, 0)]);
      else if (e.key === 'e') setEditMode(em => !em);
      else if (e.key === 'Escape') setEditMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  const show = (id) => id === active ? '' : 'none';

  return (
    <LabelsProvider editing={editMode}>
      <ZeldaFrame activeSubscreen={active} onSubscreenChange={setActive} mode={mode}>
        <SubscreenTransition active={active}>
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div key="quest"    style={{ position: 'absolute', inset: 0, display: show('quest') }}><QuestStatus /></div>
            <div key="map"      style={{ position: 'absolute', inset: 0, display: show('map') }}><MapScreen /></div>
            <div key="items"    style={{ position: 'absolute', inset: 0, display: show('items') }}><ItemsScreen arielFile={arielFile} setArielFile={setArielFile} setActive={setActive} /></div>
            <div key="terminal" style={{ position: 'absolute', inset: 0, display: show('terminal') }}><TerminalScreen /></div>
            <div key="magic" style={{ position: 'absolute', inset: 0, display: show('magic') }}><MagicScreen /></div>
          </div>
        </SubscreenTransition>
      </ZeldaFrame>
    </LabelsProvider>
  );
}

const mountRoot = ReactDOM.createRoot(document.getElementById('root'));
mountRoot.render(<App />);
