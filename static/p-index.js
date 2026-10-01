/* Dashboard */
'use strict';

(async function () {
  mountShell('index.html');
  const app = document.getElementById('app');
  app.innerHTML = `<section><div class="grid g4" id="tiles"></div></section>
    <div class="sec-title">${t('Career progression')}${help('points')}</div>
    <div class="card"><div id="mainbest"></div>
      <div class="legend" id="mainlegend"></div>
      <div id="mainchart" class="chart-skel skel"></div>
      <p class="footnote" style="margin:12px 0 0">
        ${t("World Aquatics points place every event on one comparable scale: {0}. Higher is better. Because the scale is shared, a rise here means real improvement relative to the event's own world standard, not just a faster clock.",
             '<code>P = 1000 × (WR ⁄ T)³</code>')}</p>
    </div>
    <div class="sec-title">${t('Current personal bests')}${help('course')}</div>
    <div class="card"><div id="pbmatrix"></div></div>
    <div class="sec-title">${t('Most recent competition')}</div>
    <div id="recent" class="grid g3"></div>
    <div id="provenance"></div>`;

  const rows = await store.load();
  if (!rows.length) {
    app.innerHTML = `<div class="empty-state" style="margin-top:30px">
      <h2>${t('No results yet')}</h2><p>${t('Add the first race on the {0} page.',
        '<a href="add.html">' + t('Add Result') + '</a>')}</p></div>`;
    return;
  }

  const tagged = tagProgression(rows);
  const events = store.events(rows);
  const meets = store.meets(rows);
  const sources = [...new Set(rows.map(r => r.source))];
  const mmCount = rows.filter(r => r.source === 'meet-mobile').length;
  const lastAdded = rows.reduce((m, r) => (r.created_at > (m || '') ? r.created_at : m), '');
  const pbCount = tagged.filter(r => r.wasPB).length;
  const latest = meets[0];
  const bestPts = rows.map(r => ({ r, p: waPoints(r) })).filter(x => x.p)
                      .sort((a, b) => b.p - a.p)[0];
  const ageNow = ageLabel(new Date().toISOString().slice(0, 10));

  /* ---- headline tiles ---- */
  document.getElementById('tiles').innerHTML = [
    { k: t('Races recorded'), v: rows.length,
      d: t('{0} event/course combinations', events.length) },
    { k: t('Competitions'), v: meets.length,
      d: `${fmt.date(meets[meets.length - 1].date)} → ${fmt.date(latest.date)}` },
    { k: t('Personal bests set'), v: pbCount,
      d: t('{0}% of all swims', ((pbCount / rows.length) * 100).toFixed(0)) },
    { k: t('Strongest swim'), v: bestPts ? bestPts.p : '—', accent: true,
      d: bestPts ? `${raceName(bestPts.r)} ${courseTag(bestPts.r.course)} · ${fmt.time(bestPts.r.seconds)}`
                 : t('World Aquatics points') },
  ].map(x => `<div class="tile${x.accent ? ' accent' : ''}">
      <div class="k">${x.k}</div><div class="v">${x.v}</div><div class="d">${x.d}</div>
    </div>`).join('');

  /* ---- career chart: WA points, every event on one axis ---- */
  const scored = rows.filter(r => waPoints(r) != null);
  const series = seriesFromRows(scored).map(s => ({
    ...s, points: s.points.map(p => ({ ...p, y: waPoints(p.r) })),
  }));
  const fastest = rows.reduce((m, r) =>
    fmt.speed(r.distance, r.seconds) > fmt.speed(m.distance, m.seconds) ? r : m, rows[0]);
  const lastPB = tagged.filter(r => r.wasPB).slice(-1)[0];

  document.getElementById('mainbest').innerHTML = bestStrip([
    { label: t('Best performance'), value: bestPts ? bestPts.p + `<small> ${t('pts')}</small>` : '—',
      color: bestPts ? STROKE_COLOR[bestPts.r.stroke] : null,
      sub: bestPts ? `${raceName(bestPts.r)} · ${fmt.time(bestPts.r.seconds)}` : '' },
    { label: t('Fastest swim'), value: fmt.speed(fastest.distance, fastest.seconds).toFixed(3) + '<small> m/s</small>',
      sub: `${raceName(fastest)} · ${fmt.time(fastest.seconds)}` },
    { label: t('Best pace'), value: fmt.time(fmt.pace100(fastest.distance, fastest.seconds)),
      sub: t('per 100 m') },
    { label: t('Latest best'), value: lastPB ? fmt.time(lastPB.seconds) : '—',
      sub: lastPB ? `${raceName(lastPB)} · ${fmt.date(lastPB.date)}` : '' },
  ]);
  document.getElementById('mainlegend').innerHTML = legendHTML(series);
  const host = document.getElementById('mainchart');
  host.className = '';
  lineChart(host, {
    series, height: 380, invertY: false, star: true,
    yFmt: v => Math.round(v), yTitle: t('WORLD AQUATICS POINTS  (higher ↑)'),
    aria: 'World Aquatics points for every event over time',
  });

  /* ---- personal-best matrix: strokes down, distances across ---- */
  const dists = [...new Set(events.map(e => e.distance))].sort((a, b) => a - b);
  const strokes = STROKES.filter(s => events.some(e => e.stroke === s));
  const maxPts = Math.max(...events.map(e => e.points || 0), 1);
  document.getElementById('pbmatrix').innerHTML = `
    <div style="overflow-x:auto"><table class="matrix">
      <tr><th></th>${dists.map(d => `<th class="dist">${t('{0} metres', d)}</th>`).join('')}</tr>
      ${strokes.map(st => `<tr>
        <th style="color:${STROKE_COLOR[st]}">${STROKE_LABEL[st]}</th>
        ${dists.map(d => {
          const evs = events.filter(e => e.stroke === st && e.distance === d);
          if (!evs.length) return `<td><span class="cell empty">—</span></td>`;
          return `<td>${evs.map(e => `
            <a class="cell" href="events.html?e=${encodeURIComponent(e.key)}">
              <div class="cs">${courseTag(e.course)} n=${e.n}</div>
              <div class="ct">${fmt.time(e.best.seconds)}</div>
              <div class="cbar"><i style="width:${Math.round((e.points || 0) / maxPts * 100)}%;
                   background:${STROKE_COLOR[st]}"></i></div>
              <div class="cs">${e.points ? e.points + ' ' + t('pts') : '—'} · ${fmt.speed(e.distance, e.best.seconds).toFixed(2)} m/s</div>
            </a>`).join('')}</td>`;
        }).join('')}
      </tr>`).join('')}
    </table></div>
    <p class="footnote" style="margin:10px 0 0">${t("Each tile shows the personal best for that stroke, distance and pool length. The bar is World Aquatics points relative to {0}'s own strongest event. Age today: {1}.",
       ATHLETE.preferred, ageNow)}</p>`;

  /* ---- most recent meet ---- */
  document.getElementById('recent').innerHTML = latest.rows.slice(0, 3).map(r => {
    const x = tagged.find(y => y.id === r.id);
    return `<a class="meet-card" href="meets.html?date=${latest.date}">
      <div class="d">${raceName(r)} ${courseTag(r.course)}</div>
      <div class="m">${fmt.date(r.date)} · ${ageLabel(r.date)}</div>
      <div style="font-family:'Teko',sans-serif;font-size:34px;line-height:1">${fmt.time(r.seconds)}</div>
      <div class="evs">
        ${x?.wasPB ? `<span class="pill pb">★ ${t('personal best')}</span>` : ''}
        ${x?.improvedBy ? `<span class="pill">−${x.improvedBy.toFixed(2)} s</span>` : ''}
        ${waPoints(r) ? `<span class="pill">${waPoints(r)} ${t('pts')}</span>` : ''}
      </div></a>`;
  }).join('') + (latest.rows.length > 3
    ? `<a class="meet-card" href="meets.html?date=${latest.date}">
       <div class="d">${t('+{0} more', latest.rows.length - 3)}</div>
       <div class="m">${fmt.date(latest.date)}</div>
       <div class="evs"><span class="pill">${t('View full meet →')}</span></div></a>` : '');

  /* data source / sync status */
  const srcName = { 'workbook': t('training record'), 'summary-tab': t('summary sheet'),
                    'manual': t('entered by hand'), 'meet-mobile': t('Meet Mobile'),
                    'deepseek-text': t('text capture'), 'deepseek-vision': t('screenshot'),
                    'verify': t('test') };
  document.getElementById('provenance').innerHTML = `
    <div class="sec-title">${t('Data source')}</div>
    <div class="card" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:13px">
      <div><span class="mut">${t('Sources')}:</span> ${sources.map(x => esc(srcName[x] || x)).join(' · ')}</div>
      ${mmCount ? `<div><span class="mut">${t('From Meet Mobile')}:</span> <b>${mmCount}</b></div>` : ''}
      ${lastAdded ? `<div><span class="mut">${t('Last updated')}:</span> ${fmt.date(lastAdded.slice(0,10))}</div>` : ''}
      <div style="flex:1"></div>
      <a class="chip" href="add.html">${t('Sync from Meet Mobile')}</a>
    </div>
    <p class="footnote" style="margin:8px 0 0">${t('Records are reconciled against Meet Mobile before they are added, so the two never drift apart.')}</p>`;
})();