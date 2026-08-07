// Shared helpers for all three TtfPanel variants.
// Globals exposed: TTF_helpers (all utility funcs)

const TTF_TAG_TO_MODE = {
  'work':       'available',
  'deep-work':  'deep-work',
  'transit':    'transit',
  'health':     'relaxing',
  'relaxing':   'relaxing',
  'social':     'transit',
  'sleeping':   'sleeping',
};

// Same MODE_COLORS values as zelda-frame, redeclared because that file
// declares them locally without exporting.
const TTF_MODE_COLORS = {
  'available': '#6c9a5a',
  'deep-work': '#c95a52',
  'transit':   '#d4a84a',
  'relaxing':  '#5fa0a8',
  'sleeping':  '#6b8ec8',
};

// Convert "HH:MM" → fractional hour (e.g. "09:30" → 9.5).
// Returns null if missing/invalid.
function TTF_timeToHours(t) {
  if (!t || typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

// Format fractional hour back to a label "9 AM" / "10:30 PM" etc.
function TTF_formatHour(h) {
  const hr = Math.floor(h);
  const mins = Math.round((h - hr) * 60);
  const period = hr >= 12 ? 'PM' : 'AM';
  const displayHr = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return mins === 0 ? `${displayHr}${period}` : `${displayHr}:${String(mins).padStart(2, '0')}${period}`;
}

// Parse YYYY-MM-DD into a midnight-local Date.
function TTF_parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Days between two YYYY-MM-DD strings (b - a).
function TTF_daysBetween(a, b) {
  const ms = TTF_parseDate(b).getTime() - TTF_parseDate(a).getTime();
  return Math.round(ms / 86400000);
}

// Human day-of-week label (short).
function TTF_dowShort(s) {
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][TTF_parseDate(s).getDay()];
}
function TTF_dayOfMonth(s) {
  return TTF_parseDate(s).getDate();
}

// Build the 7-day window starting today.
function TTF_weekDays() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const pad = n => String(n).padStart(2, '0');
    days.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`);
  }
  return days;
}

// Today YYYY-MM-DD.
function TTF_todayStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// Current fractional hour.
function TTF_nowHours() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

// Resolve a balloon color for an event using its category field.
// Falls back to gold if category is absent or unrecognised.
function TTF_eventColor(ev) {
  const cat = (ev.category || '').toLowerCase();
  if (cat) {
    if (TTF_MODE_COLORS[cat]) return TTF_MODE_COLORS[cat];
    const mode = TTF_TAG_TO_MODE[cat];
    if (mode) return TTF_MODE_COLORS[mode];
  }
  return window.THEME?.palette?.gold || '#d4b76a';
}

// Expand a recurring event's rrule into concrete dates within [from, to].
// Supports FREQ=DAILY, WEEKLY (with optional BYDAY), MONTHLY, YEARLY.
function TTF_expandRrule(ev, fromStr, toStr) {
  if (!ev.rrule) return [ev.date];
  const from = TTF_parseDate(fromStr);
  const to   = TTF_parseDate(toStr);
  const seed = TTF_parseDate(ev.date);
  const pad  = n => String(n).padStart(2, '0');
  const fmt  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const DOW = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
  const freq  = (ev.rrule.match(/FREQ=(\w+)/)   || [])[1];
  const byDay = (ev.rrule.match(/BYDAY=([^;]+)/) || [])[1];
  const until = (ev.rrule.match(/UNTIL=(\d{8})/) || [])[1];
  const untilDate = until
    ? new Date(+until.slice(0,4), +until.slice(4,6)-1, +until.slice(6,8))
    : null;

  const results = [];
  const cap = new Date(Math.min(to.getTime(), untilDate ? untilDate.getTime() : Infinity));

  if (freq === 'WEEKLY' && byDay) {
    const targetDows = byDay.split(',').map(d => DOW[d.trim().slice(-2)]).filter(d => d !== undefined);
    const cur = new Date(from);
    cur.setDate(cur.getDate() - cur.getDay()); // back to Sunday of from-week
    while (cur <= cap) {
      for (const dow of targetDows) {
        const candidate = new Date(cur);
        candidate.setDate(cur.getDate() + dow);
        if (candidate >= from && candidate <= cap && candidate >= seed) {
          results.push(fmt(candidate));
        }
      }
      cur.setDate(cur.getDate() + 7);
    }
  } else if (freq === 'DAILY') {
    const cur = new Date(Math.max(seed.getTime(), from.getTime()));
    while (cur <= cap) { results.push(fmt(cur)); cur.setDate(cur.getDate() + 1); }
  } else if (freq === 'MONTHLY') {
    const cur = new Date(seed);
    while (cur <= cap) {
      if (cur >= from) results.push(fmt(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (freq === 'YEARLY') {
    const cur = new Date(seed);
    while (cur <= cap) {
      if (cur >= from) results.push(fmt(cur));
      cur.setFullYear(cur.getFullYear() + 1);
    }
  } else {
    // Unknown freq — just return the seed if it falls in range
    if (seed >= from && seed <= to) results.push(ev.date);
  }
  return results;
}

// Group events by date string, separating timed vs untimed.
// Expands recurrences into the visible window [fromStr, toStr].
function TTF_groupByDay(events, fromStr, toStr) {
  const f = fromStr || TTF_todayStr();
  const pad = n => String(n).padStart(2, '0');
  const tDate = toStr ? TTF_parseDate(toStr) : new Date(TTF_parseDate(f).getTime() + 14 * 86400000);
  const t = `${tDate.getFullYear()}-${pad(tDate.getMonth()+1)}-${pad(tDate.getDate())}`;

  const byDay = {};
  for (const ev of events) {
    const dates = ev.rrule ? TTF_expandRrule(ev, f, t) : [ev.date];
    for (const date of dates) {
      if (!byDay[date]) byDay[date] = { timed: [], untimed: [] };
      const instance = { ...ev, date };
      if (TTF_timeToHours(ev.start_time) != null) byDay[date].timed.push(instance);
      else byDay[date].untimed.push(instance);
    }
  }
  for (const d in byDay) {
    byDay[d].timed.sort((a, b) => TTF_timeToHours(a.start_time) - TTF_timeToHours(b.start_time));
  }
  return byDay;
}

// Compute the time-axis range needed for a given event list, with min 6–23.
function TTF_computeRange(events, baseMin = 6, baseMax = 23) {
  let min = baseMin, max = baseMax;
  for (const ev of events) {
    const s = TTF_timeToHours(ev.start_time);
    const e = TTF_timeToHours(ev.end_time);
    if (s != null && s < min) min = Math.floor(s);
    if (e != null && e > max) max = Math.ceil(e);
    if (s != null && s > max) max = Math.ceil(s);
  }
  return { min, max };
}

// Hour labels every 2 hours within the range.
function TTF_hourTicks(min, max) {
  const ticks = [];
  for (let h = Math.ceil(min); h <= Math.floor(max); h += 2) ticks.push(h);
  return ticks;
}

window.TTF_helpers = {
  TAG_TO_MODE: TTF_TAG_TO_MODE,
  MODE_COLORS: TTF_MODE_COLORS,
  timeToHours: TTF_timeToHours,
  formatHour: TTF_formatHour,
  parseDate: TTF_parseDate,
  daysBetween: TTF_daysBetween,
  dowShort: TTF_dowShort,
  dayOfMonth: TTF_dayOfMonth,
  weekDays: TTF_weekDays,
  todayStr: TTF_todayStr,
  nowHours: TTF_nowHours,
  eventColor: TTF_eventColor,
  groupByDay: TTF_groupByDay,
  computeRange: TTF_computeRange,
  hourTicks: TTF_hourTicks,
};
