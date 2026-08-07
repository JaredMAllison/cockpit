// theme-context.jsx — ThemeContext provider + useTheme() hook
// Replaces the hardcoded ZELDA global with a swappable theme system.

const ThemeContext = React.createContext(null);

const THEME_LS_KEY = 'cockpit_theme_v1';

function _loadThemeId() {
  try { return localStorage.getItem(THEME_LS_KEY) || 'oot'; }
  catch { return 'oot'; }
}

function _saveThemeId(id) {
  try { localStorage.setItem(THEME_LS_KEY, id); } catch {}
}

function ThemeProvider({ children }) {
  const themes = window.THEMES || {};
  const [themeId, setThemeId] = React.useState(_loadThemeId);

  const availableThemes = React.useMemo(() => {
    return Object.keys(themes).map(id => ({ id, ...themes[id] }));
  }, []);

  const theme = React.useMemo(() => {
    return themes[themeId] || themes.oot || availableThemes[0];
  }, [themeId, themes, availableThemes]);

  // Mirror to window.THEME synchronously — non-React consumers (ttf-helpers.js)
  // read this during first paint, so it must never be undefined.
  React.useMemo(() => {
    window.THEME = theme;
  }, [theme]);

  const setTheme = React.useCallback((id) => {
    if (!themes[id]) return;
    setThemeId(id);
    _saveThemeId(id);
    window.THEME = themes[id];
  }, [themes]);

  const value = React.useMemo(() => ({
    theme,
    setTheme,
    availableThemes,
  }), [theme, setTheme, availableThemes]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

Object.assign(window, { ThemeProvider, useTheme, ThemeContext });
