// buttons/ThemeToggleButton.jsx — Rail button to cycle chrome themes
// Plugs into ButtonRail via useButtonRailSlot('bottom'). Cycles through available themes.

function ThemeToggleButton() {
  const { theme, setTheme, availableThemes } = useTheme();
  const currentIdx = availableThemes.findIndex(t => t.id === theme.id);

  const nextTheme = () => {
    const next = (currentIdx + 1) % availableThemes.length;
    setTheme(availableThemes[next].id);
  };

  const slot = useButtonRailSlot('bottom');
  if (!slot) return null;

  const content = (
    <button
      onClick={nextTheme}
      title={`Theme: ${theme.name} (click to cycle)`}
      style={{
        order: 0,
        background: theme.palette.tabBg,
        border: `1px solid ${theme.palette.goldDeep}`,
        color: theme.palette.gold,
        fontFamily: theme.fonts.pixel, fontSize: 11, letterSpacing: 1,
        padding: '3px 10px', cursor: 'pointer', height: 26,
        transition: 'all 0.12s',
      }}
    >
      {theme.name.toUpperCase()}
    </button>
  );

  return ReactDOM.createPortal(content, slot);
}

Object.assign(window, { ThemeToggleButton });
