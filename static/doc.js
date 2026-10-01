/* Canvas document engine — renders export pages that match the site's styling,
   then hands them to the server to be packaged as PDF or PNG.

   Everything is drawn in document units (a 1240 x 1754 page, A4 proportions) and
   scaled up on the backing canvas, so output is crisp at print resolution. */
'use strict';

const PAGE_W = 1240, PAGE_H = 1754, MARGIN = 66;
const DOC = {
  hydro: '#0F1E36', hydro70: '#4a566b', hydro45: '#8b93a1',
  hair: '#dfe4ea', paper: '#FFFFFF', wash: '#F2F5F8',
  aqua: '#00F0FF', lime: '#ADFF2F', gold: '#FFC400',
  good: '#0f7b4f', bad: '#c0392b',
};
const HEAD_FONT = "'Teko','PingFang SC','Microsoft YaHei',sans-serif";
const BODY_FONT = "'Titillium Web','PingFang SC','Microsoft YaHei',sans-serif";

/** Web fonts must be resident before anything is measured or drawn. */
async function fontsReady() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("600 40px 'Teko'"),
      document.fonts.load("400 16px 'Titillium Web'"),
      document.fonts.load("700 16px 'Titillium Web'"),
    ]);
    await document.fonts.ready;
  } catch (_) { /* fall back to system fonts */ }
}

class ExportDoc {
  constructor(opts = {}) {
    this.scale = opts.scale || 2;
    this.title = opts.title || 'Ivy Swim Analytics';
    this.subtitle = opts.subtitle || '';
    this.pages = [];
    this.links = [];              // clickable regions, one array per page
    this.newPage();
  }

  newPage() {
    const c = document.createElement('canvas');
    c.width = Math.round(PAGE_W * this.scale);
    c.height = Math.round(PAGE_H * this.scale);
    const x = c.getContext('2d');
    x.scale(this.scale, this.scale);
    x.fillStyle = DOC.wash; x.fillRect(0, 0, PAGE_W, PAGE_H);
    x.textBaseline = 'alphabetic';
    this.pages.push(c);
    this.links.push([]);
    this.ctx = x;
    this.y = 0;
    this.drawBanner();
    return this;
  }

  get bottom() { return PAGE_H - 122; }   // clear of the link box and footer

  ensure(h) { if (this.y + h > this.bottom) this.newPage(); return this; }

  /* ---------------------------------------------------------- chrome ---- */
  drawBanner() {
    const x = this.ctx, H = 92;
    x.fillStyle = DOC.hydro; x.fillRect(0, 0, PAGE_W, H);
    /* 45° sport slash, echoing the site header */
    x.save();
    x.beginPath(); x.rect(PAGE_W - 150, 0, 150, H); x.clip();
    x.strokeStyle = 'rgba(0,240,255,0.34)'; x.lineWidth = 5;
    for (let i = -H; i < 200; i += 17) {
      x.beginPath(); x.moveTo(PAGE_W - 150 + i, H); x.lineTo(PAGE_W - 150 + i + H * 0.5, 0); x.stroke();
    }
    x.restore();

    x.font = `600 40px ${HEAD_FONT}`; x.fillStyle = '#fff'; x.textAlign = 'left';
    x.fillText('IVY ', MARGIN, 48);
    const w = x.measureText('IVY ').width;
    x.fillStyle = DOC.aqua; x.fillText('SWIM', MARGIN + w, 48);
    x.font = `400 13px ${BODY_FONT}`; x.fillStyle = '#b9c4d4';
    x.fillText(t('{0} · born {1} · performance record',
                 ATHLETE.nameZh || ATHLETE.name, fmt.date(ATHLETE.birth)).toUpperCase(), MARGIN, 70);
    if (this.title) {
      const right = PAGE_W - 170, room = right - 320;
      x.textAlign = 'right'; x.font = `600 26px ${HEAD_FONT}`; x.fillStyle = '#fff';
      x.fillText(clipText(x, this.title, room), right, 46);
      if (this.subtitle) {
        x.font = `400 12px ${BODY_FONT}`; x.fillStyle = '#b9c4d4';
        x.fillText(clipText(x, this.subtitle, room), right, 68);
      }
      x.textAlign = 'left';
    }
    this.y = H + 26;
  }

  /** Bordered strip pointing back to the live dashboard. Drawn clear of the
      content so it can never sit on top of a chart or a table. */
  linkBox(x, top) {
    const W = PAGE_W - MARGIN * 2, H = 34;
    x.fillStyle = '#fff'; x.fillRect(MARGIN, top, W, H);
    x.strokeStyle = DOC.hydro; x.lineWidth = 1.5;
    x.strokeRect(MARGIN + 0.75, top + 0.75, W - 1.5, H - 1.5);
    x.fillStyle = DOC.aqua; x.fillRect(MARGIN + 1.5, top + 1.5, 5, H - 3);
    x.textAlign = 'left';
    x.font = `400 11.5px ${BODY_FONT}`; x.fillStyle = DOC.hydro70;
    const lead = t('Full record and interactive charts:') + '  ';
    x.fillText(lead, MARGIN + 18, top + 21);
    const lw = x.measureText(lead).width;
    x.font = `700 12px ${BODY_FONT}`; x.fillStyle = '#1a5fb4';
    x.fillText(SITE_URL, MARGIN + 18 + lw, top + 21);
    return { x: MARGIN, y: top, w: W, h: H, url: SITE_URL };
  }

  stampFooters() {
    const stamp = t('Generated {0}', fmt.date(new Date().toISOString().slice(0, 10)));
    const total = this.pages.length;
    this.pages.forEach((c, i) => {
      /* Each page context was scaled once when the page was created; scaling it
         again here would push the footer off the canvas. */
      const x = c.getContext('2d');
      x.save();
      this.links[i].push(this.linkBox(x, PAGE_H - 104));
      x.fillStyle = DOC.hair; x.fillRect(MARGIN, PAGE_H - 54, PAGE_W - MARGIN * 2, 1.5);
      x.font = `400 11px ${BODY_FONT}`; x.fillStyle = DOC.hydro70; x.textAlign = 'left';
      x.fillText(`${ATHLETE.nameZh || ATHLETE.name} · ${t('born {0}', fmt.date(ATHLETE.birth))} · ${stamp}`,
                 MARGIN, PAGE_H - 34);
      x.textAlign = 'right';
      x.fillText(t('Page {0} of {1}', i + 1, total), PAGE_W - MARGIN, PAGE_H - 34);
      x.textAlign = 'left';
      x.restore();
    });
    return this;
  }

  /* ------------------------------------------------------- primitives --- */
  sectionTitle(text, color) {
    this.ensure(52);
    const x = this.ctx;
    x.font = `600 25px ${HEAD_FONT}`; x.fillStyle = color || DOC.hydro70;
    x.textAlign = 'left';
    const label = String(text).toUpperCase();
    x.fillText(label, MARGIN, this.y + 20);
    const w = x.measureText(label).width;
    x.fillStyle = DOC.hair;
    x.fillRect(MARGIN + w + 14, this.y + 12, PAGE_W - MARGIN * 2 - w - 14, 2);
    this.y += 40;
    return this;
  }

  card(h, draw) {
    this.ensure(h + 14);
    const x = this.ctx, top = this.y;
    x.fillStyle = DOC.paper; x.fillRect(MARGIN, top, PAGE_W - MARGIN * 2, h);
    x.strokeStyle = DOC.hydro; x.lineWidth = 2;
    x.strokeRect(MARGIN + 1, top + 1, PAGE_W - MARGIN * 2 - 2, h - 2);
    draw(x, MARGIN, top, PAGE_W - MARGIN * 2, h);
    this.y = top + h + 16;
    return this;
  }

  /** The four-cell metric strip used above every chart on the site. */
  bestStrip(items) {
    const H = 74;
    return this.card(H, (x, X, Y, W) => {
      const cw = W / items.length;
      items.forEach((it, i) => {
        const cx = X + cw * i;
        if (i) { x.fillStyle = DOC.hair; x.fillRect(cx, Y + 8, 1.5, H - 16); }
        let tx = cx + 16;
        if (it.color) {
          x.fillStyle = it.color; x.fillRect(tx, Y + 15, 9, 9);
          x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1;
          x.strokeRect(tx + .5, Y + 15.5, 8, 8);
          tx += 15;
        }
        x.font = `400 11px ${BODY_FONT}`; x.fillStyle = DOC.hydro70;
        x.fillText(String(it.label).toUpperCase(), tx, Y + 24);
        x.font = `600 30px ${HEAD_FONT}`; x.fillStyle = DOC.hydro;
        x.fillText(it.value, cx + 16, Y + 52);
        const vw = x.measureText(it.value).width;
        if (it.unit) {
          x.font = `400 13px ${BODY_FONT}`; x.fillStyle = DOC.hydro70;
          x.fillText(' ' + it.unit, cx + 18 + vw, Y + 52);
        }
        if (it.sub) {
          x.font = `400 11.5px ${BODY_FONT}`; x.fillStyle = DOC.hydro70;
          x.fillText(clipText(x, it.sub, cw - 30), cx + 16, Y + 66);
        }
      });
    });
  }

  /** Definition list, two columns. */
  kv(pairs, cols = 2) {
    const rows = Math.ceil(pairs.length / cols);
    const H = rows * 24 + 22;
    return this.card(H, (x, X, Y, W) => {
      const cw = W / cols;
      pairs.forEach((p, i) => {
        const c = Math.floor(i / rows), r = i % rows;
        const px = X + 18 + cw * c, py = Y + 26 + r * 24;
        x.font = `400 13px ${BODY_FONT}`; x.fillStyle = DOC.hydro70; x.textAlign = 'left';
        x.fillText(p[0], px, py);
        x.font = `700 13px ${BODY_FONT}`; x.fillStyle = p[2] || DOC.hydro; x.textAlign = 'right';
        x.fillText(p[1], X + cw * c + cw - 18, py);
        x.textAlign = 'left';
      });
    });
  }

  /**
   * Table with a dark header, splitting across pages when needed.
   * cols: [{ label, width, align, color }]
   */
  table(cols, rows) {
    const HEAD = 30, ROW = 25;
    const total = cols.reduce((a, c) => a + c.width, 0);
    const W = PAGE_W - MARGIN * 2;
    const widths = cols.map(c => (c.width / total) * W);
    let i = 0;
    while (i < rows.length) {
      this.ensure(HEAD + ROW * 2);
      const room = Math.max(1, Math.floor((this.bottom - this.y - HEAD - 10) / ROW));
      const slice = rows.slice(i, i + room);
      const H = HEAD + slice.length * ROW;
      const x = this.ctx, top = this.y;
      x.fillStyle = DOC.paper; x.fillRect(MARGIN, top, W, H);
      x.fillStyle = DOC.hydro; x.fillRect(MARGIN, top, W, HEAD);
      let cx = MARGIN;
      cols.forEach((c, ci) => {
        x.font = `700 11px ${BODY_FONT}`; x.fillStyle = '#fff';
        x.textAlign = c.align || 'left';
        const tx = c.align === 'right' ? cx + widths[ci] - 12
                 : c.align === 'center' ? cx + widths[ci] / 2 : cx + 12;
        x.fillText(String(c.label).toUpperCase(), tx, top + 20);
        cx += widths[ci];
      });
      slice.forEach((row, ri) => {
        const ry = top + HEAD + ri * ROW;
        if (ri % 2) { x.fillStyle = '#f6f9fb'; x.fillRect(MARGIN, ry, W, ROW); }
        x.fillStyle = DOC.hair; x.fillRect(MARGIN, ry, W, 1);
        let dx = MARGIN;
        cols.forEach((c, ci) => {
          const cell = row[ci];
          const val = cell && typeof cell === 'object' ? cell.text : cell;
          const col = cell && typeof cell === 'object' ? cell.color : null;
          const bold = cell && typeof cell === 'object' ? cell.bold : false;
          x.font = `${bold ? 700 : 400} 12.5px ${BODY_FONT}`;
          x.fillStyle = col || DOC.hydro;
          x.textAlign = c.align || 'left';
          const tx = c.align === 'right' ? dx + widths[ci] - 12
                   : c.align === 'center' ? dx + widths[ci] / 2 : dx + 12;
          x.fillText(clipText(x, val == null ? '' : String(val), widths[ci] - 20), tx, ry + 17);
          dx += widths[ci];
        });
      });
      x.textAlign = 'left';
      x.strokeStyle = DOC.hydro; x.lineWidth = 2;
      x.strokeRect(MARGIN + 1, top + 1, W - 2, H - 2);
      this.y = top + H + 16;
      i += slice.length;
    }
    return this;
  }

  /**
   * Flowing text. The context is re-read after `ensure`, because a page break
   * there swaps in a different canvas — measuring on one and drawing on the
   * other puts the text on the wrong page.
   */
  flow(text, size, color) {
    const lead = size + (size <= 11 ? 3.5 : 6);
    this.ctx.font = `400 ${size}px ${BODY_FONT}`;
    const lines = wrapText(this.ctx, text, PAGE_W - MARGIN * 2 - 4);
    let i = 0;
    while (i < lines.length) {
      this.ensure(lead * 2);
      const room = Math.max(1, Math.floor((this.bottom - this.y - 6) / lead));
      const slice = lines.slice(i, i + room);
      const x = this.ctx;                       // after any page break
      x.font = `400 ${size}px ${BODY_FONT}`;
      x.fillStyle = color;
      x.textAlign = 'left';
      slice.forEach((ln, k) => x.fillText(ln, MARGIN, this.y + size + k * lead));
      this.y += slice.length * lead + 10;
      i += slice.length;
    }
    return this;
  }

  /** Small-print methodology note. */
  note(text) { return this.flow(text, 10.5, DOC.hydro70); }

  para(text, size = 13) { return this.flow(text, size, DOC.hydro); }

  async toJPEGs(quality = 0.94) {
    return this.pages.map(c => c.toDataURL('image/jpeg', quality));
  }
}

/* ------------------------------------------------------------- text ----- */
function clipText(x, s, max) {
  s = String(s);
  if (x.measureText(s).width <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (x.measureText(s.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1;
  }
  return s.slice(0, lo) + '…';
}

function wrapText(x, s, max) {
  const out = [];
  for (const para of String(s).split('\n')) {
    /* CJK has no spaces, so break per character when a chunk is too wide */
    const chunks = /[一-鿿]/.test(para) ? [...para] : para.split(' ');
    const join = /[一-鿿]/.test(para) ? '' : ' ';
    let line = '';
    for (const w of chunks) {
      const next = line ? line + join + w : w;
      if (x.measureText(next).width > max && line) { out.push(line); line = w; }
      else line = next;
    }
    out.push(line);
  }
  return out;
}

/* ------------------------------------------------------------ charts ---- */
/**
 * Progression chart for export. Unlike the on-screen version this labels every
 * data point (the detail otherwise only visible on hover) and omits the fitted
 * trend line, so nothing on the page is a model artefact rather than a result.
 */
ExportDoc.prototype.chart = function (spec) {
  const o = Object.assign({
    height: 420, yFmt: fmt.time, invertY: true, bestIsMin: null,
    refLine: null, captions: true, legend: true,
    xFmt: v => fmt.monthYear(new Date(v * 86400000).toISOString().slice(0, 10)),
    xFmt2: null,
  }, spec);
  if (o.bestIsMin == null) o.bestIsMin = o.invertY;
  const series = (o.series || []).filter(s => s.points && s.points.length);
  if (!series.length) return this;

  const legendH = o.legend ? 26 : 0;
  const H = o.height + legendH;
  return this.card(H, (x, X, Y, W) => {
    const m = { t: 30 + legendH, r: 78, b: o.xFmt2 ? 62 : 44, l: 76 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = series.flatMap(s => s.points);
    let x0 = Math.min(...all.map(p => p.xv)), x1 = Math.max(...all.map(p => p.xv));
    if (x0 === x1) { x0 -= 15; x1 += 15; }
    const xp = (x1 - x0) * 0.07; x0 -= xp; x1 += xp;
    let y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
    if (o.refLine) { y0 = Math.min(y0, o.refLine.y); y1 = Math.max(y1, o.refLine.y); }
    const yp = (y1 - y0 || Math.max(1, y1 * 0.05)) * 0.20; y0 -= yp; y1 += yp;
    const PX = v => X + m.l + ((v - x0) / (x1 - x0)) * iw;
    const PY = v => o.invertY ? Y + m.t + ((v - y0) / (y1 - y0)) * ih
                              : Y + m.t + ih - ((v - y0) / (y1 - y0)) * ih;

    if (o.legend) {
      let lx = X + m.l - 4;
      x.textAlign = 'left';
      const seen = new Set();
      for (const s of series) {
        if (seen.has(s.stroke)) continue;
        seen.add(s.stroke);
        x.strokeStyle = s.color; x.lineWidth = 3; x.setLineDash([]);
        x.beginPath(); x.moveTo(lx, Y + 18); x.lineTo(lx + 22, Y + 18); x.stroke();
        x.font = `400 12px ${BODY_FONT}`; x.fillStyle = DOC.hydro;
        const label = STROKE_LABEL[s.stroke] || s.stroke;
        x.fillText(label, lx + 28, Y + 22);
        lx += 34 + x.measureText(label).width;
      }
      x.fillStyle = DOC.gold; x.font = `400 12px ${BODY_FONT}`;
      drawStar(x, lx + 8, Y + 18, 7, 3);
      x.fillStyle = DOC.hydro; x.fillText(t('personal best'), lx + 20, Y + 22);
    }

    /* gridlines and axis labels */
    x.setLineDash([]); x.lineWidth = 1;
    x.font = `400 11.5px ${BODY_FONT}`;
    for (const tv of ticks(y0, y1, 5)) {
      const py = PY(tv);
      x.strokeStyle = DOC.hair;
      x.beginPath(); x.moveTo(X + m.l, py); x.lineTo(X + m.l + iw, py); x.stroke();
      x.fillStyle = DOC.hydro70; x.textAlign = 'right';
      x.fillText(o.yFmt(tv), X + m.l - 10, py + 4);
    }
    let lastLabel = null;
    x.textAlign = 'center';
    for (const tv of ticks(x0, x1, Math.min(6, Math.max(2, Math.round(iw / 150))))) {
      const text = o.xFmt(tv);
      if (text === lastLabel) continue;
      lastLabel = text;
      x.fillStyle = DOC.hydro70;
      x.fillText(text, PX(tv), Y + m.t + ih + 24);
      if (o.xFmt2) {
        x.font = `400 10.5px ${BODY_FONT}`; x.fillStyle = DOC.hydro45;
        x.fillText(o.xFmt2(tv), PX(tv), Y + m.t + ih + 41);
        x.font = `400 11.5px ${BODY_FONT}`;
      }
    }
    x.strokeStyle = DOC.hair;
    x.beginPath(); x.moveTo(X + m.l, Y + m.t + ih); x.lineTo(X + m.l + iw, Y + m.t + ih); x.stroke();
    x.textAlign = 'left'; x.font = `400 10.5px ${BODY_FONT}`; x.fillStyle = DOC.hydro45;
    x.fillText(o.yTitle || t('TIME  (faster ↑)'), X + 8, Y + m.t - 12);

    /* personal-best reference line */
    if (o.refLine) {
      const ry = PY(o.refLine.y);
      x.strokeStyle = o.refLine.color || DOC.hydro; x.lineWidth = 1.5;
      x.setLineDash([7, 5]);
      x.beginPath(); x.moveTo(X + m.l, ry); x.lineTo(X + m.l + iw, ry); x.stroke();
      x.setLineDash([]);
      if (o.refLine.label) {
        x.font = `700 11px ${BODY_FONT}`; x.fillStyle = o.refLine.color || DOC.hydro;
        x.fillText(o.refLine.label, X + m.l + 6, ry - 7);
      }
    }

    /* series, points and captions — markers first, so captions can avoid them */
    const placed = [];
    const markers = [];
    const pending = [];
    for (const s of series) {
      const pts = [...s.points].sort((a, b) => a.xv - b.xv);
      x.strokeStyle = s.color; x.lineWidth = 2.5; x.lineJoin = 'round';
      x.setLineDash(s.course === 'LCM' ? [9, 5] : []);
      x.beginPath();
      pts.forEach((p, i) => (i ? x.lineTo(PX(p.xv), PY(p.y)) : x.moveTo(PX(p.xv), PY(p.y))));
      x.stroke();
      x.setLineDash([]);
      const bestY = o.bestIsMin ? Math.min(...pts.map(p => p.y)) : Math.max(...pts.map(p => p.y));
      for (const p of pts) {
        const px = PX(p.xv), py = PY(p.y), isBest = p.y === bestY;
        if (isBest) {
          x.save();
          x.shadowColor = 'rgba(255,196,0,.9)'; x.shadowBlur = 10;
          x.fillStyle = DOC.gold; x.strokeStyle = '#fff'; x.lineWidth = 2.5;
          drawStar(x, px, py, 11, 4.8, true);
          x.restore();
        } else {
          x.beginPath(); x.arc(px, py, 5.5, 0, Math.PI * 2);
          x.fillStyle = s.color; x.fill();
          x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
        }
        markers.push({ x: px, y: py });
        if (o.captions) {
          pending.push({ px, py, color: s.color,
            cap: o.caption ? o.caption(p) : [o.yFmt(p.y), fmt.dateShort(p.r.date)] });
        }
      }
    }
    if (o.refLine && o.refLine.label) {
      /* the reference-line label is already on the canvas: keep captions off it */
      x.font = `700 11px ${BODY_FONT}`;
      placed.push({ x: X + m.l + 4, y: PY(o.refLine.y) - 20, 
                    w: x.measureText(o.refLine.label).width + 8, h: 18 });
    }
    const bounds = { top: Y + m.t + 2, bottom: Y + m.t + ih - 2,
                     left: X + 6, right: X + W - 6 };
    for (const c of pending) {
      placeCaption(x, placed, c.px, c.py, c.cap, c.color, bounds, markers);
    }
    x.textAlign = 'left';
  });
};

function drawStar(x, cx, cy, ro, ri, stroke) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro, a = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
  if (stroke) x.stroke();
  x.fill();
}

/**
 * Two-line point caption. Tries a ring of candidate positions around the point
 * and takes the first that clears every caption already placed, every data
 * marker, and the plot edges; a leader line is drawn when it lands far away.
 */
function placeCaption(x, placed, px, py, lines, color, bounds, markers) {
  const sizes = lines.map((l, i) => {
    x.font = `${i ? 400 : 700} ${i ? 10 : 11.5}px ${BODY_FONT}`;
    return x.measureText(l).width;
  });
  const w = Math.max(...sizes) + 10;
  const h = 12 + (lines.length - 1) * 12 + 7;

  const R = 15, cand = [];
  for (let ring = 0; ring < 5; ring++) {
    const d1 = R + ring * (h + 5), d2 = R + ring * (w * 0.5 + 8);
    cand.push([-w / 2, -h - d1], [-w / 2, d1],                 // above, below
              [d2, -h / 2], [-w - d2, -h / 2],                 // right, left
              [d2, -h - d1 * 0.6], [-w - d2, -h - d1 * 0.6],
              [d2, d1 * 0.6], [-w - d2, d1 * 0.6]);
  }

  let best = null;
  for (const [dx, dy] of cand) {
    const bx = px + dx, by = py + dy;
    if (bx < bounds.left || bx + w > bounds.right) continue;
    if (by < bounds.top || by + h > bounds.bottom) continue;
    const clash = placed.some(r => bx < r.x + r.w + 4 && bx + w > r.x - 4 &&
                                   by < r.y + r.h + 3 && by + h > r.y - 3)
      || (markers || []).some(m => bx < m.x + 9 && bx + w > m.x - 9 &&
                                   by < m.y + 9 && by + h > m.y - 9);
    if (!clash) { best = { x: bx, y: by }; break; }
  }
  if (!best) best = { x: Math.max(bounds.left, Math.min(px - w / 2, bounds.right - w)),
                      y: Math.max(bounds.top, Math.min(py - h - R, bounds.bottom - h)) };
  placed.push({ x: best.x, y: best.y, w, h });

  /* leader line when the label had to move away from its point */
  const cxL = best.x + w / 2, cyL = best.y + h / 2;
  if (Math.hypot(cxL - px, cyL - py) > h + 16) {
    x.save();
    x.strokeStyle = color; x.globalAlpha = 0.4; x.lineWidth = 1;
    x.beginPath(); x.moveTo(px, py); x.lineTo(cxL, cyL); x.stroke();
    x.restore();
  }

  /* backing plate keeps the text legible where it crosses a line */
  x.save();
  x.globalAlpha = 0.88; x.fillStyle = '#fff';
  x.fillRect(best.x, best.y, w, h);
  x.restore();

  x.textAlign = 'left';
  lines.forEach((line, i) => {
    x.font = `${i ? 400 : 700} ${i ? 10 : 11.5}px ${BODY_FONT}`;
    x.fillStyle = i ? DOC.hydro70 : color;
    x.fillText(line, best.x + 5, best.y + 11 + i * 12);
  });
}
