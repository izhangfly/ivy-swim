/* Ivy Swim Analytics — shared core.
   Data access, swimming maths, SVG charting, navigation, search. */
'use strict';

/* ============================ configuration ============================ */

const STROKES = ['Free', 'Back', 'Breast', 'Fly', 'IM'];
const STROKE_EN = { Free: 'Freestyle', Back: 'Backstroke', Breast: 'Breaststroke',
                    Fly: 'Butterfly', IM: 'Individual Medley' };
/* Reading STROKE_LABEL[x] yields the label in the active language. */
const STROKE_LABEL = new Proxy(STROKE_EN, {
  get: (o, k) => (typeof k === 'string' && o[k] !== undefined ? t(o[k]) : o[k]),
});
/* Validated categorical palette. Colour carries STROKE identity only;
   course (SCM vs LCM) is encoded by dash pattern + marker shape, never hue. */
const STROKE_COLOR = { Free: '#2a78d6', Back: '#eb6834', Breast: '#1baf7a',
                       Fly: '#eda100', IM: '#e87ba4' };
const COURSE_EN = { SCM: '25 m pool (short course)', LCM: '50 m pool (long course)' };
const COURSE_LABEL = new Proxy(COURSE_EN, {
  get: (o, k) => (typeof k === 'string' && o[k] !== undefined ? t(o[k]) : o[k]),
});

/* World-record base times, in seconds, used for World Aquatics points:
   P = 1000 · (B/T)³.  B is the current world record for that event+course.
   Events with no entry here simply score no points (shown as "—"). */
const WR = {
  'F|SCM': { '50Free':22.83,'100Free':49.93,'200Free':109.36,'400Free':230.25,'800Free':474.00,'1500Free':908.24,
             '50Back':25.23,'100Back':54.02,'200Back':117.33,
             '50Breast':28.37,'100Breast':62.36,'200Breast':132.50,
             '50Fly':23.72,'100Fly':52.71,'200Fly':119.32,
             '100IM':55.11,'200IM':121.63,'400IM':255.48 },
  'F|LCM': { '50Free':23.19,'100Free':51.68,'200Free':112.23,'400Free':234.18,'800Free':484.12,'1500Free':920.48,
             '50Back':26.56,'100Back':57.13,'200Back':123.14,
             '50Breast':29.16,'100Breast':64.13,'200Breast':137.55,
             '50Fly':24.43,'100Fly':54.33,'200Fly':121.65,
             '200IM':125.70,'400IM':263.65 },
  'M|SCM': { '50Free':19.90,'100Free':44.84,'200Free':98.61,'400Free':212.25,'800Free':440.46,'1500Free':846.88,
             '50Back':22.11,'100Back':48.16,'200Back':105.12,
             '50Breast':24.95,'100Breast':55.28,'200Breast':119.52,
             '50Fly':21.32,'100Fly':47.68,'200Fly':106.85,
             '100IM':49.28,'200IM':108.88,'400IM':234.81 },
  'M|LCM': { '50Free':20.88,'100Free':46.40,'200Free':102.00,'400Free':219.96,'800Free':452.12,'1500Free':870.67,
             '50Back':23.55,'100Back':51.60,'200Back':111.92,
             '50Breast':25.95,'100Breast':56.88,'200Breast':125.48,
             '50Fly':22.27,'100Fly':49.45,'200Fly':110.34,
             '200IM':112.69,'400IM':242.50 },
};
const WR_ASOF = 'world records as of September 2026';

/* Dynamically loaded scripts must carry the same cache-busting version as the
   ones stamped into the page. */
window.ASSET_V = (function () {
  const me = document.currentScript || [...document.scripts].find(s => /core\.js/.test(s.src));
  const m = me && /[?&]v=([^&]+)/.exec(me.src || '');
  return m ? m[1] : '';
})();

/* Whatever address this page was opened from is the address to share. */
const SITE_URL = (typeof location !== 'undefined' && location.origin)
  ? location.origin.replace(/\/$/, '') + '/' : '';

const ATHLETE = {
  name: 'Zhang Yijia',
  /* Set nameZh to the athlete's Chinese characters to show them in 中文 mode.
     Left empty on purpose: the romanisation is used until the characters are known. */
  nameZh: '',
  preferred: 'Ivy',
  birth: '2015-10-05',
};

const SETTINGS = {
  get gender() { return localStorage.getItem('ivy.gender') || 'F'; },
  set gender(v) { localStorage.setItem('ivy.gender', v); },
};

/** Decimal age, in years, on a given ISO date. */
function ageAt(iso, birth = ATHLETE.birth) {
  return (dayNum(iso) - dayNum(birth)) / 365.2425;
}
/** Age as competition age-group notation, e.g. "10y 11m". */
function ageLabel(iso, birth = ATHLETE.birth) {
  const b = new Date(birth + 'T00:00:00'), d = new Date(iso + 'T00:00:00');
  let y = d.getFullYear() - b.getFullYear();
  let mo = d.getMonth() - b.getMonth();
  if (d.getDate() < b.getDate()) mo--;
  if (mo < 0) { y--; mo += 12; }
  return LANG.get() === 'zh' ? `${y}岁${mo}个月` : `${y}y ${mo}m`;
}

/* ============================== formatting ============================== */

const fmt = {
  /** 83.96 -> "1:23.96";  42.41 -> "42.41" */
  time(s) {
    if (s == null || !isFinite(s)) return '—';
    if (s < 60) return s.toFixed(2);
    const m = Math.floor(s / 60), r = s - m * 60;
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
  },
  /** signed delta, seconds */
  delta(s, digits = 2) {
    if (s == null || !isFinite(s)) return '—';
    return (s > 0 ? '+' : s < 0 ? '−' : '') + Math.abs(s).toFixed(digits);
  },
  pct(x, digits = 1) {
    if (x == null || !isFinite(x)) return '—';
    return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(digits) + '%';
  },
  /** mean horizontal speed, m/s */
  speed(distance, seconds) { return distance / seconds; },
  /** pace expressed as time per 100 m */
  pace100(distance, seconds) { return seconds * 100 / distance; },
  date(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE(),
      { day: '2-digit', month: 'short', year: 'numeric' });
  },
  dateShort(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE(),
      { day: '2-digit', month: 'short' });
  },
  monthYear(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE(),
      { month: 'short', year: '2-digit' });
  },
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dayNum = iso => Math.round(new Date(iso + 'T00:00:00').getTime() / 86400000);

/* ============================ event identity ============================ */

/** A result's event key ignores course; eventKey includes it. */
const raceName = r => t('{0} m {1}', r.distance, STROKE_LABEL[r.stroke] || r.stroke);
const eventKey = r => `${r.distance}|${r.stroke}|${r.course}`;
const eventLabel = r => `${raceName(r)} · ${r.course}`;

/** Points per the World Aquatics cubic formula. Null when no base time exists. */
function waPoints(r, gender = SETTINGS.gender) {
  const base = (WR[`${gender}|${r.course}`] || {})[`${r.distance}${r.stroke}`];
  if (!base) return null;
  return Math.round(1000 * Math.pow(base / r.seconds, 3));
}

/* ============================== statistics ============================== */

/* two-sided 95% t critical values, df 1..30 then asymptotic */
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
             2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
             2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
const tCrit = df => df < 1 ? NaN : (df <= 30 ? T95[df - 1] : 1.96 + 2.4 / df);

/**
 * Ordinary least squares of ln(time) on years-since-first-swim.
 * Working in logs makes the slope a *proportional* rate, so events of very
 * different duration are directly comparable. Returns null for n < 3.
 */
function trendModel(rows) {
  const pts = rows.map(r => ({ x: (dayNum(r.date) - dayNum(rows[0].date)) / 365.25,
                               y: Math.log(r.seconds) }));
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); }
  if (sxx === 0) return null;
  const b = sxy / sxx, a = my - b * mx;
  let ssRes = 0, ssTot = 0;
  for (const p of pts) { ssRes += (p.y - (a + b * p.x)) ** 2; ssTot += (p.y - my) ** 2; }
  const df = n - 2;
  const se = df > 0 ? Math.sqrt(ssRes / df / sxx) : NaN;
  const tc = tCrit(df), half = tc * se;
  const asPct = v => (Math.exp(v) - 1) * 100;
  return {
    n, a, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1,
    ratePct: asPct(b),                       // % change in time per year
    loPct: asPct(b - half), hiPct: asPct(b + half),
    significant: isFinite(half) && Math.abs(b) > half,
    predict: years => Math.exp(a + b * years),
    t0: rows[0].date,
  };
}

/** Per-event summary used all over the site. */
function summarise(rows) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const best = sorted.reduce((m, r) => (r.seconds < m.seconds ? r : m), sorted[0]);
  const first = sorted[0], last = sorted[sorted.length - 1];
  const drop = first.seconds - best.seconds;
  return {
    rows: sorted, n: sorted.length, first, last, best,
    dropSec: drop, dropPct: (drop / first.seconds) * 100,
    spanDays: dayNum(last.date) - dayNum(first.date),
    model: trendModel(sorted),
    points: waPoints(best),
    speed: fmt.speed(best.distance, best.seconds),
    pace100: fmt.pace100(best.distance, best.seconds),
    ageAtBest: ageAt(best.date), ageAtFirst: ageAt(first.date),
  };
}

/** Mark each row that was a personal best for its event at the time it was swum. */
function tagProgression(rows) {
  const seen = new Map();
  return [...rows].sort((a, b) => a.date.localeCompare(b.date)).map(r => {
    const k = eventKey(r), prev = seen.get(k);
    const isPB = prev === undefined || r.seconds < prev;
    if (isPB) seen.set(k, r.seconds);
    return { ...r, wasPB: isPB, improvedBy: isPB && prev !== undefined ? prev - r.seconds : null };
  });
}

/* ============================== data store ============================== */

const store = {
  results: [], loaded: false, _wait: null,
  async load(force = false) {
    if (this.loaded && !force) return this.results;
    if (this._wait && !force) return this._wait;
    this._wait = fetch('/api/results').then(r => r.json()).then(j => {
      this.results = (j.results || []).map(r => ({ ...r, seconds: +r.seconds,
                                                   distance: +r.distance }));
      this.loaded = true; this._wait = null;
      return this.results;
    });
    return this._wait;
  },
  /** Map of eventKey -> summary, ordered by stroke then distance. */
  events(rows = this.results) {
    const g = new Map();
    for (const r of rows) {
      const k = eventKey(r);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(r);
    }
    const out = [...g.entries()].map(([k, rs]) => {
      const s = summarise(rs);
      const ev = { key: k, stroke: rs[0].stroke, distance: rs[0].distance,
                   course: rs[0].course, ...s };
      /* Resolved on read so an export can render in the other language. */
      Object.defineProperty(ev, 'label', {
        get: () => eventLabel(rs[0]), enumerable: true,
      });
      return ev;
    });
    out.sort((a, b) => (STROKES.indexOf(a.stroke) - STROKES.indexOf(b.stroke))
                    || (a.distance - b.distance)
                    || a.course.localeCompare(b.course));
    return out;
  },
  /** Meets are inferred from distinct race dates (the workbook has no meet names). */
  meets(rows = this.results) {
    const g = new Map();
    for (const r of rows) {
      if (!g.has(r.date)) g.set(r.date, []);
      g.get(r.date).push(r);
    }
    return [...g.entries()].map(([date, rs]) => ({
      date, rows: rs.sort((a, b) => STROKES.indexOf(a.stroke) - STROKES.indexOf(b.stroke)
                                 || a.distance - b.distance),
      name: rs.find(r => r.meet)?.meet || '',
      courses: [...new Set(rs.map(r => r.course))],
      metres: rs.reduce((a, r) => a + r.distance, 0),
    })).sort((a, b) => b.date.localeCompare(a.date));
  },
};

/* ============================== SVG charts ============================== */

const SVGNS = 'http://www.w3.org/2000/svg';
let _uid = 0;
const mk = (n, attrs = {}) => {
  const e = document.createElementNS(SVGNS, n);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
};

function starPath(cx, cy, ro, ri, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = (Math.PI / n) * i - Math.PI / 2;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' +
         (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}

/**
 * "Nice" tick steps for a linear axis. Picks the candidate step whose tick
 * count lands closest to the target — taking the first step >= the raw
 * interval systematically under-ticks (a span of 25 would give only 3).
 */
function ticks(lo, hi, target = 5) {
  const span = hi - lo || 1;
  const raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10].map(m => m * mag);
  let step = candidates[0], bestScore = Infinity;
  for (const c of candidates) {
    const score = Math.abs(Math.floor(span / c) - target);
    if (score < bestScore) { bestScore = score; step = c; }
  }
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/**
 * Interactive time-series chart.
 *  - Y axis is INVERTED for time charts (faster swims sit higher), which is the
 *    convention in swimming and is labelled on the axis so it cannot mislead.
 *  - Colour = stroke identity; dash = long course. Never colour-only.
 */
function lineChart(host, opt) {
  const o = Object.assign({
    height: 330, yFmt: fmt.time, yTitle: t('TIME  (faster ↑)'), invertY: true,
    bestIsMin: null,
    xFmt: v => fmt.monthYear(new Date(v * 86400000).toISOString().slice(0, 10)),
    xFmt2: null,        // optional second axis row, e.g. the calendar month
    animate: true, star: true, trend: false, refLine: null, margin: null,
    emptyMsg: t('No results in this selection.'),
  }, opt);
  /* On a time axis the best swim is the smallest number; on a points axis the
     largest. Default from the axis direction unless the caller overrides. */
  if (o.bestIsMin === null || o.bestIsMin === undefined) o.bestIsMin = o.invertY;
  const series = (o.series || []).filter(s => s.points && s.points.length);
  host.innerHTML = '';
  if (!series.length) {
    host.innerHTML = `<div class="status">${esc(o.emptyMsg)}</div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  host.appendChild(wrap);

  const W = Math.max(320, wrap.clientWidth || host.clientWidth || 720), H = o.height;
  const m = o.margin || { t: 16, r: 62, b: o.xFmt2 ? 50 : 34, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const all = series.flatMap(s => s.points);
  const xs = all.map(p => p.xv), ys = all.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 15; x1 += 15; }
  const xPad = (x1 - x0) * 0.04; x0 -= xPad; x1 += xPad;
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (o.refLine) { y0 = Math.min(y0, o.refLine.y); y1 = Math.max(y1, o.refLine.y); }
  const yPad = (y1 - y0 || Math.max(1, y1 * 0.05)) * 0.12; y0 -= yPad; y1 += yPad;

  const X = v => m.l + ((v - x0) / (x1 - x0)) * iw;
  const Y = v => o.invertY ? m.t + ((v - y0) / (y1 - y0)) * ih
                           : m.t + ih - ((v - y0) / (y1 - y0)) * ih;

  const svg = mk('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`,
                          role: 'img', 'aria-label': o.aria || 'Progression chart' });
  wrap.appendChild(svg);
  const uid = 'clip' + (++_uid);

  /* gridlines + y axis (solid hairlines) */
  const gAxis = mk('g', { class: 'axis' });
  svg.appendChild(gAxis);
  for (const tv of ticks(y0, y1, 5)) {
    gAxis.appendChild(mk('line', { class: 'gridline', x1: m.l, x2: m.l + iw,
                                   y1: Y(tv).toFixed(1), y2: Y(tv).toFixed(1) }));
    const lb = mk('text', { x: m.l - 8, y: Y(tv) + 4, 'text-anchor': 'end' });
    lb.textContent = o.yFmt(tv); gAxis.appendChild(lb);
  }
  /* x axis: one tick per quarter-ish */
  const xt = ticks(x0, x1, Math.min(6, Math.max(2, Math.round(iw / 110))));
  /* A short span can render the same month several times; show each label once. */
  let lastLabel = null;
  for (const tv of xt) {
    const text = o.xFmt(tv);
    if (text === lastLabel) continue;
    lastLabel = text;
    const lb = mk('text', { x: X(tv), y: m.t + ih + 20, 'text-anchor': 'middle' });
    lb.textContent = text;
    gAxis.appendChild(lb);
    if (o.xFmt2) {
      const lb2 = mk('text', { x: X(tv), y: m.t + ih + 34, 'text-anchor': 'middle',
                               style: 'font-size:10px;fill:#8b93a1' });
      lb2.textContent = o.xFmt2(tv);
      gAxis.appendChild(lb2);
    }
  }
  gAxis.appendChild(mk('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih }));
  if (o.yTitle) {
    const yt = mk('text', { x: 2, y: m.t - 5, 'text-anchor': 'start',
                            style: 'font-size:10px;letter-spacing:.08em;fill:#8b93a1' });
    yt.textContent = o.yTitle; gAxis.appendChild(yt);
  }

  /* dashed reference line (personal best / target) */
  if (o.refLine) {
    const y = Y(o.refLine.y);
    svg.appendChild(mk('line', { class: 'refline', x1: m.l, x2: m.l + iw, y1: y, y2: y,
                                 stroke: o.refLine.color || '#0F1E36' }));
    const rl = mk('text', { class: 'reflabel', x: m.l + 4, y: y - 5,
                            fill: o.refLine.color || '#0F1E36' });
    rl.textContent = o.refLine.label; svg.appendChild(rl);
  }

  /* animated reveal clip */
  const clip = mk('clipPath', { id: uid, clipPathUnits: 'userSpaceOnUse' });
  const clipRect = mk('rect', { x: m.l - 4, y: 0, width: o.animate ? 0 : iw + 70, height: H });
  clip.appendChild(clipRect); svg.appendChild(clip);
  const plot = mk('g', { 'clip-path': `url(#${uid})` });
  svg.appendChild(plot);

  const marks = [];      // for hover + staged reveal
  const endLabels = [];  // direct labels, de-collided below
  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.xv - b.xv);
    if (s.trend !== false && o.trend && pts.length >= 3) {
      const md = s.model;
      if (md) {
        const d0 = dayNum(md.t0);
        const p = pts.map(pt => `${X(pt.xv).toFixed(1)} ${Y(md.predict((pt.xv - d0) / 365.25)).toFixed(1)}`);
        plot.appendChild(mk('path', { class: 'trend', stroke: s.color,
                                      d: 'M' + p.join('L') }));
      }
    }
    if (pts.length > 1) {
      plot.appendChild(mk('path', {
        class: 'serie-line' + (s.course === 'LCM' ? ' lcm' : ''), stroke: s.color,
        d: 'M' + pts.map(p => `${X(p.xv).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('L') }));
    }
    const bestY = o.bestIsMin ? Math.min(...pts.map(p => p.y))
                              : Math.max(...pts.map(p => p.y));
    for (const p of pts) {
      const cx = X(p.xv), cy = Y(p.y), isBest = o.star && p.y === bestY;
      const g = mk('g', { opacity: o.animate ? 0 : 1 });
      if (isBest) {
        const st = mk('path', { class: 'pbstar', d: starPath(cx, cy, 9.5, 4.2) });
        g.appendChild(st);
        marks.push({ cx, cy, p, s, g, star: st });
      } else {
        g.appendChild(mk('circle', { class: 'pt', cx, cy, r: 4.5, fill: s.color }));
        marks.push({ cx, cy, p, s, g });
      }
      plot.appendChild(g);
    }
    /* selective direct label: the most recent swim of each series */
    const lastp = pts[pts.length - 1];
    const lb = mk('text', { class: 'dlabel', x: X(lastp.xv) + 11, y: Y(lastp.y) + 4,
                            fill: s.color, opacity: o.animate ? 0 : 1 });
    lb.textContent = o.yFmt(lastp.y);
    plot.appendChild(lb);
    endLabels.push({ el: lb, y: Y(lastp.y) + 4 });
    marks.push({ label: true, cx: X(lastp.xv), g: lb });
  }

  /* nudge overlapping end labels apart, keeping their vertical order */
  if (endLabels.length > 1) {
    endLabels.sort((a, b) => a.y - b.y);
    const MIN = 13;
    for (let i = 1; i < endLabels.length; i++) {
      const gap = endLabels[i].y - endLabels[i - 1].y;
      if (gap < MIN) {
        endLabels[i].y = endLabels[i - 1].y + MIN;
        endLabels[i].el.setAttribute('y', endLabels[i].y.toFixed(1));
      }
    }
    const overflow = endLabels[endLabels.length - 1].y - (m.t + ih);
    if (overflow > 0) for (const l of endLabels) {
      l.y -= overflow; l.el.setAttribute('y', l.y.toFixed(1));
    }
  }

  /* ---- hover: crosshair + tooltip ---- */
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.style.display = 'none';
  wrap.appendChild(tip);
  const cross = mk('line', { class: 'crosshair', y1: m.t, y2: m.t + ih, opacity: 0 });
  svg.appendChild(cross);
  const ring = mk('circle', { class: 'hover-ring', r: 10, opacity: 0 });
  svg.appendChild(ring);
  const hit = mk('rect', { class: 'hitline', x: m.l, y: m.t, width: iw, height: ih });
  svg.appendChild(hit);

  const scale = () => W / (svg.getBoundingClientRect().width || W);
  function hideTip() { tip.style.display = 'none'; cross.setAttribute('opacity', 0);
                       ring.setAttribute('opacity', 0); }
  function moveTip(ev) {
    const rect = svg.getBoundingClientRect(), k = scale();
    const mx = (ev.clientX - rect.left) * k, my = (ev.clientY - rect.top) * k;
    let best = null, bd = Infinity;
    for (const mk_ of marks) {
      if (mk_.label) continue;
      const d = (mk_.cx - mx) ** 2 + ((mk_.cy - my) ** 2) * 0.35;   // favour x proximity
      if (d < bd) { bd = d; best = mk_; }
    }
    if (!best || bd > 90 * 90) return hideTip();
    const r = best.p.r;
    cross.setAttribute('x1', best.cx); cross.setAttribute('x2', best.cx);
    cross.setAttribute('opacity', 1);
    ring.setAttribute('cx', best.cx); ring.setAttribute('cy', best.cy);
    ring.setAttribute('stroke', best.s.color); ring.setAttribute('opacity', 1);
    const pts = waPoints(r);
    tip.innerHTML =
      `<b>${esc(raceName(r))}</b><div style="font-size:11px;color:#b9c4d4">` +
      `${esc(COURSE_LABEL[r.course])}</div><table>` +
      `<tr><td>${t("Time")}</td><td class="r" style="font-size:14px;font-weight:700">${fmt.time(r.seconds)}</td></tr>` +
      `<tr><td>${t("Date")}</td><td class="r">${fmt.date(r.date)}</td></tr>` +
      `<tr><td>${t("Age")}</td><td class="r">${ageLabel(r.date)}</td></tr>` +
      `<tr><td>${t("Meet")}</td><td class="r">${esc(r.meet || t('not recorded'))}</td></tr>` +
      (r.round ? `<tr><td>${t("Round")}</td><td class="r">${esc(r.round)}</td></tr>` : '') +
      `<tr><td>${t("Speed")}</td><td class="r">${fmt.speed(r.distance, r.seconds).toFixed(3)} m/s</td></tr>` +
      `<tr><td>${t("Pace")}</td><td class="r">${fmt.time(fmt.pace100(r.distance, r.seconds))} /100 m</td></tr>` +
      (pts ? `<tr><td>${t("WA points")}</td><td class="r">${pts}</td></tr>` : '') +
      `</table>`;
    tip.style.display = 'block';
    const bw = tip.offsetWidth, bh = tip.offsetHeight, dispRect = svg.getBoundingClientRect();
    let left = best.cx / k + 16, top = best.cy / k - bh / 2;
    if (left + bw > dispRect.width) left = best.cx / k - bw - 16;
    tip.style.left = Math.max(2, left) + 'px';
    tip.style.top = Math.max(2, Math.min(top, dispRect.height - bh - 2)) + 'px';
  }
  hit.addEventListener('pointermove', moveTip);
  hit.addEventListener('pointerdown', moveTip);
  hit.addEventListener('pointerleave', hideTip);

  /* ---- quick reveal animation ---- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (o.animate && !reduce) {
    const run = () => {
      const dur = 620, t0 = performance.now(), full = Math.max(0, iw + 70);
      const ease = p => 1 - Math.pow(1 - p, 3);
      (function step(now) {
        /* rAF can report a timestamp from before t0, so clamp both ends. */
        const prog = Math.max(0, Math.min(1, (now - t0) / dur)), w = ease(prog) * full;
        clipRect.setAttribute('width', w.toFixed(1));
        const edge = m.l - 4 + w;
        for (const mk_ of marks) {
          if (+mk_.g.getAttribute('opacity') === 0 && mk_.cx <= edge) {
            mk_.g.setAttribute('opacity', 1);
            if (mk_.star) { mk_.star.classList.add('pop');
                            setTimeout(() => mk_.star.classList.add('twinkle'), 460); }
          }
        }
        if (prog < 1) requestAnimationFrame(step);
      })(t0);
    };
    let started = false;
    const start = () => { if (started) return; started = true; run(); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); }
      }, { threshold: 0.01, rootMargin: '160px 0px' });
      io.observe(wrap);
      /* Safety net: a chart must never stay invisible because the observer
         never fired (print, offscreen container, headless capture). */
      setTimeout(start, 4000);
      addEventListener('beforeprint', start, { once: true });
    } else start();
  } else {
    clipRect.setAttribute('width', iw + 70);
    marks.forEach(mk_ => { mk_.g.setAttribute('opacity', 1);
                           if (mk_.star) mk_.star.classList.add('twinkle'); });
  }
  return svg;
}

/** Build chart series from raw rows, one series per event key. */
function seriesFromRows(rows, { byStroke = false } = {}) {
  const g = new Map();
  for (const r of rows) {
    const k = byStroke ? r.stroke : eventKey(r);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  return [...g.entries()].map(([k, rs]) => {
    rs.sort((a, b) => a.date.localeCompare(b.date));
    return {
      key: k, label: byStroke ? STROKE_LABEL[k] : eventLabel(rs[0]),
      stroke: rs[0].stroke, course: byStroke ? 'SCM' : rs[0].course,
      color: STROKE_COLOR[rs[0].stroke] || '#2a78d6',
      model: trendModel(rs),
      points: rs.map(r => ({ xv: dayNum(r.date), y: r.seconds, r })),
    };
  });
}

/** HTML legend — always present for 2+ series, plus the course-dash key. */
function legendHTML(series, { showCourse = true } = {}) {
  const strokes = STROKES.filter(st => series.some(s => s.stroke === st));
  const parts = strokes.map(st =>
    `<span><i style="border-color:${STROKE_COLOR[st]}"></i>${esc(STROKE_LABEL[st])}</span>`);
  if (showCourse && new Set(series.map(s => s.course)).size > 1)
    parts.push(`<span style="color:#4a566b"><i style="border-color:#4a566b"></i>${t('25 m pool')}</span>`,
               `<span style="color:#4a566b"><i class="dash" style="border-color:#4a566b"></i>${t('50 m pool')}</span>`);
  parts.push(`<span style="color:#4a566b">★ ${t('personal best')}</span>`);
  return parts.join('');
}

/* ============================== navigation ============================== */

const NAV = [
  { href: 'index.html',    label: 'Dashboard' },
  { href: 'events.html',   label: 'Events' },
  { href: 'meets.html',    label: 'Meets' },
  { href: 'analysis.html', label: 'Analysis' },
  { href: 'advice.html',   label: 'Review' },
  { href: 'data.html',     label: 'Data' },
  { href: 'export.html',   label: 'Export' },
  { href: 'help.html',     label: 'Help' },
  { href: 'add.html',      label: 'Add Result' },
];

function mountShell(active, subtitle) {
  const here = location.pathname.split('/').pop() || 'index.html';
  document.body.insertAdjacentHTML('afterbegin', `
  <header class="top">
    <div class="top-in">
      <div>
        <h1>Ivy <em>Swim</em></h1>
        <div class="sub">${esc(t('{0} · born {1} · performance record',
          ATHLETE.nameZh || ATHLETE.name, fmt.date(ATHLETE.birth)))}</div>
      </div>
      <div class="spacer"></div>
      <nav class="mainnav">${NAV.map(n =>
        `<a href="${n.href}"${(n.href === (active || here)) ? ' class="on"' : ''}>${esc(t(n.label))}</a>`
      ).join('')}</nav>
      <button class="langtoggle" id="langtoggle" type="button"
        title="${LANG.get() === 'zh' ? 'Switch to English' : '切换到中文'}">
        <span class="flag">${LANG.get() === 'zh' ? '🇬🇧' : '🇨🇳'}</span>
        <span>${LANG.get() === 'zh' ? 'EN' : '中文'}</span>
      </button>
    </div>
  </header>
  ${subtitle ? `<div class="pagebar"><div class="pagebar-in">${subtitle}</div></div>` : ''}`);
  document.documentElement.lang = LANG.get() === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('langtoggle').onclick = () => {
    LANG.set(LANG.get() === 'zh' ? 'en' : 'zh');
    location.reload();
  };
}

/* ============================ advanced search ============================ */

/**
 * Query grammar (all terms AND together):
 *   free text            matches any field
 *   stroke:fly           stroke name or alias
 *   course:lcm | 50m     pool length
 *   dist:100             race distance
 *   year:2026            calendar year
 *   meet:"city open"     meet name substring
 *   round:final          heat / final / time trial
 *   after:2025-01-01     inclusive lower date bound
 *   before:2026-06-30    inclusive upper date bound
 *   time<40  time>1:20   time comparison, accepts mm:ss.hh
 *   age<10   age>=9.5    age in years at the time of the swim
 *   pb                   personal-best swims only
 */
const QUERY_FIELDS = new Set(['stroke', 'course', 'pool', 'dist', 'distance', 'year',
  'meet', 'round', 'note', 'after', 'from', 'before', 'to', 'on', 'date', 'time',
  'age', 'points']);

function parseQuery(q) {
  const terms = [];
  const re = /(\w+)(:|<=|>=|<|>|=)("[^"]*"|\S+)|"([^"]*)"|(\S+)/g;
  let mm;
  while ((mm = re.exec(q)) !== null) {
    if (mm[1] && QUERY_FIELDS.has(mm[1].toLowerCase())) {
      terms.push({ field: mm[1].toLowerCase(), op: mm[2],
                   value: (mm[3] || '').replace(/^"|"$/g, '') });
    } else {
      /* Not a known qualifier — "1:23" is a time, not a field. Search it as text. */
      terms.push({ free: mm[0].replace(/^"|"$/g, '').toLowerCase() });
    }
  }
  return terms;
}

const STROKE_ALIAS = {
  free: 'Free', freestyle: 'Free', fr: 'Free',
  back: 'Back', backstroke: 'Back', bk: 'Back',
  breast: 'Breast', breaststroke: 'Breast', br: 'Breast',
  fly: 'Fly', butterfly: 'Fly', fl: 'Fly',
  im: 'IM', medley: 'IM',
};

function runSearch(rows, q) {
  const terms = parseQuery((q || '').trim());
  if (!terms.length) return rows;
  const tagged = tagProgression(rows);
  const byId = new Map(tagged.map(r => [r.id, r]));
  const cmp = (a, op, b) => op === '<' ? a < b : op === '>' ? a > b
                          : op === '<=' ? a <= b : op === '>=' ? a >= b : a === b;
  return rows.filter(r => terms.every(tm => {
    if (tm.free !== undefined) {
      if (!tm.free) return true;
      if (tm.free === 'pb') return byId.get(r.id)?.wasPB;
      const hay = [r.date, r.course, r.stroke, STROKE_LABEL[r.stroke], r.distance + 'm',
                   r.distance, fmt.time(r.seconds), r.meet, r.round, r.note,
                   raceName(r), ageLabel(r.date),
                   r.course === 'SCM' ? '25m pool short course' : '50m pool long course']
                   .join(' ').toLowerCase();
      return hay.includes(tm.free);
    }
    const v = tm.value.toLowerCase();
    switch (tm.field) {
      case 'stroke': return r.stroke === (STROKE_ALIAS[v] || v);
      case 'course': case 'pool': {
        const c = v.startsWith('s') || v === '25' || v === '25m' ? 'SCM'
                : v.startsWith('l') || v === '50' || v === '50m' ? 'LCM' : v.toUpperCase();
        return r.course === c;
      }
      case 'dist': case 'distance': return cmp(r.distance, tm.op === ':' ? '=' : tm.op, +v);
      case 'year': return r.date.slice(0, 4) === v;
      case 'meet': return (r.meet || '').toLowerCase().includes(v);
      case 'round': return (r.round || '').toLowerCase().includes(v);
      case 'note': return (r.note || '').toLowerCase().includes(v);
      case 'after': case 'from': return r.date >= v;
      case 'before': case 'to': return r.date <= v;
      case 'on': case 'date': return r.date === v;
      case 'time': return cmp(r.seconds, tm.op === ':' ? '=' : tm.op, parseClock(v));
      case 'age': return cmp(ageAt(r.date), tm.op === ':' ? '=' : tm.op, +v);
      case 'points': { const p = waPoints(r); return p != null && cmp(p, tm.op === ':' ? '=' : tm.op, +v); }
      default: return true;   // unreachable: parseQuery only emits known fields
    }
  }));
}

/** "1:23.96" | "83.96" -> seconds */
function parseClock(s) {
  s = String(s).trim();
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s);
  return m ? +m[1] * 60 + +m[2] : parseFloat(s);
}

/* =============================== fragments =============================== */

const courseTag = c => `<span class="tag ${c.toLowerCase()}">${t(c === 'SCM' ? '25 m' : '50 m')}</span>`;

/* ------------------------------- inline help ---------------------------- */
/* Short explanations for the parts of the interface that are not self-evident. */
const HELP = new Proxy({}, { get: (_, k) => ({
  points: t('World Aquatics points score a swim against the world record for that exact event and pool length: P = 1000 × (record ÷ time)³. Higher is better. It is the only fair way to compare a 50 backstroke with a 200 medley.'),
  rate: t('The yearly rate of improvement, from a straight-line fit through the logarithm of each race time. −10% means her time in this event is dropping by about a tenth every year. Negative is faster.'),
  interval: t('The range the true rate is 95% likely to fall in. A wide range means there are not yet enough races to pin the trend down.'),
  r2: t('How closely the races follow the fitted trend, from 0 to 1. Values near 1 mean a steady, predictable progression; low values mean the times jump around.'),
  signal: t('"Clear" means the improvement is larger than the random variation between races. "Tentative" means it looks like progress but could still be noise. "n<3" means fewer than three races, which is too few to fit a trend at all.'),
  riegel: t('How well speed holds up as the distance doubles, from the 50 and the 100 of the same stroke. 1.0 would mean no slowing at all; world-class sprinters are around 1.05–1.10. Lower is better.'),
  standard: t('Points are measured against the world record. Switch between the women\'s and men\'s record tables here; it changes every points figure on the site.'),
  star: t('The star marks the fastest swim ever recorded in that event. The dashed line runs across the chart at that time.'),
  course: t('Short course is a 25 m pool, long course a 50 m pool. Times are not comparable between them, so each is kept as its own event with its own world record.'),
  pace: t('Speed is the average metres covered per second. Pace is the same thing expressed as the time it would take to cover 100 m at that rate.'),
  group: t('Choose what the event cards are grouped under, and the order they appear in within each group.'),
  search: t('Type any word to search every field at once. Add qualifiers such as stroke:fly, course:lcm, time<35 or pb to narrow it, and combine as many as you like.'),
  exportLang: t('Sets the language of the files you download here. It is independent of the language the site is displayed in.'),
  age: t('The athlete\'s exact age on the day of that race, calculated from her date of birth.'),
  trend: t('The dotted line is the fitted trend, not a real result. Exported charts leave it out and label every actual swim instead.'),
}[k] || k) });

/**
 * A small "?" affordance. Hover on a pointer device, tap on a touch device;
 * Escape or a second tap dismisses it. One floating panel is shared by all of
 * them, so the page stays light no matter how many are on it.
 */
function help(key, text) {
  return `<button type="button" class="helpdot" aria-label="${esc(t('What is this?'))}"` +
         ` data-help="${esc(text || HELP[key] || key)}">?</button>`;
}

let _helpPanel = null;
function helpPanel() {
  if (_helpPanel) return _helpPanel;
  _helpPanel = document.createElement('div');
  _helpPanel.className = 'helppop';
  _helpPanel.setAttribute('role', 'tooltip');
  _helpPanel.hidden = true;
  document.body.appendChild(_helpPanel);
  return _helpPanel;
}

function showHelp(btn) {
  const p = helpPanel();
  p.textContent = btn.dataset.help;
  p.hidden = false;
  p.classList.remove('in');
  const r = btn.getBoundingClientRect();
  const pw = Math.min(300, window.innerWidth - 24);
  p.style.maxWidth = pw + 'px';
  const ph = p.offsetHeight;
  let left = r.left + r.width / 2 - p.offsetWidth / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - p.offsetWidth - 10));
  let top = r.top - ph - 10;
  p.classList.toggle('below', top < 8);
  if (top < 8) top = r.bottom + 10;
  p.style.left = Math.round(left + scrollX) + 'px';
  p.style.top = Math.round(top + scrollY) + 'px';
  requestAnimationFrame(() => p.classList.add('in'));
  p.dataset.owner = btn.dataset.helpId || '';
}

function hideHelp() {
  if (_helpPanel) { _helpPanel.hidden = true; _helpPanel.classList.remove('in'); }
}

document.addEventListener('pointerover', e => {
  const b = e.target.closest?.('.helpdot');
  if (b && e.pointerType !== 'touch') showHelp(b);
});
document.addEventListener('pointerout', e => {
  if (e.target.closest?.('.helpdot') && e.pointerType !== 'touch') hideHelp();
});
document.addEventListener('click', e => {
  const b = e.target.closest?.('.helpdot');
  if (b) { e.preventDefault();
           _helpPanel && !_helpPanel.hidden ? hideHelp() : showHelp(b); }
  else hideHelp();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideHelp(); });
addEventListener('scroll', hideHelp, { passive: true });

/**
 * Export control for a single chart. Present on every page that draws one, so a
 * chart can be saved without going to the export page first.
 */
function chartExportButton(ev, host) {
  const wrap = document.createElement('div');
  wrap.className = 'chart-export';
  wrap.innerHTML =
    `<button class="del" data-x="png">${esc(t('Save PNG'))}</button>` +
    `<button class="del" data-x="pdf">${esc(t('Save PDF'))}</button>` +
    `<span class="xmsg"></span>`;
  const note = wrap.querySelector('.xmsg');
  const load = () => new Promise((res, rej) => {
    if (window.ExportDoc) return res();
    let left = 2;
    for (const src of ['doc.js', 'exports.js']) {
      const el = document.createElement('script');
      el.src = src + (window.ASSET_V ? '?v=' + window.ASSET_V : '');
      el.async = false;
      el.onload = () => (--left === 0) && res();
      el.onerror = () => rej(new Error('could not load the export tools'));
      document.head.appendChild(el);
    }
  });
  wrap.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    const kind = b.dataset.x;
    b.disabled = true;
    note.textContent = t('Preparing…');
    try {
      await load();
      await fontsReady();
      const lang = LANG.get();
      const label = LANG.as(lang, () => `${ev.distance}${STROKE_LABEL[ev.stroke]}`)
        .replace(/\s+/g, '');
      if (kind === 'png') {
        await exportCanvasAsPNG(buildChartCard(ev, lang),
          `${ATHLETE.preferred}-${label}-${ev.course}.png`);
      } else {
        await exportDocAsPDF(buildEventDoc(ev, lang),
          `${ATHLETE.preferred}-${label}-${ev.course}.pdf`, ev.label);
      }
      note.textContent = '';
    } catch (e) {
      note.textContent = e.message;
    } finally {
      b.disabled = false;
    }
  });
  if (host) host.appendChild(wrap);
  return wrap;
}

/** The best-result header strip that sits above every chart. */
function bestStrip(items) {
  return `<div class="best-strip">${items.map(it => `
    <div class="bs">
      <div class="lab">${it.color ? `<span class="swatch" style="background:${it.color}"></span>` : ''}${esc(it.label)}</div>
      <div class="val">${it.value}</div>
      <div class="sub">${it.sub || ''}</div>
    </div>`).join('')}</div>`;
}

/** Best time + speed + pace, the standard header for one event. */
function bestOfEvent(ev) {
  return bestStrip([
    { label: t('Personal best'), value: fmt.time(ev.best.seconds), color: STROKE_COLOR[ev.stroke],
      sub: `${fmt.date(ev.best.date)} · ${ageLabel(ev.best.date)}` },
    { label: t('Speed'), value: ev.speed.toFixed(3) + '<small> m/s</small>',
      sub: t('mean velocity over {0} m', ev.distance) },
    { label: t('Pace'), value: fmt.time(ev.pace100), sub: t('per 100 m') },
    { label: t('WA points'), value: ev.points ?? '—',
      sub: ev.points ? t('vs world record') : t('no base time') },
  ]);
}
