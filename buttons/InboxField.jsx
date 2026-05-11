// buttons/InboxField.jsx

function InboxField() {
  const [value, setValue]     = React.useState('');
  const [flash, setFlash]     = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const submitting  = React.useRef(false);
  const flashTimer  = React.useRef(null);

  React.useEffect(() => {
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || submitting.current) return;
    submitting.current = true;
    appendInbox(text)
      .then(() => {
        setValue('');
        setFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(false), 1200);
      })
      .catch(() => {})
      .finally(() => { submitting.current = false; });
  };

  const slot = useButtonRailSlot('bottom');
  if (!slot) return null;

  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 300, order: 1 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') e.target.blur();
        }}
        placeholder="capture..."
        style={{
          flex: 1, background: 'rgba(0,0,0,.4)',
          border: `1px solid ${focused ? ZELDA.gold : ZELDA.goldDeep}`,
          color: ZELDA.parchText, fontFamily: ZELDA_FONT_PIXEL, fontSize: 13,
          padding: '4px 10px', outline: 'none', height: 26,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
