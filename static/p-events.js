/* Events — menu by stroke, grid groupable by stroke / distance / pool */
'use strict';

(async function () {
  mountShell('events.html');
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="grid" style="grid-template-columns:1fr;gap:14px">
      <div class="controls" id="controls"></div>
    </section>
    <section class="grid" style="grid-template-columns:1fr;gap:14px">
      <div class="menu" id="menu"></div>
    </section>
    <div id="content"></div>`;

  const rows = await store.load();
  const events = store.events(rows);
  if (!events.length) {
    document.getElementById('content').innerHTML =
      `<div class="empty-state" style="margin-top:24px"><h2>${t('No events recorded')}</h2>
       <p><a href="add.html">${t('Add the first result')}</a></p></div>`;
    return;
  }

  const state = {
    get sel() { return new URLSearchParams(location.search).get('e') || ''; },
    group: localStorage.getItem('ivy.ev.group') || 'stroke',
    sort: localStorage.getItem('ivy.ev.sort') || 'distance',
    course: localStorage.getItem('ivy.ev.course') || 'all',
  };

  /* ---------------- controls ---------------- */
  function renderControls() {
    const seg = (name, opts, cur) => opts.map(([v, l]) =>
      `<button class="chip" data-set="${name}" data-v="${v}" aria-pressed="${cur === v}">${esc(t(l))}</button>`).join('');
    document.getElementById('controls').innerHTML =
      `<span class="crumb">${t('Group')}${help('group')}</span>` +
      seg('group', [['stroke', 'Stroke'], ['distance', 'Distance'], ['course', 'Pool']], state.group) +
      `<span class="crumb" style="margin-left:10px">${t('Order')}</span>` +
      seg('sort', [['distance', 'Distance'], ['best', 'Best time'],
                   ['improve', 'Improvement'], ['recent', 'Most recent']], state.sort) +
      `<span class="crumb" style="margin-left:10px">${t('Pool')}</span>` +
      seg('course', [['all', 'All'], ['SCM', '25 m'], ['LCM', '50 m']], state.course) +
      `<div class="spacer" style="flex:1"></div>` +
      (state.sel ? `<a class="chip" href="events.html">${t('← All events')}</a>` : '');
    document.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
      state[b.dataset.set] = b.dataset.v;
      localStorage.setItem('ivy.ev.' + b.dataset.set, b.dataset.v);
      renderControls(); renderMenu(); renderBody();
    });
  }

  const visible = () => events.filter(e => state.course === 'all' || e.course === state.course);

  const sorters = {
    distance: (a, b) => a.distance - b.distance || a.course.localeCompare(b.course),
    best: (a, b) => (b.points || 0) - (a.points || 0),
    improve: (a, b) => (a.model?.ratePct ?? 0) - (b.model?.ratePct ?? 0),
    recent: (a, b) => b.last.date.localeCompare(a.last.date),
  };

  /* ---------------- stroke menu ---------------- */
  function renderMenu() {
    const list = visible();
    document.getElementById('menu').innerHTML = STROKES
      .filter(st => list.some(e => e.stroke === st))
      .map(st => {
        const evs = list.filter(e => e.stroke === st).sort(sorters.distance);
        return `<div class="menu-group">
          <div class="h" style="background:${STROKE_COLOR[st]}">${STROKE_LABEL[st]}
            <span style="font-size:13px;opacity:.85">${evs.length}</span></div>
          <ul>${evs.map(e => `<li><a href="events.html?e=${encodeURIComponent(e.key)}"
              class="${state.sel === e.key ? 'on' : ''}">
              <span>${t('{0} metres', e.distance)} · ${t(e.course === 'SCM' ? '25 m pool' : '50 m pool')}</span>
              <span class="t">${fmt.time(e.best.seconds)}</span></a></li>`).join('')}</ul>
        </div>`;
      }).join('');
  }

  /* ---------------- one event, in full ---------------- */
  function renderDetail(ev) {
    const m = ev.model;
    const series = seriesFromRows(ev.rows);
    series.forEach(s => s.model = m);
    const tagged = tagProgression(ev.rows);
    return `
      <div class="sec-title">${esc(ev.label)}</div>
      <div class="card">
        <div id="evtools"></div>
        ${bestOfEvent(ev)}
        <div class="legend">${legendHTML(series, { showCourse: false })}
          <span style="color:#4a566b"><i class="dash" style="border-color:${STROKE_COLOR[ev.stroke]}"></i>${t('fitted trend')}${help('trend')}</span>
        </div>
        <div id="evchart"></div>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h2>${t('Progression model')}</h2>
          <dl class="kv" style="margin-top:10px">
            <dt>${t('Races')}</dt><dd>${ev.n}</dd>
            <dt>${t('First recorded')}</dt><dd>${fmt.time(ev.first.seconds)} · ${fmt.date(ev.first.date)}</dd>
            <dt>${t('Personal best')}</dt><dd class="pb">${fmt.time(ev.best.seconds)} · ${fmt.date(ev.best.date)}</dd>
            <dt>${t('Total improvement')}</dt><dd class="${ev.dropSec > 0 ? 'good' : 'mut'}">${
              ev.dropSec > 0 ? `−${ev.dropSec.toFixed(2)} s (${ev.dropPct.toFixed(1)}%)` : '—'}</dd>
            <dt>${t('Age at best')}</dt><dd>${ageLabel(ev.best.date)}</dd>
            <dt>${t('Span')}</dt><dd>${t('{0} days', ev.spanDays)}</dd>
            ${m ? `<dt>${t('Trend')}</dt><dd class="${m.ratePct < 0 ? 'good' : 'bad'}">${t('{0} per year', fmt.pct(m.ratePct))}</dd>
                   <dt>${t('95% interval')}</dt><dd>${fmt.pct(m.loPct)} … ${fmt.pct(m.hiPct)}</dd>
                   <dt>R²</dt><dd>${m.r2.toFixed(3)}</dd>
                   <dt>${t('Statistically clear')}</dt><dd>${m.significant ? t('yes') : t('not yet')}</dd>`
                : `<dt>${t('Trend')}</dt><dd class="mut">${t('needs 3+ races')}</dd>`}
          </dl>
          ${m ? `<p class="footnote" style="margin-top:12px">
            ${t('Least-squares fit of log-time against date. The rate is the proportional change in race time per year, so it stays comparable across events of any length.')}
            ${m.significant
              ? t('The interval excludes zero, so the trend is distinguishable from noise.')
              : t('The interval still spans zero — more races are needed before the trend is firm.')}</p>` : ''}
        </div>
        <div class="card"><h2>${t('Every swim')}</h2>
          <div class="tbl-wrap" style="border:0;margin-top:10px">
          <table class="data"><thead><tr>
            <th>${t('Date')}</th><th>${t('Age')}</th><th>${t('Time')}</th><th>Δ</th>
            <th>${t('Speed')}${help('pace')}</th><th>${t('Pace /100')}</th>
            <th>${t('Pts')}${help('points')}</th><th>${t('Meet')}</th>
          </tr></thead><tbody>
          ${tagged.slice().reverse().map(r => `<tr>
            <td>${fmt.date(r.date)}</td><td class="mut">${ageLabel(r.date)}</td>
            <td class="${r.wasPB ? 'pb' : ''}">${r.wasPB ? '★ ' : ''}${fmt.time(r.seconds)}</td>
            <td class="${r.improvedBy ? 'good' : 'mut'}">${r.improvedBy ? '−' + r.improvedBy.toFixed(2) : '—'}</td>
            <td>${fmt.speed(r.distance, r.seconds).toFixed(3)}</td>
            <td>${fmt.time(fmt.pace100(r.distance, r.seconds))}</td>
            <td>${waPoints(r) ?? '—'}</td>
            <td class="mut">${esc(r.meet || '—')}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>`;
  }

  /* ---------------- grid of small multiples ---------------- */
  function panel(ev) {
    const m = ev.model;
    return `<div class="sm" data-ev="${esc(ev.key)}">
      <h3><a href="events.html?e=${encodeURIComponent(ev.key)}"
        style="text-decoration:none;color:inherit">${t('{0} m {1}', ev.distance, STROKE_LABEL[ev.stroke])}</a>
        <span>${t(ev.course === 'SCM' ? '25 m' : '50 m')}</span></h3>
      <div class="meta">
        <span><b style="font-family:'Teko',sans-serif;font-size:19px">${fmt.time(ev.best.seconds)}</b> ${t('best')}</span>
        <span>${fmt.speed(ev.distance, ev.best.seconds).toFixed(3)} m/s</span>
        <span>${fmt.time(ev.pace100)} /100 m</span>
        <span>${ev.points ? ev.points + ' ' + t('pts') : ''}</span>
      </div>
      <div class="meta" style="margin-top:0">
        <span>n=${ev.n}</span>
        ${ev.n > 1 && ev.dropSec > 0 ? `<span class="good">−${ev.dropSec.toFixed(2)} s ${t('total')}</span>`
          : ev.n > 1 ? '' : `<span class="mut">${t('single race')}</span>`}
        ${m ? `<span class="${m.ratePct < 0 ? 'good' : 'bad'}">${fmt.pct(m.ratePct)}/${t('yr')}</span>` : ''}
      </div>
      <div class="chart-host"></div>
      <div class="sm-tools"></div>
    </div>`;
  }

  function renderGrid() {
    const list = visible();
    let groups;
    if (state.group === 'stroke') {
      groups = STROKES.filter(s => list.some(e => e.stroke === s))
        .map(s => ({ title: STROKE_LABEL[s], color: STROKE_COLOR[s],
                     items: list.filter(e => e.stroke === s) }));
    } else if (state.group === 'distance') {
      groups = [...new Set(list.map(e => e.distance))].sort((a, b) => a - b)
        .map(d => ({ title: t('{0} metres', d), items: list.filter(e => e.distance === d) }));
    } else {
      groups = ['SCM', 'LCM'].filter(c => list.some(e => e.course === c))
        .map(c => ({ title: COURSE_LABEL[c], items: list.filter(e => e.course === c) }));
    }
    groups.forEach(g => g.items.sort(sorters[state.sort]));
    return groups.map(g => `
      <div class="sec-title" ${g.color ? `style="color:${g.color}"` : ''}>${esc(g.title)}
        <span style="font-size:12px;letter-spacing:0;text-transform:none;color:#8b93a1">
          ${tn(g.items.length, '{0} event', '{0} events')}</span></div>
      <div class="grid g3">${g.items.map(panel).join('')}</div>`).join('');
  }

  /* ---------------- draw ---------------- */
  function renderBody() {
    const content = document.getElementById('content');
    const ev = events.find(e => e.key === state.sel);
    if (ev) {
      content.innerHTML = renderDetail(ev);
      const series = seriesFromRows(ev.rows);
      series.forEach(s => s.model = ev.model);
      chartExportButton(ev, document.getElementById('evtools'));
      lineChart(document.getElementById('evchart'), {
        series, height: 340, trend: true,
        refLine: { y: ev.best.seconds, label: `PB ${fmt.time(ev.best.seconds)}`,
                   color: STROKE_COLOR[ev.stroke] },
        aria: `${ev.label} progression`,
      });
      return;
    }
    content.innerHTML = renderGrid();
    content.querySelectorAll('.sm').forEach(el => {
      const ev2 = events.find(e => e.key === el.dataset.ev);
      const series = seriesFromRows(ev2.rows);
      series.forEach(s => s.model = ev2.model);
      chartExportButton(ev2, el.querySelector('.sm-tools'));
      lineChart(el.querySelector('.chart-host'), {
        series, height: 170, trend: ev2.n >= 3,
        margin: { t: 12, r: 46, b: 26, l: 44 },
        yTitle: '', aria: `${ev2.label} progression`,
        refLine: { y: ev2.best.seconds, label: '', color: STROKE_COLOR[ev2.stroke] },
      });
    });
  }

  renderControls(); renderMenu(); renderBody();
})();
