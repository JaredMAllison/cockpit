// editable.jsx — LabelsContext + E component + useLabels hook + template store
// Port of handoff editable.jsx + LabelsContext/E from panels.jsx

const TEMPLATES_LS_KEY = 'cockpit_templates_v1';
const ACTIVE_TEMPLATE_LS_KEY = 'cockpit_active_template_v1';

const BUILT_IN_TEMPLATES = {
  'OoT Faithful': {
    'subscreen.s1': 'Quest Status', 'subscreen.s2': 'Map', 'subscreen.s3': 'Items',
    'panel.projects': 'Quest Log', 'panel.marlin': 'Hero Status',
    'panel.ttf': 'Time of Day', 'panel.quickhacks': 'Equipment',
    'panel.vault': 'Inventory', 'panel.ariel': 'Navi',
  },
  'Cockpit Default': {
    'subscreen.s1': 'Status', 'subscreen.s2': 'Field', 'subscreen.s3': 'Navigation',
    'panel.projects': 'projects', 'panel.marlin': 'marlin',
    'panel.ttf': 'time factory', 'panel.quickhacks': 'quickhacks',
    'panel.vault': 'vault', 'panel.ariel': 'ariel',
  },
  'Plain English': {
    'subscreen.s1': "What I'm Doing", 'subscreen.s2': 'When', 'subscreen.s3': 'Find & Ask',
    'panel.projects': 'Projects', 'panel.marlin': 'Today',
    'panel.ttf': 'Timeline', 'panel.quickhacks': 'Mode',
    'panel.vault': 'Vault', 'panel.ariel': 'Chat',
  },
};

function _loadTemplates() {
  try {
    const user = JSON.parse(localStorage.getItem(TEMPLATES_LS_KEY) || '{}');
    return { ...BUILT_IN_TEMPLATES, ...user };
  } catch { return { ...BUILT_IN_TEMPLATES }; }
}
function _saveUserTemplates(user) {
  try { localStorage.setItem(TEMPLATES_LS_KEY, JSON.stringify(user)); } catch {}
}
function _loadActiveName() {
  try { return localStorage.getItem(ACTIVE_TEMPLATE_LS_KEY) || 'OoT Faithful'; } catch { return 'OoT Faithful'; }
}
function _saveActiveName(name) {
  try { localStorage.setItem(ACTIVE_TEMPLATE_LS_KEY, name); } catch {}
}

function useLabels() {
  const [activeName, setActiveName] = React.useState(_loadActiveName);
  const [labels, setLabels] = React.useState(() => _loadTemplates()[_loadActiveName()] || BUILT_IN_TEMPLATES['OoT Faithful']);
  const [allTemplates, setAllTemplates] = React.useState(_loadTemplates);

  const switchTemplate = React.useCallback((name) => {
    const all = _loadTemplates();
    if (!all[name]) return;
    setActiveName(name); _saveActiveName(name);
    setLabels(all[name]); setAllTemplates(all);
  }, []);

  const setLabel = React.useCallback((key, value) => {
    setLabels(prev => {
      const next = { ...prev, [key]: value };
      if (!BUILT_IN_TEMPLATES[activeName]) {
        const user = JSON.parse(localStorage.getItem(TEMPLATES_LS_KEY) || '{}');
        user[activeName] = next;
        _saveUserTemplates(user);
        setAllTemplates(_loadTemplates());
      }
      return next;
    });
  }, [activeName]);

  const saveAs = React.useCallback((name) => {
    if (!name) return;
    const user = JSON.parse(localStorage.getItem(TEMPLATES_LS_KEY) || '{}');
    user[name] = { ...labels };
    _saveUserTemplates(user); _saveActiveName(name);
    setActiveName(name); setAllTemplates(_loadTemplates());
  }, [labels]);

  return [labels, setLabel, { activeName, switchTemplate, saveAs, allTemplates, isBuiltIn: !!BUILT_IN_TEMPLATES[activeName] }];
}

// ─── LabelsContext ──────────────────────────────────────────────────────
const LabelsContext = React.createContext({ get: (k, f) => f, set: () => {}, editing: false });

function LabelsProvider({ editing, children }) {
  const [labels, setLabel, templateApi] = useLabels();
  const value = React.useMemo(() => ({
    get: (path, fallback) => labels[path] !== undefined ? labels[path] : (fallback ?? ''),
    set: setLabel,
    editing,
    templateApi,
  }), [labels, setLabel, editing, templateApi]);
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

// ─── E — editable text wrapper ──────────────────────────────────────────
function E({ path, fallback, style, multiline = false, prefix, suffix }) {
  const ctx = React.useContext(LabelsContext);
  const value = ctx.get(path, fallback);
  if (!ctx.editing) return <span style={style}>{prefix}{value}{suffix}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', ...style }}>
      {prefix}
      <span
        contentEditable suppressContentEditableWarning spellCheck={false}
        onBlur={e => ctx.set(path, e.currentTarget.textContent)}
        onKeyDown={e => {
          if (!multiline && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); }
        }}
        onClick={e => e.stopPropagation()}
        style={{ outline: 'none', background: 'rgba(255,230,100,.06)', boxShadow: '0 0 0 1px rgba(255,230,100,.35)', borderRadius: 2, padding: '0 3px', margin: '0 -3px', cursor: 'text', minWidth: 12, color: 'inherit' }}
      >{value}</span>
      {suffix}
    </span>
  );
}
