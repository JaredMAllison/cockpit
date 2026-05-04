// subscreen-transition.jsx — 220ms cross-fade + 12px slide, chrome stays fixed.
// Direction: forward (quest→map→items) slides right-to-left; backward slides left-to-right.

const SUBSCREEN_ORDER = ['quest', 'map', 'items'];

function SubscreenTransition({ active, children }) {
  const [displayed, setDisplayed] = React.useState(active);
  const [phase, setPhase] = React.useState('idle'); // idle | out | in
  const [direction, setDirection] = React.useState(1); // 1 = forward, -1 = backward
  const pendingRef = React.useRef(active);

  React.useEffect(() => {
    if (active === displayed) return;
    const fromIdx = SUBSCREEN_ORDER.indexOf(displayed);
    const toIdx   = SUBSCREEN_ORDER.indexOf(active);
    setDirection(toIdx > fromIdx ? 1 : -1);
    pendingRef.current = active;
    setPhase('out');
  }, [active]);

  const handleTransitionEnd = React.useCallback(() => {
    if (phase === 'out') {
      setDisplayed(pendingRef.current);
      setPhase('in');
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('idle')));
    }
  }, [phase]);

  const slideOut = `translateX(${direction * -12}px)`;
  const slideIn  = `translateX(${direction * 12}px)`;

  const style = {
    width: '100%', height: '100%',
    transition: phase !== 'idle' ? 'opacity 220ms ease-out, transform 220ms ease-out' : 'none',
    opacity:   phase === 'out' ? 0 : 1,
    transform: phase === 'out' ? slideOut : phase === 'in' ? slideIn : 'translateX(0)',
  };

  return (
    <div style={style} onTransitionEnd={handleTransitionEnd}>
      {children}
    </div>
  );
}
