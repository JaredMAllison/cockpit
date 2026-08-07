// buttons/ButtonRail.jsx

const ButtonRailContext = React.createContext(null);

function useButtonRailSlot(edge) {
  const ctx = React.useContext(ButtonRailContext);
  // Re-render once when ButtonRail finishes mounting (refs populated)
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (ctx?.mounted && !ready) setReady(true);
  }, [ctx?.mounted, ready]);
  if (!ctx?.mounted) return null;
  const map = { top: ctx.topRef, bottom: ctx.bottomRef, left: ctx.leftRef, right: ctx.rightRef };
  return map[edge]?.current || null;
}

function ButtonRail({ children }) {
  const { theme } = useTheme();
  const p = theme.palette;
  const topRef    = React.useRef(null);
  const bottomRef = React.useRef(null);
  const leftRef   = React.useRef(null);
  const rightRef  = React.useRef(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const ctx = { topRef, bottomRef, leftRef, rightRef, mounted };

  const hEdge = (ref, area, borderProp) => ({
    ref,
    className: 'rail-edge',
    style: {
      gridArea: area,
      display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10,
      background: p.feltInner,
      [borderProp]: `1px solid ${p.goldDeep}`,
      padding: '0 12px', minHeight: 38,
    },
  });

  const vEdge = (ref, area, borderProp) => ({
    ref,
    className: 'rail-edge',
    style: {
      gridArea: area,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: p.feltInner,
      [borderProp]: `1px solid ${p.goldDeep}`,
      padding: '8px 0', minWidth: 38,
    },
  });

  return (
    <ButtonRailContext.Provider value={ctx}>
      <div style={{
        width: '100%', height: '100%',
        display: 'grid',
        gridTemplateAreas: '"top top top" "left content right" "bottom bottom bottom"',
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateColumns: 'auto 1fr auto',
      }}>
        <div {...hEdge(topRef,    'top',    'borderBottom')} />
        <div {...vEdge(leftRef,   'left',   'borderRight')} />
        <div style={{ gridArea: 'content', overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
        <div {...vEdge(rightRef,  'right',  'borderLeft')} />
        <div {...hEdge(bottomRef, 'bottom', 'borderTop')} />
      </div>
    </ButtonRailContext.Provider>
  );
}

Object.assign(window, { ButtonRail, useButtonRailSlot, ButtonRailContext });
