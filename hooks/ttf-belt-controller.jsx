// Shared belt controller — frame-driven via ref, NO per-frame setState (caller
// owns the render loop). Returns a stable object with .get() that reads the
// current eased values.
//
// Models the source's three-zone day metaphor:
//   [ LEFT preview · yesterday | CENTER inspection · today | RIGHT preview · tomorrow ]

const TTF_DAY_INTRO_MS = 1200;

function useTtfBeltController({ zoneWidth }) {
  const stateRef = React.useRef({
    centerOffset: 0,
    targetShift: 0,
    shift: 0,
    swayAmp: 0,
    lastAdvanceMs: -10000,
    introStart: null,
  });
  const [centerOffset, setCenterOffset] = React.useState(0);

  // RAF that updates the ref (caller renders separately)
  React.useEffect(() => {
    let id;
    const ease = t => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2);
    const tick = (ts) => {
      const s = stateRef.current;
      if (s.introStart === null) s.introStart = ts;
      const introT = Math.min(1, (ts - s.introStart) / TTF_DAY_INTRO_MS);
      if (introT < 1) {
        const e = ease(introT);
        s.shift = zoneWidth * (1 - e) + s.targetShift * e;
      } else {
        const diff = s.targetShift - s.shift;
        if (Math.abs(diff) > 0.4) s.shift += diff * 0.18;
        else s.shift = s.targetShift;
      }
      // sway decay
      s.swayAmp *= 0.94;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [zoneWidth]);

  function get() {
    const s = stateRef.current;
    const sinceAdv = performance.now() - s.lastAdvanceMs;
    const sway = s.swayAmp * Math.sin(sinceAdv / 110);
    return { shift: s.shift, sway };
  }

  function advance(dir) {
    if (!dir) return;
    const next = stateRef.current.centerOffset + dir;
    stateRef.current.centerOffset = next;
    stateRef.current.targetShift = -next * zoneWidth;
    stateRef.current.swayAmp = -dir * 0.22;
    stateRef.current.lastAdvanceMs = performance.now();
    setCenterOffset(next);
  }
  function warpTo(off) {
    stateRef.current.centerOffset = off;
    stateRef.current.targetShift = -off * zoneWidth;
    stateRef.current.swayAmp = 0;
    stateRef.current.lastAdvanceMs = performance.now();
    setCenterOffset(off);
  }

  return { centerOffset, get, advance, warpTo };
}

window.useTtfBeltController = useTtfBeltController;
