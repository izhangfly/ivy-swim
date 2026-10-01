/* Export builders — turn the live data into printable documents.
   Every builder runs inside LANG.as(), so a document can be produced in English
   or Chinese regardless of which language the page is currently showing. */
'use strict';

const METHOD_NOTE = () => [
  t('Method: times are plotted against the date of each race; the fastest swim in each event carries a star and the dashed line marks it.'),
  t('World Aquatics points score a swim against the world record for that event and pool length, P = 1000 × (B/T)³, so events of different length and stroke can be compared on one scale.'),
  t('Improvement rate is the slope of a least-squares fit of log race-time on date, expressed as percent change per year; negative means getting faster. The 95% interval comes from the two-sided t distribution on n−2 degrees of freedom, and needs at least three races.'),
  t('Short course (25 m) and long course (50 m) are treated as separate events throughout and are never pooled.'),
].join(' ');

/* ------------------------------------------------------- one event ------ */
function eventPages(doc, ev) {
  const tagged = tagProgression(ev.rows);
  const m = ev.model;

  doc.sectionTitle(eventLabel(ev.best), STROKE_COLOR[ev.stroke]);
  doc.bestStrip([
    { label: t('Personal best'), value: fmt.time(ev.best.seconds), color: STROKE_COLOR[ev.stroke],
      sub: `${fmt.date(ev.best.date)} · ${ageLabel(ev.best.date)}` },
    { label: t('Speed'), value: ev.speed.toFixed(3), unit: 'm/s',
      sub: t('mean velocity over {0} m', ev.distance) },
    { label: t('Pace'), value: fmt.time(ev.pace100), sub: t('per 100 m') },
    { label: t('WA points'), value: ev.points == null ? '—' : String(ev.points),
      sub: ev.points ? t('vs world record') : t('no base time') },
  ]);

  const series = seriesFromRows(ev.rows);
  doc.chart({
    series, height: 430,
    refLine: { y: ev.best.seconds, label: `${t('Personal best')} ${fmt.time(ev.best.seconds)}`,
               color: STROKE_COLOR[ev.stroke] },
    caption: p => {
      const pts = waPoints(p.r);
      return [fmt.time(p.y), fmt.dateShort(p.r.date) + (pts ? ` · ${pts}${t('pts')}` : '')];
    },
  });

  doc.sectionTitle(t('Progression model'));
  doc.kv([
    [t('Races'), String(ev.n)],
    [t('First recorded'), `${fmt.time(ev.first.seconds)} · ${fmt.date(ev.first.date)}`],
    [t('Personal best'), `${fmt.time(ev.best.seconds)} · ${fmt.date(ev.best.date)}`, DOC.good],
    [t('Total improvement'), ev.dropSec > 0
      ? `−${ev.dropSec.toFixed(2)} s (${ev.dropPct.toFixed(1)}%)` : '—',
      ev.dropSec > 0 ? DOC.good : DOC.hydro70],
    [t('Age at best'), ageLabel(ev.best.date)],
    [t('Span'), t('{0} days', ev.spanDays)],
    [t('Trend'), m ? t('{0} per year', fmt.pct(m.ratePct)) : t('needs 3+ races'),
      m ? (m.ratePct < 0 ? DOC.good : DOC.bad) : DOC.hydro70],
    [t('95% interval'), m ? `${fmt.pct(m.loPct)} … ${fmt.pct(m.hiPct)}` : '—'],
    ['R²', m ? m.r2.toFixed(3) : '—'],
    [t('Statistically clear'), m ? (m.significant ? t('yes') : t('not yet')) : '—'],
  ]);

  doc.sectionTitle(t('Every swim'));
  doc.table([
    { label: t('Date'), width: 15 }, { label: t('Age'), width: 9 },
    { label: t('Time'), width: 11, align: 'right' }, { label: 'Δ', width: 9, align: 'right' },
    { label: t('Speed'), width: 11, align: 'right' },
    { label: t('Pace /100'), width: 11, align: 'right' },
    { label: t('Pts'), width: 8, align: 'right' },
    { label: t('Meet'), width: 15 }, { label: t('Round'), width: 11 },
  ], tagged.slice().reverse().map(r => [
    fmt.date(r.date), { text: ageLabel(r.date), color: DOC.hydro70 },
    { text: (r.wasPB ? '★ ' : '') + fmt.time(r.seconds), bold: true,
      color: r.wasPB ? DOC.good : DOC.hydro },
    { text: r.improvedBy ? '−' + r.improvedBy.toFixed(2) : '—',
      color: r.improvedBy ? DOC.good : DOC.hydro70 },
    fmt.speed(r.distance, r.seconds).toFixed(3),
    fmt.time(fmt.pace100(r.distance, r.seconds)),
    waPoints(r) == null ? '—' : String(waPoints(r)),
    { text: r.meet || '—', color: DOC.hydro70 },
    { text: r.round || '—', color: DOC.hydro70 },
  ]));
  doc.note(METHOD_NOTE());
}

function buildEventDoc(ev, lang) {
  return LANG.as(lang, () => {
    const doc = new ExportDoc({ title: t('Event report'), subtitle: eventLabel(ev.best) });
    eventPages(doc, ev);
    return doc.stampFooters();
  });
}

function buildAllEventsDoc(events, lang) {
  return LANG.as(lang, () => {
    const doc = new ExportDoc({ title: t('Event reports'),
                                subtitle: t('{0} events', events.length) });
    events.forEach((ev, i) => { if (i) doc.newPage(); eventPages(doc, ev); });
    return doc.stampFooters();
  });
}

/* ---------------------------------------------- personal bests ---------- */
function buildPBDoc(rows, lang) {
  return LANG.as(lang, () => {
    const events = store.events(rows);
    const doc = new ExportDoc({ title: t('Personal bests'),
                                subtitle: t('{0} events', events.length) });
    const best = events.filter(e => e.points).sort((a, b) => b.points - a.points)[0];
    const meets = store.meets(rows);

    doc.sectionTitle(t('Personal bests'));
    doc.bestStrip([
      { label: t('Events'), value: String(events.length), sub: t('event/course combinations') },
      { label: t('Races recorded'), value: String(rows.length),
        sub: t('{0} competitions', meets.length) },
      { label: t('Strongest'), value: best ? String(best.points) : '—', unit: t('pts'),
        color: best ? STROKE_COLOR[best.stroke] : null,
        sub: best ? `${best.label} · ${fmt.time(best.best.seconds)}` : '' },
      { label: t('Age now'), value: ageLabel(new Date().toISOString().slice(0, 10)),
        sub: t('born {0}', fmt.date(ATHLETE.birth)) },
    ]);

    doc.table([
      { label: t('Event'), width: 20 }, { label: t('Pool'), width: 8 },
      { label: t('Best time'), width: 11, align: 'right' },
      { label: t('Date'), width: 14 }, { label: t('Age'), width: 9 },
      { label: t('Meet'), width: 16 },
      { label: t('Speed'), width: 10, align: 'right' },
      { label: t('Pace /100'), width: 10, align: 'right' },
      { label: t('Pts'), width: 7, align: 'right' },
      { label: t('Races'), width: 7, align: 'right' },
    ], events.map(e => [
      { text: raceName(e.best), bold: true, color: STROKE_COLOR[e.stroke] },
      t(e.course === 'SCM' ? '25 m' : '50 m'),
      { text: fmt.time(e.best.seconds), bold: true },
      fmt.date(e.best.date), { text: ageLabel(e.best.date), color: DOC.hydro70 },
      { text: e.best.meet || '—', color: DOC.hydro70 },
      e.speed.toFixed(3), fmt.time(e.pace100),
      e.points == null ? '—' : String(e.points), String(e.n),
    ]));
    doc.note(METHOD_NOTE());
    return doc.stampFooters();
  });
}

/* -------------------------------------------------- analysis ------------ */
function buildAnalysisDoc(rows, lang) {
  return LANG.as(lang, () => {
    const events = store.events(rows);
    const modelled = events.filter(e => e.model);
    const scored = rows.filter(r => waPoints(r) != null);
    const doc = new ExportDoc({ title: t('Analysis'),
                                subtitle: t('{0} races', rows.length) });

    doc.sectionTitle(t('Performance against age'));
    doc.bestStrip([
      { label: t('Age now'), value: ageLabel(new Date().toISOString().slice(0, 10)),
        sub: t('born {0}', fmt.date(ATHLETE.birth)) },
      { label: t('Age at first race'), value: ageLabel(rows[0].date), sub: fmt.date(rows[0].date) },
      { label: t('Events modelled'), value: String(modelled.length),
        sub: t('of {0} recorded', events.length) },
      { label: t('Median trend'), value: modelled.length ? fmt.pct(
          [...modelled].map(e => e.model.ratePct).sort((a, b) => a - b)[Math.floor(modelled.length / 2)])
          : '—', sub: t('change in race time per year') },
    ]);

    const ageSeries = seriesFromRows(scored).map(s => ({
      ...s, points: s.points.map(p => ({ xv: ageAt(p.r.date), y: waPoints(p.r), r: p.r })),
    }));
    doc.chart({
      series: ageSeries, height: 430, invertY: false, captions: false,
      yFmt: v => String(Math.round(v)), yTitle: t('WA POINTS  (higher ↑)'),
      xFmt: v => (LANG.get() === 'zh' ? v.toFixed(1) + '岁' : v.toFixed(1) + ' yrs'),
      xFmt2: years => fmt.monthYear(
        new Date((dayNum(ATHLETE.birth) + years * 365.2425) * 86400000)
          .toISOString().slice(0, 10)),
    });
    doc.note(t('Every scored race plotted against the athlete\'s age on the day. Because World Aquatics points normalise for event and pool length, the vertical axis is comparable across all strokes and distances.'));

    doc.sectionTitle(t('Progression model, by event'));
    doc.table([
      { label: t('Event'), width: 19 }, { label: t('Pool'), width: 7 },
      { label: t('n'), width: 5, align: 'right' },
      { label: t('First'), width: 10, align: 'right' },
      { label: t('Best'), width: 10, align: 'right' },
      { label: t('Gain'), width: 13, align: 'right' },
      { label: t('Rate / year'), width: 10, align: 'right' },
      { label: t('95% interval'), width: 15, align: 'right' },
      { label: 'R²', width: 7, align: 'right' },
      { label: t('Signal'), width: 9 },
      { label: t('Pts'), width: 6, align: 'right' },
    ], events.map(e => {
      const m = e.model;
      return [
        { text: raceName(e.best), bold: true, color: STROKE_COLOR[e.stroke] },
        t(e.course === 'SCM' ? '25 m' : '50 m'), String(e.n),
        { text: fmt.time(e.first.seconds), color: DOC.hydro70 },
        { text: fmt.time(e.best.seconds), bold: true, color: DOC.good },
        { text: e.dropSec > 0 ? `−${e.dropSec.toFixed(2)} s (${e.dropPct.toFixed(1)}%)` : '—',
          color: e.dropSec > 0 ? DOC.good : DOC.hydro70 },
        { text: m ? fmt.pct(m.ratePct) : '—', color: m ? (m.ratePct < 0 ? DOC.good : DOC.bad) : DOC.hydro70 },
        { text: m ? `${fmt.pct(m.loPct)} … ${fmt.pct(m.hiPct)}` : '—', color: DOC.hydro70 },
        m ? m.r2.toFixed(3) : '—',
        { text: m ? (m.significant ? t('clear') : t('tentative')) : 'n<3',
          color: m && m.significant ? DOC.good : DOC.hydro70 },
        e.points == null ? '—' : String(e.points),
      ];
    }));
    doc.note(t('Rate is the slope of a least-squares fit of log race-time on date, expressed as percentage change per year; negative means getting faster. The interval is the two-sided 95% confidence interval on that slope. "Clear" marks events where the interval excludes zero.')
      + ' ' + t('An event needs at least three races to be modelled: two points define a line exactly, leaving no residual from which to estimate uncertainty.'));

    /* stroke balance */
    const strokeBest = STROKES.map(st => {
      const evs = events.filter(e => e.stroke === st && e.points);
      if (!evs.length) return null;
      const top = evs.reduce((a, b) => (b.points > a.points ? b : a), evs[0]);
      return { stroke: st, points: top.points, ev: top };
    }).filter(Boolean).sort((a, b) => b.points - a.points);
    if (strokeBest.length) {
      doc.sectionTitle(t('Stroke balance'));
      const max = Math.max(...strokeBest.map(s => s.points));
      doc.card(strokeBest.length * 40 + 20, (x, X, Y, W) => {
        strokeBest.forEach((s, i) => {
          const yy = Y + 26 + i * 40;
          x.font = `700 13px ${BODY_FONT}`; x.fillStyle = STROKE_COLOR[s.stroke];
          x.textAlign = 'left'; x.fillText(STROKE_LABEL[s.stroke], X + 18, yy);
          x.font = `400 12px ${BODY_FONT}`; x.fillStyle = DOC.hydro; x.textAlign = 'right';
          x.fillText(`${s.points} ${t('pts')} · ${raceName(s.ev.best)} · ${fmt.time(s.ev.best.seconds)}`,
                     X + W - 18, yy);
          x.fillStyle = DOC.hair; x.fillRect(X + 18, yy + 8, W - 36, 9);
          x.fillStyle = STROKE_COLOR[s.stroke];
          x.fillRect(X + 18, yy + 8, (W - 36) * (s.points / max), 9);
        });
        x.textAlign = 'left';
      });
    }

    /* speed endurance */
    const endur = [];
    for (const st of STROKES) for (const co of ['SCM', 'LCM']) {
      const e50 = events.find(e => e.stroke === st && e.course === co && e.distance === 50);
      const e100 = events.find(e => e.stroke === st && e.course === co && e.distance === 100);
      if (!e50 || !e100) continue;
      endur.push({ st, co, t50: e50.best.seconds, t100: e100.best.seconds,
                   gap: Math.abs(dayNum(e50.best.date) - dayNum(e100.best.date)) });
    }
    if (endur.length) {
      doc.sectionTitle(t('Speed endurance'));
      doc.table([
        { label: t('Stroke'), width: 17 }, { label: t('Pool'), width: 8 },
        { label: t('50 m'), width: 11, align: 'right' },
        { label: t('100 m'), width: 11, align: 'right' },
        { label: 'Riegel n', width: 11, align: 'right' },
        { label: '100 ⁄ 2×50', width: 12, align: 'right' },
        { label: '', width: 30 },
      ], endur.map(e => [
        { text: STROKE_LABEL[e.st], bold: true, color: STROKE_COLOR[e.st] },
        t(e.co === 'SCM' ? '25 m' : '50 m'), fmt.time(e.t50), fmt.time(e.t100),
        { text: (Math.log(e.t100 / e.t50) / Math.LN2).toFixed(3), bold: true },
        (e.t100 / (2 * e.t50)).toFixed(3),
        { text: e.gap > 180 ? t('bests {0} months apart', Math.round(e.gap / 30)) : '',
          color: DOC.hydro70 },
      ]));
      doc.note(t('Riegel exponent n from T = k · dⁿ, solved between the 50 and the 100 of the same stroke and pool. Lower is better; world-class sprinters sit near 1.05–1.10 over this step.'));
    }

    /* same-day repeats */
    const byDay = new Map();
    for (const r of rows) {
      const k = r.date + '|' + eventKey(r);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    }
    /* keep swims in the order they were raced (heat before final), not by time */
    const repeats = [...byDay.values()].filter(v => v.length > 1)
      .map(v => [...v].sort((a, b) => (a.id || 0) - (b.id || 0)))
      .sort((a, b) => b[0].date.localeCompare(a[0].date));
    if (repeats.length) {
      doc.sectionTitle(t('Racing the same event twice in a day'));
      doc.table([
        { label: t('Date'), width: 18 }, { label: t('Event'), width: 26 },
        { label: t('Pool'), width: 10 }, { label: t('Swims'), width: 24 },
        { label: t('Spread'), width: 11, align: 'right' },
        { label: t('Best of the day'), width: 15, align: 'right' },
      ], repeats.map(rs => {
        const fastest = Math.min(...rs.map(r => r.seconds));
        const slowest = Math.max(...rs.map(r => r.seconds));
        return [fmt.date(rs[0].date),
          { text: raceName(rs[0]), bold: true, color: STROKE_COLOR[rs[0].stroke] },
          t(rs[0].course === 'SCM' ? '25 m' : '50 m'),
          rs.map(r => fmt.time(r.seconds)).join('  →  '),
          (slowest - fastest).toFixed(2) + ' s',
          { text: fmt.time(fastest), bold: true, color: DOC.good }];
      }));
    }

    doc.sectionTitle(t('Method and data provenance'));
    doc.note(METHOD_NOTE() + ' ' +
      t('Points are scored against {0}.', t(WR_ASOF)) + ' ' +
      t('Age is calculated from {0} to the date of each race.', fmt.date(ATHLETE.birth)));
    return doc.stampFooters();
  });
}

/* ------------------------------------------------------- delivery ------- */
/** Files are fetched from a normal URL so in-app browsers (WeChat) can save them. */
async function deliver(path, payload, onProgress) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  if (onProgress) onProgress(j);
  location.href = j.url;
  return j;
}

async function exportDocAsPDF(doc, name, title, onProgress) {
  const images = await doc.toJPEGs();
  return deliver('/api/export/pdf',
                 { images, name, title, links: doc.links, pageWidth: PAGE_W, pageHeight: PAGE_H },
                 onProgress);
}

async function exportCanvasAsPNG(canvas, name, onProgress) {
  return deliver('/api/export/png',
                 { image: canvas.toDataURL('image/png'), name }, onProgress);
}

/** A single chart card as a standalone PNG. */
function buildChartCard(ev, lang) {
  return LANG.as(lang, () => {
    const doc = new ExportDoc({ title: t('Event report'), subtitle: eventLabel(ev.best), scale: 2 });
    doc.sectionTitle(eventLabel(ev.best), STROKE_COLOR[ev.stroke]);
    doc.bestStrip([
      { label: t('Personal best'), value: fmt.time(ev.best.seconds), color: STROKE_COLOR[ev.stroke],
        sub: `${fmt.date(ev.best.date)} · ${ageLabel(ev.best.date)}` },
      { label: t('Speed'), value: ev.speed.toFixed(3), unit: 'm/s',
        sub: t('mean velocity over {0} m', ev.distance) },
      { label: t('Pace'), value: fmt.time(ev.pace100), sub: t('per 100 m') },
      { label: t('WA points'), value: ev.points == null ? '—' : String(ev.points),
        sub: ev.points ? t('vs world record') : t('no base time') },
    ]);
    doc.chart({
      series: seriesFromRows(ev.rows), height: 470,
      refLine: { y: ev.best.seconds, label: `${t('Personal best')} ${fmt.time(ev.best.seconds)}`,
                 color: STROKE_COLOR[ev.stroke] },
      caption: p => {
        const pts = waPoints(p.r);
        return [fmt.time(p.y), fmt.dateShort(p.r.date) + (pts ? ` · ${pts}${t('pts')}` : '')];
      },
    });
    doc.note(METHOD_NOTE());
    doc.stampFooters();
    return cropToContent(doc);
  });
}

/** Trim the page canvas to the drawn content so a PNG has no dead space. */
function cropToContent(doc) {
  const src = doc.pages[0], s = doc.scale;
  const h = Math.min(PAGE_H, doc.y + 108);   // room for the link box and footer
  const out = document.createElement('canvas');
  out.width = src.width; out.height = Math.round(h * s);
  const x = out.getContext('2d');
  x.fillStyle = DOC.wash; x.fillRect(0, 0, out.width, out.height);
  x.drawImage(src, 0, 0, src.width, Math.round(h * s), 0, 0, out.width, Math.round(h * s));
  x.save(); x.scale(s, s);
  doc.linkBox(x, h - 92);
  x.fillStyle = DOC.hair; x.fillRect(MARGIN, h - 44, PAGE_W - MARGIN * 2, 1.5);
  x.font = `400 11px ${BODY_FONT}`; x.fillStyle = DOC.hydro70; x.textAlign = 'left';
  x.fillText(`${ATHLETE.nameZh || ATHLETE.name} · ${t('born {0}', fmt.date(ATHLETE.birth))} · `
             + t('Generated {0}', fmt.date(new Date().toISOString().slice(0, 10))), MARGIN, h - 24);
  x.restore();
  return out;
}
