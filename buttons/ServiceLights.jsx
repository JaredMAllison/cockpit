// buttons/ServiceLights.jsx

const LIGHT = { ok: '#6c9a5a', degraded: '#d4a84a', error: '#c95a52' };
const fetchHealth = () => fetch('/api/health').then(r => r.json());

function ServiceLights() {
  const { data } = usePoll(fetchHealth, 30000);
  const services    = data?.services || [];
  const lastChecked = data?.checked  || null;
  const [tooltip, setTooltip] = React.useState(null); // name of open tooltip

  // Close tooltip on click outside
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
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {services.map(svc => {
        const color = LIGHT[svc.status] || ZELDA.goldDim;
        const open  = tooltip === svc.name;
        return (
          <div
            key={svc.name}
            data-svc-light={svc.name}
            onClick={() => setTooltip(open ? null : svc.name)}
            style={{
              position: 'relative', cursor: 'pointer',
              width: 10, height: 10, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}, inset 0 0 3px rgba(0,0,0,.4)`,
              border: '1px solid rgba(0,0,0,.3)',
              flexShrink: 0,
            }}
          >
            {open && (
              <div style={{
                position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
                background: ZELDA.feltOuter, border: `1px solid ${ZELDA.goldDeep}`,
                color: ZELDA.parchText, fontFamily: ZELDA_FONT_PIXEL, fontSize: 11,
                padding: '6px 10px', whiteSpace: 'nowrap', zIndex: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,.6)',
                lineHeight: 1.6,
              }}>
                <div style={{ color: ZELDA.gold }}>{svc.name}</div>
                <div>{svc.latency}</div>
                <div style={{ color: ZELDA.parchTextDim, fontSize: 9 }}>
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
