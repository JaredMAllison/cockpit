// TtfPanel — Variant 2: "Moonlit Atelier"
//
// Same three-zone metaphor as the source, but reimagined as a moonlit
// glassworks. The inspection zone is framed in brass with corner brackets,
// not warning stripes. Balloons become paper lanterns with a soft inner
// glow. The belt is a wooden crate-rail with iron straps. Side previews
// fade into a deep blue parchment haze (instead of pure black mesh).

// Non-React: read from window.THEME (mirrored by ThemeProvider in cockpit,
// set by the theme .js wrapper for standalone TTF use).
const _TTF_p = window.THEME?.palette || {
  gold: '#d4b76a', goldDim: '#8a7a3e', goldDeep: '#5a4d24',
  parchText: '#f4e8c8', parchTextDim: '#c8b896',
};
const _TTF_f = window.THEME?.fonts || {};
const _TTF_pixel = _TTF_f.pixel || '"VT323", "Press Start 2P", "Courier New", monospace';

// Fetch window geometry. The window follows the belt, not the calendar.
//
// TTF_WINDOW_BAND      days fetched either side of the anchor day
// TTF_REANCHOR_DRIFT   how far the belt may drift from the anchor before the
//                      window is re-anchored (and refetched)
//
// The stage draws five zones — centerOffset-2 .. centerOffset+2 — so the hard
// minimum coverage is ±2 days from wherever the belt is. Allowing the belt to
// drift DRIFT days from the anchor means the band must be at least DRIFT+2.
// 21 vs 14 leaves a week of slack past the worst case: a fortnight of arrow
// paging in either direction is free, and any jump beyond that costs exactly
// one refetch because re-anchoring re-centres the window on the new day.
const TTF_WINDOW_BAND    = 21;
const TTF_REANCHOR_DRIFT = 14;

function TtfPanel(props) {
  const tweaks = props.tweaks || {};
  const showGround = tweaks.showGround !== false;
  const labelMode  = tweaks.labelMode || 'tag';
  const bobbing    = tweaks.bobbing !== false;

  const H = window.TTF_helpers;

  // Day offsets are always relative to TODAY. That keeps every date label and
  // every warp target on one origin no matter where the fetch window sits —
  // only the window moves. dayOffsetToDateStr is also handed to Ttf2Stage,
  // which maps centerOffset-2..+2 through it, so its origin must not drift.
  const today = H.todayStr();
  function dayOffsetToDateStr(off) {
    const d = H.parseDate(today);
    d.setDate(d.getDate() + off);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 900, h: 650 });
  const [selectedEvent, setSelectedEvent] = React.useState(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(es => {
      const r = es[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const zoneW = size.w / 3;
  const ctrl = useTtfBeltController({ zoneWidth: zoneW });

  // The window the CURRENT data was fetched for. Hysteresis lives here: the
  // belt is free to move within ±TTF_REANCHOR_DRIFT of the anchor without
  // costing a request, and only a move past that re-anchors and refetches.
  // Anchoring on the live centerOffset instead would refetch on every arrow
  // press; anchoring on today (the old behaviour) drew empty days for any
  // task outside the initial fortnight.
  const [anchorOffset, setAnchorOffset] = React.useState(0);
  React.useEffect(() => {
    if (Math.abs(ctrl.centerOffset - anchorOffset) > TTF_REANCHOR_DRIFT) {
      setAnchorOffset(ctrl.centerOffset);
    }
  }, [ctrl.centerOffset, anchorOffset]);

  const fromStr = dayOffsetToDateStr(anchorOffset - TTF_WINDOW_BAND);
  const toStr   = dayOffsetToDateStr(anchorOffset + TTF_WINDOW_BAND);

  const ttfFetchRef = React.useRef(null);
  ttfFetchRef.current = () => fetchTtfEvents(fromStr, toStr);

  // anchorOffset is passed as an extra dep so a re-anchor refetches NOW.
  // Reassigning ttfFetchRef.current alone would not — usePoll deliberately
  // ignores fetchFn identity, so the new window would not land until the
  // next 30s tick and the belt would show an empty day until then.
  const { data, error } = usePoll(() => ttfFetchRef.current(), 30000, [anchorOffset]);
  const events = data || [];

  // Drive the belt from outside. warpTo has existed since the belt controller
  // was written and had no caller until now.
  // Keyed on focusSeq, not focusDate: re-clicking the same already-focused
  // task must re-warp even though the date string is unchanged (e.g. after
  // the operator pages the belt away by hand with ctrl.advance). focusSeq is
  // a monotonic counter bumped once per click in app.jsx, so it changes
  // exactly once per selection and never spuriously on unrelated re-renders.
  React.useEffect(() => {
    if (!props.focusDate) return;
    const target = H.parseDate(props.focusDate);
    const base   = H.parseDate(today);
    const offset = Math.round((target - base) / 86400000);
    ctrl.warpTo(offset);
  }, [props.focusSeq]);

  // RAF render loop — drives belt animation, sway, bob.
  //
  // Every subscreen in app.jsx stays MOUNTED for the life of the session and is
  // hidden with display:none (app.jsx:124-128). So this loop kept forcing a
  // full React re-render of the belt at 60fps the entire time the operator was
  // on Quest, Items, Ink or Health — which, on a cockpit meant to stay open all
  // day, is most of the day.
  //
  // document.hidden does not cover that: the browser throttles rAF for a hidden
  // TAB, never for a display:none subtree inside a visible one. Panel-level
  // visibility has to be observed directly, and IntersectionObserver reports
  // display:none as not-intersecting and fires only on change — so the check
  // costs nothing per frame. Reading offsetParent in the loop would also work
  // and would force a layout flush sixty times a second, trading one cost for
  // another.
  const onScreenRef = React.useRef(true);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(es => {
      onScreenRef.current = es[es.length - 1].isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    let id;
    // The loop stays SCHEDULED while hidden and only skips the render, so
    // returning to the panel resumes on the next frame with no restart logic.
    // A skipped frame is one boolean read and one property read; the render it
    // replaces is a full reconciliation of the belt subtree.
    const loop = () => {
      if (onScreenRef.current && !document.hidden) force();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  const { shift: beltShift, sway } = ctrl.get();

  // Same window as the fetch, always. groupByDay is what expands recurrences
  // into concrete days, so a wider grouping window than the fetch invents
  // nothing and a narrower one silently drops days the belt can reach.
  const byDay = H.groupByDay(events, fromStr, toStr);

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at 50% -10%, #1a2740 0%, #0a1320 55%, #050810 100%)',
      color: _TTF_p.parchText, fontFamily: _TTF_pixel,
      position: 'relative', overflow: 'hidden',
    }}>
      <Ttf2Stage
        size={size} zoneW={zoneW}
        beltShift={beltShift} sway={sway} centerOffset={ctrl.centerOffset}
        byDay={byDay} dayOffsetToDateStr={dayOffsetToDateStr}
        showGround={showGround} labelMode={labelMode} bobbing={bobbing}
        onLanternClick={setSelectedEvent}
        empty={events.length === 0 && !error} error={error}
      />
      <div style={{
        position: 'absolute', top: 6, left: 6,
        fontFamily: _TTF_pixel, fontSize: 9, letterSpacing: 1,
        color: error ? '#c95a52' : '#a08a52',
        background: 'rgba(0,0,0,0.4)', padding: '1px 5px',
        border: `1px solid ${error ? '#5a2020' : '#5a4a28'}`,
      }}>
        {error ? '⚠ UNREACHABLE' : `${events.length} EVENTS`}
      </div>
      <TtfNavBar ctrl={ctrl} accent="#c9a558"/>
      {selectedEvent && (
        <TtfEventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)}/>
      )}
    </div>
  );
}

function Ttf2Stage({ size, zoneW, beltShift, sway, centerOffset,
                     byDay, dayOffsetToDateStr,
                     showGround, labelMode, bobbing, onLanternClick,
                     empty }) {
  const H = window.TTF_helpers;
  const { w, h } = size;
  if (w < 100 || h < 100) return null;

  const BELT_H      = showGround ? 60 : 0;
  const BELT_Y      = h - BELT_H;
  const FRAME_W     = 6;
  const TOP_BAND_H  = 22;
  const TIME_FLOOR  = 6, TIME_CEIL = 23;
  const FLOAT_TOP   = TOP_BAND_H + 36;
  const FLOAT_RANGE = BELT_Y - FLOAT_TOP - 36;
  const LANTERN_W   = 30, LANTERN_H = 38;

  function timeToFloatY(t) {
    const v = H.timeToHours(t);
    if (v == null) return BELT_Y - LANTERN_H * 0.6;
    const norm = Math.max(0, Math.min(1, (v - TIME_FLOOR) / (TIME_CEIL - TIME_FLOOR)));
    return BELT_Y - 36 - norm * FLOAT_RANGE;
  }

  const zones = [-2,-1,0,1,2].map(i => {
    const offset = centerOffset + i;
    const dateStr = dayOffsetToDateStr(offset);
    return { offset, dateStr, isCenter: i === 0,
             dayData: byDay[dateStr] || { timed: [], untimed: [] },
             centerX: w / 2 + i * zoneW + beltShift + centerOffset * zoneW };
  });

  function place(zone) {
    const usable = zoneW * 0.78;
    const left = zone.centerX - usable / 2;
    const scale = zone.isCenter ? 1 : 0.7;
    const list = zone.dayData.timed.map((ev, idx) => {
      const seed = ((ev.id || ev.title).split('').reduce((a,c)=>a*31+c.charCodeAt(0),11) + idx * 2654435761) >>> 0;
      return {
        ev, x: left + LANTERN_W*scale + (seed % 1000)/1000 * (usable - LANTERN_W*scale*2),
        y: timeToFloatY(ev.start_time), scale,
        suppressLabel: false,
      };
    });
    list.sort((a,b) => a.x - b.x);
    const minD = LANTERN_W * scale * 1.05;
    for (let i = 1; i < list.length; i++) {
      const dy = Math.abs(list[i].y - list[i-1].y);
      if (dy < LANTERN_H * scale) list[i].x = Math.max(list[i].x, list[i-1].x + minD);
    }
    // Suppress labels when neighbouring lanterns are close enough to overlap them
    for (let i = 0; i < list.length; i++) {
      const labelW = Math.min(list[i].ev.title.length, 18) * 6 * scale + 10 * scale;
      const tooCloseLeft  = i > 0 && (list[i].x - list[i-1].x) < labelW;
      const tooCloseRight = i < list.length - 1 && (list[i+1].x - list[i].x) < labelW;
      if (tooCloseLeft || tooCloseRight) list[i].suppressLabel = true;
    }
    return list;
  }

  const bobTime = bobbing ? performance.now() / 1400 : 0;

  const cur = zones.find(z => z.isCenter);
  const labelText = cur.offset === 0
    ? 'TODAY · ' + H.parseDate(cur.dateStr).toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()
    : H.parseDate(cur.dateStr).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}).toUpperCase();

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      <defs>
        <radialGradient id="ttf2-moon" cx="0.5" cy="0" r="0.6">
          <stop offset="0" stopColor="rgba(220,220,255,0.10)"/>
          <stop offset="1" stopColor="rgba(220,220,255,0)"/>
        </radialGradient>
        <radialGradient id="ttf2-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(255,220,150,0.55)"/>
          <stop offset="0.6" stopColor="rgba(255,200,120,0.18)"/>
          <stop offset="1" stopColor="rgba(255,200,120,0)"/>
        </radialGradient>
      </defs>

      {/* moon-glow on inspection zone */}
      <rect x={zoneW} y={0} width={zoneW} height={BELT_Y} fill="#0a1422"/>
      <rect x={zoneW} y={0} width={zoneW} height={BELT_Y} fill="url(#ttf2-moon)"/>

      {/* belt */}
      {showGround && <Ttf2Belt w={w} y={BELT_Y} h={BELT_H} shift={beltShift}/>}

      {/* day labels */}
      {zones.map(z => (
        <text key={`l${z.offset}`} x={z.centerX} y={BELT_Y - 9}
              textAnchor="middle" fontSize="11"
              fill={z.isCenter ? '#d4b76a' : 'rgba(212,183,106,0.28)'}
              fontFamily="monospace"
              letterSpacing="1">
          {H.parseDate(z.dateStr).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase()}
        </text>
      ))}

      {/* untimed banner: parchment ribbon */}
      <Ttf2UntimedBanner
        events={cur.dayData.untimed}
        x={zoneW + FRAME_W} y={TOP_BAND_H + 4} width={zoneW - FRAME_W * 2}/>

      {/* lanterns */}
      {zones.map(z => {
        const placed = place(z);
        return (
          <g key={`b${z.offset}`} opacity={z.isCenter ? 1 : 0.42}>
            {placed.map((p,i) => (
              <Ttf2Lantern key={p.ev.id || i} p={p} index={i}
                           beltY={BELT_Y} bobTime={bobTime} sway={sway}
                           labelMode={labelMode} isCenter={z.isCenter}
                           onLanternClick={onLanternClick}/>
            ))}
          </g>
        );
      })}

      {/* preview haze */}
      <rect x={0} y={0} width={zoneW} height={BELT_Y} fill="rgba(8,12,28,0.55)"/>
      <rect x={zoneW * 2} y={0} width={zoneW} height={BELT_Y} fill="rgba(8,12,28,0.55)"/>

      {/* brass frame around inspection zone */}
      <Ttf2Frame zoneW={zoneW} h={BELT_Y} TOP_BAND_H={TOP_BAND_H} FRAME_W={FRAME_W}
                 labelText={labelText}/>

      {/* preview hint labels */}
      <text x={zoneW/2} y={28} textAnchor="middle" fontFamily="monospace"
            fontSize="10" letterSpacing="3" fill="rgba(180,160,110,0.35)">◀ YESTERDAY</text>
      <text x={zoneW*2 + zoneW/2} y={28} textAnchor="middle" fontFamily="monospace"
            fontSize="10" letterSpacing="3" fill="rgba(180,160,110,0.35)">TOMORROW ▶</text>

      {empty && (
        <text x={w/2} y={h/2} textAnchor="middle" fontFamily="monospace"
              fontSize="13" letterSpacing="3" fill="rgba(212,183,106,0.30)">
          ◇ ATELIER QUIET TONIGHT ◇
        </text>
      )}
    </svg>
  );
}

function Ttf2Belt({ w, y, h, shift }) {
  // wooden plank conveyor with iron straps every 60px
  const plankW = 60;
  const o = ((shift % plankW) + plankW) % plankW;
  const planks = [];
  for (let x = -plankW + o; x < w + plankW; x += plankW) {
    planks.push(
      <g key={x}>
        <rect x={x} y={y + 4} width={plankW - 2} height={h - 8} fill="#3a2a1c"/>
        <rect x={x} y={y + 4} width={plankW - 2} height={2} fill="#5a4028"/>
        <rect x={x + plankW - 6} y={y + 4} width={3} height={h - 8} fill="#1c1208"/>
      </g>
    );
  }
  return (
    <g>
      <rect x={0} y={y} width={w} height={h} fill="#1c1208"/>
      {planks}
      <line x1={0} y1={y} x2={w} y2={y} stroke="#5a4028" strokeWidth="2"/>
      <line x1={0} y1={y+h-2} x2={w} y2={y+h-2} stroke="#0a0604" strokeWidth="2"/>
    </g>
  );
}

function Ttf2Frame({ zoneW, h, TOP_BAND_H, FRAME_W, labelText }) {
  const cl = zoneW, cr = zoneW * 2;
  return (
    <g>
      {/* top band — brass with subtle gradient */}
      <rect x={cl - FRAME_W} y={0} width={zoneW + FRAME_W*2} height={TOP_BAND_H} fill="#5a4a28"/>
      <rect x={cl - FRAME_W} y={0} width={zoneW + FRAME_W*2} height={2} fill="#a08a52"/>
      <rect x={cl - FRAME_W} y={TOP_BAND_H - 2} width={zoneW + FRAME_W*2} height={2} fill="#1c1208"/>
      {/* pillars */}
      <rect x={cl - FRAME_W} y={TOP_BAND_H} width={FRAME_W} height={h - TOP_BAND_H} fill="#5a4a28"/>
      <rect x={cl - FRAME_W} y={TOP_BAND_H} width={2} height={h - TOP_BAND_H} fill="#a08a52"/>
      <rect x={cr} y={TOP_BAND_H} width={FRAME_W} height={h - TOP_BAND_H} fill="#5a4a28"/>
      <rect x={cr + FRAME_W - 2} y={TOP_BAND_H} width={2} height={h - TOP_BAND_H} fill="#a08a52"/>
      {/* corner brackets */}
      {[[cl-FRAME_W, TOP_BAND_H, 1, 1], [cr+FRAME_W, TOP_BAND_H, -1, 1]].map(([x,y,sx,sy], i) => (
        <g key={i}>
          <rect x={x} y={y} width={14*sx} height={2} fill="#d4b76a"/>
          <rect x={x} y={y} width={2*sx} height={14} fill="#d4b76a"/>
        </g>
      ))}
      {/* label inside top band */}
      <text x={cl + zoneW/2} y={TOP_BAND_H/2 + 4}
            textAnchor="middle" fontFamily="monospace"
            fontSize="11" letterSpacing="3" fill="#d4b76a">
        {labelText}
      </text>
    </g>
  );
}

function Ttf2UntimedBanner({ events, x, y, width }) {
  if (!events || !events.length) return null;
  const items = events.slice(0, 2);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={width} height={20}
            fill="rgba(212,183,106,0.10)"
            stroke="#a08a52" strokeWidth="0.7" strokeDasharray="3 2"/>
      <text x={6} y={14} fontFamily="monospace" fontSize="10"
            fill="#d4b76a" letterSpacing="1.2">
        ✦ {items.map(e => e.title).join('  ·  ')}
      </text>
    </g>
  );
}

function Ttf2Lantern({ p, index, beltY, bobTime, sway, labelMode, isCenter, onLanternClick }) {
  const H = window.TTF_helpers;
  const { ev, x, y, scale, suppressLabel } = p;
  const color = H.eventColor(ev);
  const w = 28 * scale, h = 36 * scale;
  const bobOff = Math.sin(bobTime + index * 0.7) * 6 * scale;
  const swayX  = sway * (beltY - y) * 0.6;
  const cx = x + swayX, cy = y + bobOff;

  const labelVisible = !suppressLabel && (
    labelMode === 'tag'
    || (labelMode === 'today' && isCenter)
    || labelMode === 'always'
  );
  const tagText = ev.title.length > 18 ? ev.title.slice(0,17)+'…' : ev.title;
  const tagFs = 10 * scale;
  const tagW = tagText.length * 6 * scale + 10 * scale;
  const tagH = 14 * scale;

  const handleClick = onLanternClick ? () => onLanternClick(ev) : undefined;

  return (
    <g onClick={handleClick} style={{ cursor: onLanternClick ? 'pointer' : 'default' }}>
      {/* string from belt up to lantern top */}
      <path d={`M ${x} ${beltY} Q ${(x+cx)/2 + swayX*0.4} ${(beltY + cy)/2} ${cx} ${cy + h/2}`}
            stroke="#8a7a3e" strokeWidth={1.2 * scale} fill="none" opacity="0.7"/>
      {/* glow halo */}
      <circle cx={cx} cy={cy} r={Math.max(w,h)} fill="url(#ttf2-glow)" opacity={isCenter ? 0.65 : 0.35}/>
      {/* lantern body — slim hexagon */}
      <g transform={`translate(${cx} ${cy})`}>
        <path d={`M ${-w/2} ${-h*0.35} L ${-w/2} ${h*0.35} L 0 ${h/2} L ${w/2} ${h*0.35} L ${w/2} ${-h*0.35} L 0 ${-h/2} Z`}
              fill={color} opacity="0.85"
              stroke="#3a2814" strokeWidth={0.6 * scale}/>
        {/* paper-panel highlight */}
        <path d={`M ${-w/2 + 2} ${-h*0.30} L ${-w/2 + 2} ${h*0.30}`}
              stroke="rgba(255,240,200,0.45)" strokeWidth={1.2 * scale} fill="none"/>
        {/* top cap */}
        <rect x={-w*0.4} y={-h/2 - 3*scale} width={w*0.8} height={3*scale} fill="#3a2814"/>
        {/* bottom tassel */}
        <rect x={-w*0.18} y={h/2} width={w*0.36} height={4*scale} fill="#3a2814"/>
        <line x1={0} y1={h/2 + 4*scale} x2={0} y2={h/2 + 9*scale}
              stroke="#3a2814" strokeWidth={0.8 * scale}/>
      </g>
      {/* tag charm hanging below tassel */}
      {labelVisible && (
        <g>
          <rect x={cx - tagW/2} y={cy + h/2 + 12*scale}
                width={tagW} height={tagH} rx={2*scale}
                fill="#1a1208" stroke={color} strokeWidth={0.6 * scale}/>
          <text x={cx} y={cy + h/2 + 12*scale + tagH/2 + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontFamily="monospace" fontSize={tagFs}
                fill="#d4b76a">{tagText}</text>
        </g>
      )}
    </g>
  );
}

function TtfEventDetail({ event: ev, onClose }) {
  const H = window.TTF_helpers;
  const color = H.eventColor(ev);
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0,
      background: 'rgba(5,8,16,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, cursor: 'pointer',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0d1828',
        border: `2px solid ${color}`,
        boxShadow: `0 0 24px ${color}44`,
        padding: '20px 28px', minWidth: 260, maxWidth: 380,
        fontFamily: _TTF_pixel, cursor: 'default',
        position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 8, right: 10,
          background: 'none', border: 'none', color: _TTF_p.parchTextDim,
          fontSize: 16, cursor: 'pointer', lineHeight: 1,
        }}>✕</button>
        <div style={{ color, fontSize: 10, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
          {ev.category || 'event'}
        </div>
        <div style={{ color: _TTF_p.parchText, fontSize: 15, letterSpacing: 1, marginBottom: 12, lineHeight: 1.4 }}>
          {ev.title}
        </div>
        {(ev.date || ev.start_time) && (
          <div style={{ color: _TTF_p.parchTextDim, fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>
            {ev.date}{ev.start_time ? ` · ${ev.start_time}` : ''}{ev.end_time ? `–${ev.end_time}` : ''}
          </div>
        )}
        {ev.description && (
          <div style={{ color: _TTF_p.parchTextDim, fontSize: 11, letterSpacing: 0.5, lineHeight: 1.5, marginTop: 8, borderTop: `1px solid ${_TTF_p.goldDeep}`, paddingTop: 8 }}>
            {ev.description}
          </div>
        )}
      </div>
    </div>
  );
}

window.TtfPanel = TtfPanel;
