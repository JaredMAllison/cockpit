// ink-blotter.jsx — multi-tool creative panel
// Sketch | Notes | Docs | Diagrams — saves to vault InkBlotter/{tool}/ + appends Inbox.md

const INK_COLORS = {
  bg: '#0e0c0a', surface: '#16130f', border: '#2a2520',
  text: '#e8e3d8', textDim: '#5a5249', accent: '#6c9a5a', accentDim: '#3a5a2e',
  active: '#2a5040',
  tool: '#1d1a16', toolHover: '#2a2520', toolActive: '#c96442',
  tab: '#1a1a1a', tabActive: '#2a5040',
  canvas: '#1a1814',
};

const PALETTE = ['#e8e3d8','#c95a52','#c96442','#d4a84a','#6c9a5a','#5a8ab8','#8a6aba','#2a2520'];
const PEN_SIZES = [2, 5, 10];
const TOOLS = ['sketch', 'notes', 'docs', 'diagrams'];
const TOOL_LABELS = { sketch: 'Sketch', notes: 'Notes', docs: 'Docs', diagrams: 'Flow' };
const TOOL_ICONS = { sketch: '\u270E', notes: '\u2630', docs: '\u270D', diagrams: '\u2B21' };

function InkBlotterPanel() {
  const [tool, setTool]          = React.useState('sketch');
  const [saved, setSaved]        = React.useState(null);
  const [saving, setSaving]      = React.useState(false);

  const panelRef = React.useRef(null);

  const notify = (msg) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2500);
  };

  const doSave = async (folder, filename, content, inboxNote) => {
    setSaving(true);
    try {
      const path = `InkBlotter/${folder}/${filename}`;
      await writeVaultFile(path, content);
      if (inboxNote) await appendInbox(inboxNote);
      notify(`Saved → ${path}`);
    } catch (e) {
      notify(`Save failed: ${e.message}`);
    }
    setSaving(false);
  };

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return (
    <div ref={panelRef} style={{ width: '100%', height: '100%', background: INK_COLORS.bg, color: INK_COLORS.text, fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', display: 'flex', flexDirection: 'column', fontSize: 12 }}>
      {/* Tool tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${INK_COLORS.border}`, flexShrink: 0 }}>
        {TOOLS.map(t => (
          <button key={t} onClick={() => setTool(t)}
            style={{
              flex: 1, padding: '10px 0', cursor: 'pointer', border: 'none',
              background: tool === t ? INK_COLORS.tabActive : INK_COLORS.tab,
              color: tool === t ? INK_COLORS.text : INK_COLORS.textDim,
              fontFamily: 'inherit', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
              borderBottom: tool === t ? `2px solid ${INK_COLORS.accent}` : `2px solid transparent`,
              fontWeight: tool === t ? 600 : 400,
            }}
          >{TOOL_ICONS[t]}  {TOOL_LABELS[t]}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {tool === 'sketch'  && <SketchCanvas onSave={(c,n) => doSave('Sketch',c,n)} saving={saving} notify={notify} />}
        {tool === 'notes'   && <NotesPad onSave={(c,n) => doSave('Notes',c,n)} saving={saving} notify={notify} />}
        {tool === 'docs'    && <DocsPad onSave={(c,n) => doSave('Docs',c,n)} saving={saving} notify={notify} />}
        {tool === 'diagrams' && <DiagramCanvas onSave={(c,n) => doSave('Diagrams',c,n)} saving={saving} notify={notify} />}
      </div>

      {/* Status bar */}
      <div style={{ height: 24, borderTop: `1px solid ${INK_COLORS.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0 }}>
        <span style={{ color: saved ? INK_COLORS.accent : INK_COLORS.textDim, fontSize: 10 }}>{saved || '\u00A0'}</span>
        {saving && <span style={{ color: INK_COLORS.textDim, fontSize: 10, marginLeft: 'auto' }}>saving...</span>}
      </div>
    </div>
  );
}

// ─── Sketch (canvas drawing) ─────────────────────────────────────

function SketchCanvas({ onSave, saving, notify }) {
  const canvasRef = React.useRef(null);
  const [drawing, setDrawing]  = React.useState(false);
  const [color, setColor]      = React.useState(PALETTE[0]);
  const [size, setSize]        = React.useState(PEN_SIZES[1]);
  const [eraser, setEraser]    = React.useState(false);
  const [strokes, setStrokes]  = React.useState([]);
  const [undoStack, setUndo]   = React.useState([]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width / rect.width;
    const sy = canvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const startDraw = (e) => {
    const pos = getPos(e);
    setDrawing(true);
    const stroke = { points: [pos], color: eraser ? INK_COLORS.canvas : color, size: eraser ? size * 3 : size };
    setStrokes(s => [...s, stroke]);
  };

  const draw = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    setStrokes(s => {
      const copy = [...s];
      const last = { ...copy[copy.length - 1], points: [...copy[copy.length - 1].points, pos] };
      copy[copy.length - 1] = last;
      return copy;
    });
  };

  const endDraw = () => {
    setDrawing(false);
    setUndo(u => [...u, strokes.length]);
  };

  const clearCanvas = () => {
    setStrokes([]);
    setUndo([]);
  };

  const undoLast = () => {
    if (undoStack.length === 0) return;
    const lastLen = undoStack[undoStack.length - 1];
    setUndo(u => u.slice(0, -1));
    setStrokes(s => s.slice(0, lastLen - 1));
  };

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = INK_COLORS.canvas;
    ctx.fillRect(0, 0, c.width, c.height);
    for (const s of strokes) {
      if (s.points.length < 2) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  const saveSketch = () => {
    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const filename = `sketch-${ts()}.png`;
    const inboxNote = `[InkBlotter] Sketch saved: InkBlotter/Sketch/${filename}`;
    onSave(filename, dataUrl, inboxNote);
  };

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* Left toolbar */}
      <div style={{ width: 44, flexShrink: 0, borderRight: `1px solid ${INK_COLORS.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 2px', background: INK_COLORS.surface }}>
        <button onClick={undoLast} style={tbBtnStyle()} title="Undo stroke">↩</button>
        <button onClick={clearCanvas} style={tbBtnStyle()} title="Clear">✕</button>
        <div style={{ width: 24, height: 1, background: INK_COLORS.border, margin: '4px 0' }}/>
        {PEN_SIZES.map(s => (
          <button key={s} onClick={() => setSize(s)} style={tbBtnStyle(size === s)} title={`Pen ${s}px`}>
            <div style={{ width: s + 4, height: s + 4, borderRadius: '50%', background: INK_COLORS.text }}/>
          </button>
        ))}
        <div style={{ width: 24, height: 1, background: INK_COLORS.border, margin: '4px 0' }}/>
        {PALETTE.map(c => (
          <button key={c} onClick={() => { setColor(c); setEraser(false); }} style={{ ...tbBtnStyle(color === c && !eraser), background: c, width: 22, height: 22, borderRadius: 12, border: `2px solid ${color === c && !eraser ? INK_COLORS.accent : 'transparent'}` }}/>
        ))}
        <div style={{ width: 24, height: 1, background: INK_COLORS.border, margin: '4px 0' }}/>
        <button onClick={() => setEraser(!eraser)} style={tbBtnStyle(eraser)} title="Eraser">◇</button>
        <div style={{ flex: 1 }}/>
        <button onClick={saveSketch} disabled={saving} style={tbBtnStyle(false, INK_COLORS.accent)} title="Save">{saving ? '...' : '↓'}</button>
      </div>
      {/* Canvas */}
      <canvas ref={canvasRef} width={800} height={600}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        style={{ flex: 1, cursor: drawing ? 'crosshair' : 'default', display: 'block' }}
      />
    </div>
  );
}

// ─── Notes (textarea scratchpad) ──────────────────────────────────

function NotesPad({ onSave, saving, notify }) {
  const [text, setText] = React.useState(() => localStorage.getItem('ink-notes') || '');

  React.useEffect(() => { localStorage.setItem('ink-notes', text); }, [text]);

  const saveNotes = () => {
    const filename = `note-${ts()}.md`;
    const inboxNote = `[InkBlotter] Note saved: InkBlotter/Notes/${filename}`;
    onSave(filename, text.trim(), inboxNote);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <textarea value={text} onChange={e => setText(e.target.value)}
        style={{
          flex: 1, resize: 'none', border: 'none', outline: 'none', padding: 16,
          background: INK_COLORS.canvas, color: INK_COLORS.text,
          fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6,
        }}
        placeholder="Write whatever comes to mind..."
      />
      <div style={{ padding: '6px 12px', borderTop: `1px solid ${INK_COLORS.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={saveNotes} disabled={saving || !text.trim()}
          style={{ padding: '4px 14px', background: INK_COLORS.accent, color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
          {saving ? 'Saving...' : 'Save to Vault'}
        </button>
        <span style={{ color: INK_COLORS.textDim, fontSize: 10 }}>{text.length} chars</span>
      </div>
    </div>
  );
}

// ─── Docs (rich text word processor) ──────────────────────────────

function DocsPad({ onSave, saving, notify }) {
  const editorRef = React.useRef(null);
  const [html, setHtml] = React.useState(() => localStorage.getItem('ink-docs') || '');

  React.useEffect(() => {
    if (editorRef.current && html) editorRef.current.innerHTML = html;
  }, []);

  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      const h = editorRef.current.innerHTML;
      setHtml(h);
      localStorage.setItem('ink-docs', h);
    }
  };

  const saveDocs = () => {
    const text = editorRef.current?.innerText || '';
    if (!text.trim()) return;
    const filename = `doc-${ts()}.md`;
    const md = `# ${filename.replace('.md','')}\n\n${text.trim()}`;
    const inboxNote = `[InkBlotter] Doc saved: InkBlotter/Docs/${filename}`;
    onSave(filename, md, inboxNote);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Formatting toolbar */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: `1px solid ${INK_COLORS.border}`, background: INK_COLORS.surface, flexWrap: 'wrap' }}>
        {[
          ['B','bold'],['I','italic'],['U','underline'],
          ['H1','formatBlock','h3'],['H2','formatBlock','h4'],['H3','formatBlock','h5'],
        ].map(([label, cmd, val]) => (
          <button key={label} onMouseDown={e => { e.preventDefault(); exec(cmd, val || null); }}
            style={{ padding: '3px 8px', background: INK_COLORS.tool, color: INK_COLORS.text, border: `1px solid ${INK_COLORS.border}`, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: label === 'B' ? 700 : 400 }}
          >{label}</button>
        ))}
      </div>
      {/* Editor */}
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={() => { const h = editorRef.current.innerHTML; setHtml(h); localStorage.setItem('ink-docs', h); }}
        style={{
          flex: 1, padding: 16, outline: 'none', overflow: 'auto',
          background: INK_COLORS.canvas, color: INK_COLORS.text,
          fontFamily: '"Cormorant Garamond","Georgia",serif', fontSize: 15, lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div style={{ padding: '6px 12px', borderTop: `1px solid ${INK_COLORS.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={saveDocs} disabled={saving}
          style={{ padding: '4px 14px', background: INK_COLORS.accent, color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
          {saving ? 'Saving...' : 'Save to Vault'}
        </button>
        <button onClick={() => { setHtml(''); localStorage.setItem('ink-docs', ''); if (editorRef.current) editorRef.current.innerHTML = ''; }}
          style={{ padding: '3px 8px', background: 'transparent', color: INK_COLORS.textDim, border: `1px solid ${INK_COLORS.border}`, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}>Clear</button>
      </div>
    </div>
  );
}

// ─── Diagrams (shape-based flow chart) ────────────────────────────

function DiagramCanvas({ onSave, saving, notify }) {
  const canvasRef = React.useRef(null);
  const [mode, setMode]     = React.useState('rect');
  const [shapes, setShapes] = React.useState([]);
  const [dragging, setDrag] = React.useState(null);
  const [dragOff, setDragOff] = React.useState({ x: 0, y: 0 });

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width / rect.width;
    const sy = canvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const clickCanvas = (e) => {
    if (dragging) return;
    const pos = getPos(e);
    const w = 100, h = 60;
    setShapes(s => [...s, { type: mode, x: pos.x - w/2, y: pos.y - h/2, w, h, label: '' }]);
  };

  const mouseDown = (e) => {
    const pos = getPos(e);
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (pos.x >= s.x && pos.x <= s.x + s.w && pos.y >= s.y && pos.y <= s.y + s.h) {
        setDrag(i);
        setDragOff({ x: pos.x - s.x, y: pos.y - s.y });
        return;
      }
    }
  };

  const mouseMove = (e) => {
    if (dragging === null) return;
    const pos = getPos(e);
    setShapes(s => {
      const copy = [...s];
      copy[dragging] = { ...copy[dragging], x: pos.x - dragOff.x, y: pos.y - dragOff.y };
      return copy;
    });
  };

  const mouseUp = () => setDrag(null);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = INK_COLORS.canvas;
    ctx.fillRect(0, 0, c.width, c.height);

    for (const s of shapes) {
      ctx.strokeStyle = INK_COLORS.accent;
      ctx.lineWidth = 2;
      ctx.fillStyle = `${INK_COLORS.accent}22`;

      if (s.type === 'rect') {
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      } else if (s.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(s.x + s.w/2, s.y + s.h/2, s.w/2, s.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
      } else if (s.type === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(s.x + s.w/2, s.y);
        ctx.lineTo(s.x + s.w, s.y + s.h/2);
        ctx.lineTo(s.x + s.w/2, s.y + s.h);
        ctx.lineTo(s.x, s.y + s.h/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (s.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + s.h/2);
        ctx.lineTo(s.x + s.w, s.y + s.h/2);
        ctx.stroke();
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(s.x + s.w, s.y + s.h/2);
        ctx.lineTo(s.x + s.w - 12, s.y + s.h/2 - 6);
        ctx.lineTo(s.x + s.w - 12, s.y + s.h/2 + 6);
        ctx.closePath();
        ctx.fill();
      }

      // Label
      if (s.label) {
        ctx.fillStyle = INK_COLORS.text;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.label, s.x + s.w/2, s.y + s.h/2);
      }
    }
  }, [shapes]);

  const addLabel = () => {
    const label = prompt('Enter shape label:');
    if (label && shapes.length > 0) {
      setShapes(s => {
        const copy = [...s];
        copy[copy.length - 1] = { ...copy[copy.length - 1], label };
        return copy;
      });
    }
  };

  const clearDiagrams = () => setShapes([]);

  const saveDiagrams = () => {
    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const filename = `diagram-${ts()}.png`;
    // Save a text companion too
    const desc = shapes.map((s, i) => `${i+1}. ${s.type} at (${Math.round(s.x)},${Math.round(s.y)}) label="${s.label}"`).join('\n');
    const descContent = `# Diagram: ${filename}\n\n${desc || '(empty diagram)'}`;
    const inboxNote = `[InkBlotter] Diagram saved: InkBlotter/Diagrams/${filename}`;
    onSave(filename, dataUrl, inboxNote);
    // Also save description text
    writeVaultFile(`InkBlotter/Diagrams/diagram-${ts()}.md`, descContent).catch(() => {});
  };

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* Left toolbar */}
      <div style={{ width: 44, flexShrink: 0, borderRight: `1px solid ${INK_COLORS.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 2px', background: INK_COLORS.surface }}>
        {[
          ['rect','▬'],['circle','●'],['diamond','◆'],['arrow','→'],
        ].map(([m, icon]) => (
          <button key={m} onClick={() => setMode(m)} style={tbBtnStyle(mode === m)} title={m}>{icon}</button>
        ))}
        <div style={{ width: 24, height: 1, background: INK_COLORS.border, margin: '4px 0' }}/>
        <button onClick={addLabel} style={tbBtnStyle()} title="Label last shape">T</button>
        <button onClick={clearDiagrams} style={tbBtnStyle()} title="Clear">✕</button>
        <div style={{ flex: 1 }}/>
        <button onClick={saveDiagrams} disabled={saving} style={tbBtnStyle(false, INK_COLORS.accent)} title="Save">{saving ? '...' : '↓'}</button>
      </div>
      {/* Canvas */}
      <canvas ref={canvasRef} width={800} height={600}
        onClick={clickCanvas} onMouseDown={mouseDown} onMouseMove={mouseMove} onMouseUp={mouseUp}
        style={{ flex: 1, cursor: dragging !== null ? 'grabbing' : 'crosshair', display: 'block' }}
      />
    </div>
  );
}

// ─── Shared button style ──────────────────────────────────────────

function tbBtnStyle(active = false, accent) {
  return {
    width: 32, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? INK_COLORS.toolActive : INK_COLORS.tool,
    color: active ? '#fff' : INK_COLORS.text,
    border: accent ? `1px solid ${accent}` : `1px solid ${INK_COLORS.border}`,
    borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
    transition: 'all 0.1s',
  };
}

window.InkBlotterPanel = InkBlotterPanel;