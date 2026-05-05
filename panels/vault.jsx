// panels/vault.jsx — Sub-screen 3 left: vault file tree + on-demand preview

function VaultPanel({ highlightedFile, onFileClick }) {
  const { data: tree, error } = usePoll(fetchVaultTree, 60000);
  const [preview, setPreview]       = React.useState(null);
  const [previewPath, setPreviewPath] = React.useState(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('vault-collapsed') || '{}'); }
    catch { return {}; }
  });
  const [fontSize, setFontSize] = React.useState(() => {
    return parseInt(localStorage.getItem('vault-font-size') || '10', 10);
  });
  const changeFontSize = (delta) => setFontSize(prev => {
    const next = Math.max(8, Math.min(24, prev + delta));
    localStorage.setItem('vault-font-size', String(next));
    return next;
  });

  const toggleFolder = React.useCallback((folder) => {
    setCollapsed(prev => {
      const next = { ...prev, [folder]: prev[folder] !== false ? false : true };
      localStorage.setItem('vault-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSelect = React.useCallback((path) => {
    if (path === previewPath) return;
    setPreviewPath(path);
    setLoadingPreview(true);
    fetchVaultFile(path)
      .then(content => { setPreview(content); setLoadingPreview(false); })
      .catch(() => { setPreview('(error loading file)'); setLoadingPreview(false); });
    if (onFileClick) onFileClick(path);
  }, [previewPath, onFileClick]);

  const byFolder = React.useMemo(() => {
    const map = {};
    (tree || []).forEach(item => {
      const f = item.folder || '';
      if (!map[f]) map[f] = [];
      map[f].push(item);
    });
    return map;
  }, [tree]);

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Tree pane */}
      <div style={{ width: '40%', borderRight: '1px solid #1d1a16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0 }}>
          <E path="panel.vault" fallback="Vault" style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}/>
          {error && <span style={{ color: '#c95a52', marginLeft: 8 }}>⚠</span>}
        </div>
        <div className="vault-tree" style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {Object.keys(byFolder).sort().map(folder => (
            <div key={folder}>
              {folder && (
                <div
                  onClick={() => toggleFolder(folder)}
                  style={{ padding: '4px 16px', fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', display: 'flex', gap: 4, userSelect: 'none' }}
                >
                  <span>{collapsed[folder] !== false ? '▶' : '▼'}</span>
                  {folder}/
                </div>
              )}
              {(collapsed[folder] === false || !folder) && byFolder[folder].map(item => {
                const isHighlighted = item.path === highlightedFile;
                const isSelected    = item.path === previewPath;
                return (
                  <div key={item.path} onClick={() => handleSelect(item.path)} style={{
                    padding: '3px 16px 3px 24px', cursor: 'pointer',
                    background: isHighlighted ? 'rgba(108,154,90,0.12)' : isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: isHighlighted ? '#6c9a5a' : isSelected ? '#e8e3d8' : '#9a9286',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {isHighlighted && <span style={{ color: '#c96442', fontSize: 9 }}>↞</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  </div>
                );
              })}
            </div>
          ))}

        </div>
      </div>
      {/* Preview pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', flexShrink: 0, color: '#5a5249', fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewPath || 'select a file'}
            {loadingPreview && ' …'}
          </span>
          {previewPath && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => changeFontSize(-1)} style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 5px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>A−</button>
              <button onClick={() => changeFontSize(1)}  style={{ background: 'transparent', border: '1px solid #2a2520', color: '#5a5249', borderRadius: 2, padding: '0 5px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>A+</button>
            </div>
          )}
        </div>
        <pre className="preview-pane" style={{ flex: 1, overflow: 'auto', padding: '12px 16px', margin: 0, fontSize: fontSize, color: '#9a9286', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {preview || (previewPath ? '' : '← select a file to preview')}
        </pre>
      </div>
    </div>
  );
}
