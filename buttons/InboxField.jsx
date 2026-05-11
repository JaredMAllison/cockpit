// buttons/InboxField.jsx

function InboxField() {
  const [value, setValue]   = React.useState('');
  const [flash, setFlash]   = React.useState(false);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    fetch('/api/vault/append-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(r => r.json())
      .then(() => {
        setValue('');
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      })
      .catch(() => {});
  };

  const slot = useButtonRailSlot('bottom');
  if (!slot) return null;

  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 420 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') e.target.blur();
        }}
        placeholder="capture..."
        style={{
          flex: 1, background: 'rgba(0,0,0,.4)', border: `1px solid ${ZELDA.goldDeep}`,
          color: ZELDA.parchText, fontFamily: ZELDA_FONT_PIXEL, fontSize: 13,
          padding: '4px 10px', outline: 'none', height: 26,
        }}
        onFocus={e => { e.target.style.borderColor = ZELDA.gold; }}
        onBlur={e  => { e.target.style.borderColor = ZELDA.goldDeep; }}
      />
      {flash && (
        <span style={{ color: '#6c9a5a', fontFamily: ZELDA_FONT_PIXEL, fontSize: 14, lineHeight: 1 }}>
          ✓
        </span>
      )}
    </div>
  );

  return ReactDOM.createPortal(content, slot);
}

Object.assign(window, { InboxField });
