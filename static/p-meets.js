/* Meets — competition index and per-competition report */
'use strict';

(async function () {
  mountShell('meets.html');
  const app = document.getElementById('app');
  const rows = await store.load();
  const meets = store.meets(rows);
  const tagged = tagProgression(rows);
  const byId = new Map(tagged.map(r => [r.id, r]));
  const want = new URLSearchParams(location.search).get('date');

  if (!meets.length) {
    app.innerHTML = `<div class="empty-state" style="margin-top:30px"><h2>${t('No competitions yet')}</h2>
      <p>${t('Add a result to create the first meet.')}</p>
      <p><a href="add.html">${t('Add Result')}</a></p></div>`;
    return;
  }

  /* ------------------------- one competition ------------------------- */
  if (want && meets.some(m => m.date === want)) {
    const m = meets.find(x => x.date === want);
    const idx = meets.indexOf(m);
    const prev = meets[idx + 1], next = meets[idx - 1];

    /* best time in each event BEFORE this meet, to measure what the day produced */
    const before = new Map();
    for (const r of rows) {
      if (r.date >= m.date) continue;
      const k = eventKey(r);
      if (!before.has(k) || r.seconds < before.get(k)) before.set(k, r.seconds);
    }
    const pbs = m.rows.filter(r => byId.get(r.id)?.wasPB);
    const gained = m.rows.reduce((a, r) => {
      const b = before.get(eventKey(r));
      return a + (b && r.seconds < b ? b - r.seconds : 0);
    }, 0);
    const pts = m.rows.map(r => waPoints(r)).filter(Boolean);

    app.innerHTML = `
      <div class="crumb" style="margin-top:18px"><a href="meets.html">${t('Meets')}</a> / ${fmt.date(m.date)}</div>
      <div class="sec-title" style="margin-top:6px">${esc(m.name || fmt.date(m.date))}</div>
      <div class="grid g4">
        ${[[t('Races swum'), m.rows.length, m.courses.map(c => t(c === 'SCM' ? '25 m pool' : '50 m pool')).join(' + ')],
           [t('Personal bests'), pbs.length, pbs.length ? pbs.map(r => raceName(r)).join(', ') : t('none on the day')],
           [t('Time gained'), gained > 0 ? '−' + gained.toFixed(2) + '<small> s</small>' : '—', t('against previous bests')],
           [t('Age'), ageLabel(m.date), `${fmt.date(m.date)}`]]
          .map((x, i) => `<div class="tile${i === 1 && pbs.length ? ' accent' : ''}">
            <div class="k">${x[0]}</div><div class="v">${x[1]}</div><div class="d">${esc(String(x[2]))}</div></div>`).join('')}
      </div>

      <div class="sec-title">${t('Results')}</div>
      <div class="tbl-wrap"><table class="data"><thead><tr>
        <th>${t('Event')}</th><th>${t('Pool')}</th><th>${t('Time')}</th>
        <th>${t('Previous best')}</th><th>${t('Change')}</th>
        <th>${t('Speed')}</th><th>${t('Pace /100')}</th><th>${t('WA pts')}</th><th>${t('Round')}</th>
      </tr></thead><tbody>
      ${m.rows.map(r => {
        const b = before.get(eventKey(r));
        const d = b ? r.seconds - b : null;
        return `<tr>
          <td><a href="events.html?e=${encodeURIComponent(eventKey(r))}"
                 style="color:${STROKE_COLOR[r.stroke]};font-weight:600;text-decoration:none">
              ${raceName(r)}</a></td>
          <td>${courseTag(r.course)}</td>
          <td class="${byId.get(r.id)?.wasPB ? 'pb' : ''}" style="font-weight:700">
            ${byId.get(r.id)?.wasPB ? '★ ' : ''}${fmt.time(r.seconds)}</td>
          <td class="mut">${b ? fmt.time(b) : t('first time')}</td>
          <td class="${d == null ? 'mut' : d < 0 ? 'good' : 'bad'}">${d == null ? '—' : fmt.delta(d)}</td>
          <td>${fmt.speed(r.distance, r.seconds).toFixed(3)} m/s</td>
          <td>${fmt.time(fmt.pace100(r.distance, r.seconds))}</td>
          <td>${waPoints(r) ?? '—'}</td>
          <td class="mut">${esc(r.round || '—')}</td></tr>`;
      }).join('')}
      </tbody></table></div>

      <div class="sec-title">${t('Meet performance profile')}</div>
      <div class="card">
        ${bestStrip([
          { label: t('Best of the meet'), value: pts.length ? Math.max(...pts) + `<small> ${t('pts')}</small>` : '—',
            sub: pts.length ? raceName(m.rows[m.rows.map(r => waPoints(r) || 0)
                 .indexOf(Math.max(...pts))]) : '' },
          { label: t('Mean points'), value: pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : '—',
            sub: tn(pts.length, 'across {0} scored race', 'across {0} scored races') },
          { label: t('Distance swum'), value: m.metres + '<small> m</small>', sub: t('racing volume') },
          { label: t('Strokes'), value: [...new Set(m.rows.map(r => r.stroke))].length,
            sub: [...new Set(m.rows.map(r => STROKE_LABEL[r.stroke]))].join(', ') },
        ])}
        <div id="mchart"></div>
        <p class="footnote" style="margin-top:10px">${t("Bars show World Aquatics points for each race at this meet, with the athlete's previous best in the same event marked for comparison.")}</p>
      </div>

      <div class="controls" style="margin-top:18px">
        ${prev ? `<a class="chip" href="meets.html?date=${prev.date}">← ${fmt.date(prev.date)}</a>` : ''}
        <a class="chip" href="meets.html">${t('All meets')}</a>
        ${next ? `<a class="chip" href="meets.html?date=${next.date}">${fmt.date(next.date)} →</a>` : ''}
      </div>`;

    /* horizontal comparison bars: this meet vs previous best, in points */
    const host = document.getElementById('mchart');
    const items = m.rows.map(r => ({ r, now: waPoints(r),
                                     was: before.has(eventKey(r))
                                          ? waPoints({ ...r, seconds: before.get(eventKey(r)) }) : null }))
                        .filter(x => x.now != null);
    if (!items.length) { host.innerHTML = `<div class="status">${t('No scored races at this meet.')}</div>`; }
    else {
      const max = Math.max(...items.flatMap(x => [x.now, x.was || 0])) * 1.12;
      host.innerHTML = `<div style="display:grid;gap:9px;margin-top:4px">
        ${items.map(x => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
              <span style="font-weight:600;color:${STROKE_COLOR[x.r.stroke]}">${raceName(x.r)} ${courseTag(x.r.course)}</span>
              <span class="mono">${fmt.time(x.r.seconds)} · <b>${x.now}</b> ${t('pts')}
                ${x.was ? `<span class="mut">${t('prev {0}', x.was)}</span>`
                        : `<span class="mut">(${t('first')})</span>`}</span>
            </div>
            <div class="bar-track" style="position:relative">
              <i style="width:${(x.now / max * 100).toFixed(1)}%;background:${STROKE_COLOR[x.r.stroke]};
                 transition:width .6s cubic-bezier(.22,1,.36,1)"></i>
              ${x.was ? `<span style="position:absolute;top:-3px;bottom:-3px;
                 left:${(x.was / max * 100).toFixed(1)}%;width:2px;background:#0F1E36"></span>` : ''}
            </div>
          </div>`).join('')}</div>`;
      requestAnimationFrame(() => host.querySelectorAll('.bar-track i').forEach((el, i) => {
        const w = el.style.width; el.style.width = '0';
        setTimeout(() => { el.style.width = w; }, 60 + i * 55);
      }));
    }
    return;
  }

  /* --------------------------- meet index --------------------------- */
  const years = [...new Set(meets.map(m => m.date.slice(0, 4)))].sort().reverse();
  app.innerHTML = `
    <div class="pagebar" style="border:0;background:transparent">
      <div class="pagebar-in" style="padding-left:0">
        ${t('{0} competitions · {1} races · {2} to {3}', meets.length, rows.length,
             fmt.date(meets[meets.length - 1].date), fmt.date(meets[0].date))}
      </div>
    </div>
    ${years.map(y => {
      const ms = meets.filter(m => m.date.startsWith(y));
      return `<div class="sec-title">${y}
        <span style="font-size:12px;letter-spacing:0;text-transform:none;color:#8b93a1">
        ${tn(ms.length, '{0} meet', '{0} meets')} · ${t('{0} races', ms.reduce((a, m) => a + m.rows.length, 0))}</span></div>
      <div class="grid g3">${ms.map(m => {
        const pbs = m.rows.filter(r => byId.get(r.id)?.wasPB).length;
        return `<a class="meet-card" href="meets.html?date=${m.date}">
          <div class="d">${fmt.date(m.date)}</div>
          <div class="m">${esc(m.name || t('Competition'))} · ${ageLabel(m.date)}
            · ${m.courses.map(c => t(c === 'SCM' ? '25 m pool' : '50 m pool')).join(' + ')}</div>
          <div class="evs">
            ${m.rows.map(r => `<span class="pill" style="border-color:${STROKE_COLOR[r.stroke]}">
               ${raceName(r)} ${fmt.time(r.seconds)}</span>`).join('')}
          </div>
          ${pbs ? `<div class="evs" style="margin-top:6px">
            <span class="pill pb">${tn(pbs, '★ {0} personal best', '★ {0} personal bests')}</span></div>` : ''}
        </a>`;
      }).join('')}</div>`;
    }).join('')}`;
})();
