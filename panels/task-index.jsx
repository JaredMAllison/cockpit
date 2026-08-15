// panels/task-index.jsx — vault task list, TTF index, Now Surfacing hero.
// Ambient surface (marlin-adr-054): shows many rows, demands nothing.

function TaskIndexPanel({ onFocusDate }) {
  const [sortId, setSortId] = React.useState('due');
  const [selected, setSelected] = React.useState(null);

  const { data: taskData, error: taskErr } = usePoll(fetchAllTasks, 30000);
  const { data: stateData }               = usePoll(fetchState, 30000);

  const today = new Date().toISOString().slice(0, 10);
  const ttfFetch = React.useRef(() => fetchTtfEvents('2026-01-01', '2027-12-31'));
  const { data: ttfData, error: ttfErr } = usePoll(() => ttfFetch.current(), 60000);

  // Join on external_id — a vault path, not a uuid. Survives ttf_id loss and
  // needs no lookup table. TTF being down degrades binding to "unknown"
  // rather than failing the whole panel.
  const bound = React.useMemo(() => {
    const set = new Set((ttfData || []).map(e => e.external_id).filter(Boolean));
    return set;
  }, [ttfData]);

  const rows = React.useMemo(() => {
    const sort = (window.TASK_SORTS.find(s => s.id === sortId) || window.TASK_SORTS[0]);
    return (taskData?.tasks || [])
      .map(t => ({
        ...t,
        _binding: ttfErr ? 'unknown'
                : bound.has(t.external_id) ? 'bound'
                : t.ttf_id ? 'orphaned' : 'unbound',
      }))
      .sort(sort.sort);
  }, [taskData, bound, sortId, ttfErr]);

  function pick(t) {
    setSelected(t.slug);
    if (t.goal_date && onFocusDate) onFocusDate(t.goal_date);
  }

  const BIND_MARK = { bound: '⛓', orphaned: '✕', unbound: '○', unknown: '·' };
  const BIND_COLOR = { bound: '#6c9a5a', orphaned: '#c95a52', unbound: '#5a5249', unknown: '#5a5249' };

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <E path="panel.taskIndex" fallback="Task Index"/>
        </span>
        <span style={{ fontSize: 10, color: '#5a5249' }}>
          {rows.length}{taskErr ? ' ⚠' : ''}
        </span>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '2px solid #1d1a16', borderLeft: '3px solid #6c9a5a', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>now surfacing</div>
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>{stateData?.last_surfaced_task || '—'}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid #1d1a16', flexShrink: 0, flexWrap: 'wrap' }}>
        {window.TASK_SORTS.map(s => (
          <button key={s.id} onClick={() => setSortId(s.id)}
            style={{ background: s.id === sortId ? '#1d1a16' : 'transparent',
                     color: s.id === sortId ? '#e8e3d8' : '#5a5249',
                     border: '1px solid #1d1a16', padding: '2px 8px', fontSize: 9,
                     textTransform: 'uppercase', letterSpacing: 0.5,
                     cursor: 'pointer', fontFamily: 'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '4px 16px 12px' }}>
        {rows.map(t => (
          <div key={t.slug} onClick={() => pick(t)}
            style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0',
                     borderBottom: '1px solid #1d1a16', cursor: 'pointer',
                     background: selected === t.slug ? '#1d1a16' : 'transparent' }}>
            <span style={{ color: BIND_COLOR[t._binding], flexShrink: 0, width: 10 }}>{BIND_MARK[t._binding]}</span>
            <span style={{ color: '#9a9286', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            <span style={{ color: '#5a5249', fontSize: 10, flexShrink: 0 }}>{t.goal_date || ''}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#5a5249', paddingTop: 8 }}>no tasks</div>}
      </div>
    </div>
  );
}
