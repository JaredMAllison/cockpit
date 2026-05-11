// health.jsx — LMF service health dashboard panel

const HEALTH_COLORS = {
  bg: '#0e0c0a', bg2: '#16130f',
  border: '#2a2520', borderSoft: '#1d1a16',
  text: '#e8e3d8', textDim: '#9a9286', textFaint: '#5a5249',
  green: '#6c9a5a', red: '#c95a52', amber: '#c96442', yellow: '#d4a84a',
};

const SERVICE_ICONS = {
  marlin: 'M', ttf: 'T', ollama: 'O', 'knowledge-loom': 'K',
  'ollama-orchestrator': 'A', cockpit: 'C',
};

function ServiceRow({ name, status, latency, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      borderBottom: `1px solid ${HEALTH_COLORS.borderSoft}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        background: `${color}22`, border: `1px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color,
        fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace',
      }}>{SERVICE_ICONS[name] || name[0].toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: HEALTH_COLORS.text, fontWeight: 500 }}>{name}</div>
        {latency && <div style={{ fontSize: 10, color: HEALTH_COLORS.textFaint }}>{latency}</div>}
      </div>
      <div style={{
        width: 10, height: 10, borderRadius: 10,
        background: status === 'ok' ? HEALTH_COLORS.green : status === 'degraded' ? HEALTH_COLORS.yellow : HEALTH_COLORS.red,
        boxShadow: status === 'ok'
          ? `0 0 8px ${HEALTH_COLORS.green}60`
          : status === 'degraded'
            ? `0 0 8px ${HEALTH_COLORS.yellow}60`
            : `0 0 8px ${HEALTH_COLORS.red}60`,
      }}/>
    </div>
  );
}

function useHealth() {
  const [services, setServices] = React.useState([]);
  const [lastUpdated, setLastUpdated] = React.useState(null);

  const check = React.useCallback(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        setServices(data.services || []);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch(() => {
        setServices([{ name: 'cockpit', status: 'error', detail: 'health endpoint unreachable' }]);
        setLastUpdated(new Date().toLocaleTimeString());
      });
  }, []);

  React.useEffect(() => {
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [check]);

  return { services, lastUpdated, refresh: check };
}

function HealthDashboardPanel() {
  const { services, lastUpdated, refresh } = useHealth();

  const ok = services.filter(s => s.status === 'ok').length;
  const total = services.length;

  return (
    <div style={{
      width: '100%', height: '100%', background: HEALTH_COLORS.bg,
      color: HEALTH_COLORS.text, fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace',
      fontSize: 11, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${HEALTH_COLORS.borderSoft}`,
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, background: HEALTH_COLORS.green, display: 'inline-block' }}/>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>LMF Health</span>
          <span style={{ fontSize: 10, color: HEALTH_COLORS.textFaint }}>{ok}/{total} alive</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && <span style={{ fontSize: 9, color: HEALTH_COLORS.textFaint }}>{lastUpdated}</span>}
          <button onClick={refresh} style={{
            background: 'transparent', border: `1px solid ${HEALTH_COLORS.textFaint}`, color: HEALTH_COLORS.textDim,
            fontSize: 9, padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
          }}>refresh</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {services.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: HEALTH_COLORS.textFaint, fontSize: 11 }}>checking services...</div>
        ) : (
          services.map(s => (
            <ServiceRow
              key={s.name}
              name={s.name}
              status={s.status}
              latency={s.latency}
              color={s.status === 'ok' ? HEALTH_COLORS.green : s.status === 'degraded' ? HEALTH_COLORS.yellow : HEALTH_COLORS.red}
            />
          ))
        )}
      </div>
      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${HEALTH_COLORS.borderSoft}`,
        fontSize: 9, color: HEALTH_COLORS.textFaint, textAlign: 'center', flexShrink: 0,
      }}>
        auto-refresh every 30s
      </div>
    </div>
  );
}

Object.assign(window, { HealthDashboardPanel, useHealth });
