// panels/state-map.jsx — cockpit panel five: the Marlin State Map (marlin-adr-057)
// Orbit + Cell zoom. Read-only. Never scrolls: off-screen means nonexistent.

const SM_FONT = '"Berkeley Mono","JetBrains Mono","IBM Plex Mono",ui-monospace,monospace';
const SM_STATE_COLOR = {
  'needs-you': '#c96442',
  'moving':    '#5fa0a8',
  'quiet':     '#3a352e',
  'degraded':  '#b8503c',
};
const SM_WORK_GROUPS    = ['P1', 'P2', 'P3', 'R'];
const SM_MACHINE_GROUPS = ['services', 'repos', 'backup'];

function StateMapCell({ cell, onZoom }) {
  return (
    <div
      onClick={() => onZoom(cell.id)}
      title={cell.why}
      style={{
        padding: '5px 9px', borderRadius: 2, cursor: 'pointer',
        background: '#141210', border: `1px solid ${SM_STATE_COLOR[cell.state]}`,
        color: cell.state === 'quiet' ? '#7a7268' : '#e8e3d8',
        fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', maxWidth: 190,
      }}
    >
      {cell.label}
    </div>
  );
}

function StateMapGroup({ label, cells, onZoom, dim }) {
  if (!cells.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: '#5a5249', letterSpacing: 1,
                    textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, opacity: dim ? 0.55 : 1 }}>
        {cells.map(c => <StateMapCell key={c.id} cell={c} onZoom={onZoom} />)}
      </div>
    </div>
  );
}

function StateMapDetail({ cell, onBack }) {
  const d = cell.detail || {};
  const row = (k, v) => (
    <div style={{ display: 'flex', gap: 12, padding: '3px 0' }}>
      <span style={{ width: 90, color: '#5a5249', flexShrink: 0 }}>{k}</span>
      <span style={{ color: '#e8e3d8' }}>{v}</span>
    </div>
  );
  return (
    <div style={{ padding: '18px 22px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    borderBottom: '1px solid #1d1a16', paddingBottom: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15, color: '#e8e3d8' }}>{cell.label}</span>
        <span style={{ fontSize: 10, color: SM_STATE_COLOR[cell.state] }}>
          {cell.group} · {cell.state}
        </span>
      </div>
      <div style={{ fontSize: 11 }}>
        {row('why', cell.why)}
        {d.brief   && row('brief', d.brief)}
        {d.next    && row('next', d.next)}
        {d.branch  && row('branch', d.branch)}
        {d.result  && row('result', d.result)}
        {d.roadmap
          ? row('roadmap', `${d.roadmap.current || ''} — phase ${d.roadmap.index} of ${d.roadmap.total}`)
          : (cell.region === 'work' && row('roadmap', 'no roadmap file'))}
        {d.tasks && row('tasks', `${d.tasks.done} / ${d.tasks.total} done`)}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 10, color: '#5a5249' }}>
        press Esc or click to return to orbit
      </div>
      <div onClick={onBack} style={{ position: 'absolute', inset: 0, cursor: 'zoom-out' }} />
    </div>
  );
}

function StateMapPanel() {
  const { data, error, loading } = usePoll(fetchStateMap, 30000);
  const [zoomed, setZoomed] = React.useState(null);
  const [overflow, setOverflow] = React.useState(false);
  const workPaneRef = React.useRef(null);
  const machineRef = React.useRef(null);

  const checkOverflow = React.useCallback(() => {
    let overflowing = false;
    if (workPaneRef.current && workPaneRef.current.scrollHeight > workPaneRef.current.clientHeight) {
      overflowing = true;
    }
    if (!overflowing && machineRef.current && machineRef.current.scrollHeight > machineRef.current.clientHeight) {
      overflowing = true;
    }
    setOverflow(overflowing);
  }, []);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [data, checkOverflow]);

  const cells = (data && data.cells) || [];
  const byGroup = (g) => cells.filter(c => c.group === g);
  const zoomedCell = zoomed && cells.find(c => c.id === zoomed);

  const shell = (children) => (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: SM_FONT,
                  width: '100%', height: '100%', position: 'relative',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #1d1a16',
                    display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <E path="panel.stateMap" fallback="State Map"/>
        </span>
        <span style={{ fontSize: 10, color: (data && data.stale) || error || overflow ? '#c96442' : '#5a5249' }}>
          {loading ? 'loading…'
                 : error ? '⚠ unreachable'
                 : data && data.stale ? `⚠ stale — ${data.stale_reason}`
                 : overflow ? `⚠ ${cells.length} cells (some hidden)`
                 : `${cells.length} cells`}
        </span>
      </div>
      {children}
    </div>
  );

  if (zoomedCell) return shell(<StateMapDetail cell={zoomedCell} onBack={() => setZoomed(null)} />);

  return shell(
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      <div ref={workPaneRef} style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid #1d1a16', minWidth: 0, overflow: 'hidden' }}>
        {SM_WORK_GROUPS.map(g =>
          <StateMapGroup key={g} label={g} cells={byGroup(g)} onZoom={setZoomed} />)}
      </div>
      {/* Machine half is ambient (ADR-054): dimmed at rest, asserts when degraded. */}
      <div ref={machineRef} style={{ width: 260, flexShrink: 0, padding: '14px 16px', overflow: 'hidden' }}>
        {SM_MACHINE_GROUPS.map(g =>
          <StateMapGroup key={g} label={g} cells={byGroup(g)} onZoom={setZoomed}
                         dim={!byGroup(g).some(c => c.state === 'degraded')} />)}
      </div>
    </div>
  );
}
