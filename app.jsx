// app.jsx — root component: sub-screen state, keyboard nav, editMode, LabelsProvider

const SUBSCREEN_IDS = ['quest', 'map', 'items'];

const QuestStatus = () => (
  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
    <div style={{ flex: 1, borderRight: '1px solid #1d1a16' }}><ProjectsPanel /></div>
    <div style={{ flex: 1 }}><MarlinPanel /></div>
  </div>
);

const MapScreen = () => (
  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
    <div style={{ flex: 1, borderRight: '1px solid #1d1a16' }}><TtfPanel /></div>
    <div style={{ width: 260, flexShrink: 0 }}><QuickhacksPanel /></div>
  </div>
);

const ItemsScreen = ({ arielFile, setArielFile, setActive }) => (
  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
    <div style={{ flex: '0 0 52%', borderRight: '1px solid #1d1a16' }}>
      <VaultPanel highlightedFile={arielFile} />
    </div>
    <div style={{ flex: 1 }}>
      <ArielGroqPanel onCiteFile={(path) => { setArielFile(path); setActive('items'); }} />
    </div>
  </div>
);

function App() {
  const [active, setActive]         = React.useState('quest');
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
      else if (e.key === 'ArrowRight' || e.key === ']') setActive(SUBSCREEN_IDS[Math.min(idx + 1, SUBSCREEN_IDS.length - 1)]);
      else if (e.key === 'ArrowLeft'  || e.key === '[') setActive(SUBSCREEN_IDS[Math.max(idx - 1, 0)]);
      else if (e.key === 'e') setEditMode(em => !em);
      else if (e.key === 'Escape') setEditMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  const content = active === 'quest' ? <QuestStatus /> :
                  active === 'map'   ? <MapScreen /> :
                  <ItemsScreen arielFile={arielFile} setArielFile={setArielFile} setActive={setActive} />;

  return (
    <LabelsProvider editing={editMode}>
      <ZeldaFrame activeSubscreen={active} onSubscreenChange={setActive} mode={mode}>
        <SubscreenTransition active={active}>
          {content}
        </SubscreenTransition>
      </ZeldaFrame>
    </LabelsProvider>
  );
}
