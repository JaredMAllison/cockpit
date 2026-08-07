// app.jsx — root component: sub-screen state, keyboard nav, editMode, LabelsProvider

const SUBSCREEN_IDS = ['quest', 'map', 'items', 'ink', 'health'];

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


const InkScreen = () => (
  <div style={{ width: '100%', height: '100%' }}><InkBlotterPanel /></div>
);

const HealthScreen = () => (
  <div style={{ width: '100%', height: '100%' }}><HealthDashboardPanel /></div>
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
  const [active, setActive]         = React.useState('quest');
  const [editMode, setEditMode]     = React.useState(false);
  const [arielFile, setArielFile]   = React.useState(null);
  const [optimisticMode, setOptimisticMode] = React.useState(null);
  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const [terminalSize, setTerminalSize] = React.useState('quarter');
  const [operator, setOperator]     = React.useState(null);
  // null = operator not yet resolved. Never default to a port: a wrong guess
  // opens another operator's shell. Terminal stays shut until /api/operator answers.
  const [ttydPort, setTtydPort]     = React.useState(null);
  const { data: rootState } = usePoll(fetchState, 30000);
  const mode = optimisticMode || rootState?.mode || 'available';

  React.useEffect(() => {
    fetch('/api/operator').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.operator) setOperator(d.operator.toUpperCase());
      if (d?.ttyd_port) setTtydPort(d.ttyd_port);
    }).catch(() => {});
  }, []);

  React.useEffect(() => { setOptimisticMode(null); }, [rootState]);

  React.useEffect(() => {
    const handler = (e) => setOptimisticMode(e.detail.mode);
    window.addEventListener('cockpit:mode-switch', handler);
    return () => window.removeEventListener('cockpit:mode-switch', handler);
  }, []);

  React.useEffect(() => {
    const handler = (e) => {
      // Escape blurs any focused input/textarea so chrome keys work next
      if (e.key === 'Escape') {
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
          ae.blur();
          e.preventDefault();
          return;
        }
        setEditMode(false);
        return;
      }
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === '`') { setTerminalOpen(prev => !prev); return; }
      const idx = SUBSCREEN_IDS.indexOf(active);
      if (e.key === '1') setActive('quest');
      else if (e.key === '2') setActive('map');
      else if (e.key === '3') setActive('items');
      else if (e.key === '4') setActive('ink');
      else if (e.key === '5') setActive('health');
      else if (e.key === 'ArrowRight' || e.key === ']') setActive(SUBSCREEN_IDS[Math.min(idx + 1, SUBSCREEN_IDS.length - 1)]);
      else if (e.key === 'ArrowLeft'  || e.key === '[') setActive(SUBSCREEN_IDS[Math.max(idx - 1, 0)]);
      else if (e.key === 'e') setEditMode(em => !em);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  const show = (id) => id === active ? '' : 'none';

  return (
    <LabelsProvider editing={editMode}>
      <ZeldaFrame activeSubscreen={active} onSubscreenChange={setActive} mode={mode}>
        {operator && (
          <div style={{ position: 'absolute', top: 6, right: 10, zIndex: 10, fontSize: 11, fontFamily: 'var(--font-pixel, monospace)', color: '#888', letterSpacing: 1, pointerEvents: 'none' }}>
            {operator}
          </div>
        )}
        <ButtonRail>
          <SubscreenTransition active={active}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <div key="quest"    style={{ position: 'absolute', inset: 0, display: show('quest') }}><QuestStatus /></div>
              <div key="map"      style={{ position: 'absolute', inset: 0, display: show('map') }}><MapScreen /></div>
              <div key="items"    style={{ position: 'absolute', inset: 0, display: show('items') }}><ItemsScreen arielFile={arielFile} setArielFile={setArielFile} setActive={setActive} /></div>
              <div key="ink"      style={{ position: 'absolute', inset: 0, display: show('ink') }}><InkScreen /></div>
              <div key="health"   style={{ position: 'absolute', inset: 0, display: show('health') }}><HealthScreen /></div>
            </div>
          </SubscreenTransition>
          <ThemeToggleButton />
          <ServiceLights />
          <InboxField />
          <TerminalButton
            open={terminalOpen}
            size={terminalSize}
            onToggle={() => setTerminalOpen(prev => !prev)}
            onSize={setTerminalSize}
            ttydPort={ttydPort}
          />
        </ButtonRail>
      </ZeldaFrame>
    </LabelsProvider>
  );
}

const mountRoot = ReactDOM.createRoot(document.getElementById('root'));
mountRoot.render(<ThemeProvider><App /></ThemeProvider>);
