// buttons/ServiceLights.jsx

const LIGHT = { ok: '#6c9a5a', degraded: '#d4a84a', error: '#c95a52' };
const fetchHealth = () => fetch('/api/health').then(r => r.json());

const SVC_ABBREV = {
  'marlin': 'MRL', 'time-factory': 'TTF', 'ollama': 'OLM',
  'knowledge-loom': 'LOOM', 'ollama-orchestrator': 'ORC', 'cockpit': 'CPIT',
};
function svcAbbrev(name) {
  return SVC_ABBREV[name] || name.replace(/-.*/, '').slice(0, 4).toUpperCase();
}

function ServiceLights() {
  const { theme } = useTheme();
  const p = theme.palette;
  const { data } = usePoll(fetchHealth, 30000);
  const services    = data?.services || [];
  const lastChecked = data?.checked  || null;
  const [tooltip, setTooltip] = React.useState(null);

  React.useEffect(() => {
    if (!tooltip) return;
    const close = (e) => {
      if (!e.target.closest('[data-svc-light]')) setTooltip(null);
    };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [tooltip]);

  const slot = useButtonRailSlot('bottom');
  if (!slot) return null;

  const content = (
    <div style={{ order: 2, flex: 1, display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center' }}>
      {services.map(svc => {
        const color = LIGHT[svc.status] || p.goldDim;
        const open  = tooltip === svc.name;
        return (
          <div
            key={svc.name}
            data-svc-light={svc.name}
            onClick={() => setTooltip(open ? null : svc.name)}
            style={{
              position: 'relative', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 15, height: 15, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}, inset 0 0 3px rgba(0,0,0,.4)`,
              border: '1px solid rgba(0,0,0,.3)',
            }} />
            <span style={{
              fontFamily: theme.fonts.pixel, fontSize: 12,
              color, letterSpacing: 0.5, lineHeight: 1, opacity: 0.8,
            }}>{svcAbbrev(svc.name)}</span>
            {open && (
              <div style={{
                position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)',
                background: '#060d08', border: `1px solid ${p.gold}`,
                color: p.parchText, fontFamily: theme.fonts.pixel, fontSize: 12,
                padding: '8px 12px', whiteSpace: 'nowrap', zIndex: 200,
                boxShadow: `0 6px 20px rgba(0,0,0,.9), 0 0 0 1px ${p.goldDeep}`,
                lineHeight: 1.8,
              }}>
                <div style={{ color: p.gold, marginBottom: 2 }}>{svc.name}</div>
                <div style={{ color }}>{svc.status} · {svc.latency}</div>
                <div style={{ color: p.parchTextDim, fontSize: 10, marginTop: 2 }}>
                  {lastChecked ? new Date(lastChecked).toLocaleTimeString() : '—'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return ReactDOM.createPortal(content, slot);
}

Object.assign(window, { ServiceLights });
