// panels/projects.jsx — Sub-screen 1 left: live project list
// Polls GET :7833/api/projects every 60s.
// Data shape: [{ slug, title, priority, status, brief, phase_current, phase_index, phase_total, task_current, tasks_done, tasks_total, completion_pct }]

const PANEL_FONT_MONO = '"Berkeley Mono","JetBrains Mono","IBM Plex Mono",ui-monospace,monospace';
const PRIORITY_COLOR  = { 1: '#c96442', 2: '#5fa0a8', 3: '#5a5249' };

function ProjectsPanel() {
  const { data: projects, error } = usePoll(fetchProjects, 60000);
  const ctx = React.useContext(LabelsContext);

  const list = projects || [];

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: PANEL_FONT_MONO, fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <E path="panel.projects" fallback="Projects"/>
        </span>
        <span style={{ fontSize: 10, color: '#5a5249' }}>
          {list.length} active
          {error && ' · ⚠ unreachable'}
        </span>
      </div>
      {/* List */}
      <div className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
        {list.map((proj, i) => {
          const color = PRIORITY_COLOR[proj.priority] || '#5a5249';
          return (
            <div key={proj.slug} style={{ padding: '8px 0', borderBottom: i < list.length - 1 ? '1px solid #1d1a16' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, flex: 1 }}>
                  <span style={{ color: '#5a5249', fontSize: 9, flexShrink: 0 }}>P{proj.priority}</span>
                  <span style={{ color: '#e8e3d8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.title}</span>
                </div>
                <span style={{ color: '#5a5249', fontSize: 9, flexShrink: 0, marginLeft: 8 }}>
                  {proj.phase_index && proj.phase_total ? `${proj.phase_index}/${proj.phase_total}` : ''}
                </span>
              </div>
              {proj.phase_current && (
                <div style={{ color: '#9a9286', fontSize: 10, marginBottom: 2 }}>{proj.phase_current}</div>
              )}
              {proj.task_current && (
                <div style={{ color: '#5a5249', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {proj.task_current}</div>
              )}
              {/* Progress bar */}
              <div style={{ marginTop: 5, height: 2, background: '#1d1a16', borderRadius: 1 }}>
                <div style={{ height: 2, width: `${proj.completion_pct || 0}%`, background: color, borderRadius: 1, transition: 'width 0.5s' }}/>
              </div>
            </div>
          );
        })}
        {list.length === 0 && !error && (
          <div style={{ color: '#5a5249', fontSize: 10, paddingTop: 16 }}>no active projects</div>
        )}
      </div>
    </div>
  );
}
