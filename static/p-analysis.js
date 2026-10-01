/* Analysis — progression modelling, endurance profile, methods */
'use strict';

(async function () {
  mountShell('analysis.html');
  const app = document.getElementById('app');
  const rows = await store.load();
  const events = store.events(rows);
  if (!rows.length) { app.innerHTML = '<div class="empty-state" style="margin-top:30px">No data.</div>'; return; }

  const modelled = events.filter(e => e.model);
  const unmodelled = events.filter(e => !e.model);
  /* the calendar month an age on the x axis corresponds to */
  const ageToMonth = years => fmt.monthYear(
    new Date((dayNum(ATHLETE.birth) + years * 365.2425) * 86400000).toISOString().slice(0, 10));
  const scored = rows.filter(r => waPoints(r) != null);

  /* Riegel endurance exponent: T = k·d^n, solved from a 50 and a 100 in the
     same stroke and pool. n = log(T100/T50)/log 2. Lower n = better speed
     endurance; world-class 50→100 sits near 1.05–1.10. */
  const endurance = [];
  for (const st of STROKES) for (const co of ['SCM', 'LCM']) {
    const e50 = events.find(e => e.stroke === st && e.course === co && e.distance === 50);
    const e100 = events.find(e => e.stroke === st && e.course === co && e.distance === 100);
    if (!e50 || !e100) continue;
    const gap = Math.abs(dayNum(e50.best.date) - dayNum(e100.best.date));
    endurance.push({
      stroke: st, course: co, t50: e50.best.seconds, t100: e100.best.seconds,
      n: Math.log(e100.best.seconds / e50.best.seconds) / Math.log(2),
      ratio: e100.best.seconds / (2 * e50.best.seconds), gap,
      d50: e50.best.date, d100: e100.best.date,
    });
  }

  /* repeat swims inside one day — heat/final execution */
  const repeats = [];
  const byDayEvent = new Map();
  for (const r of rows) {
    const k = r.date + '|' + eventKey(r);
    if (!byDayEvent.has(k)) byDayEvent.set(k, []);
    byDayEvent.get(k).push(r);
  }
  for (const [k, rs] of byDayEvent) if (rs.length > 1) {
    rs.sort((a, b) => (a.id || 0) - (b.id || 0));
    const fastest = Math.min(...rs.map(r => r.seconds));
    const slowest = Math.max(...rs.map(r => r.seconds));
    repeats.push({ date: rs[0].date, ev: rs[0], swims: rs, spread: slowest - fastest, fastest });
  }
  repeats.sort((a, b) => b.date.localeCompare(a.date));

  const strokeBest = STROKES.map(st => {
    const evs = events.filter(e => e.stroke === st && e.points);
    if (!evs.length) return null;
    const top = evs.reduce((m, e) => (e.points > m.points ? e : m), evs[0]);
    return { stroke: st, points: top.points, ev: top };
  }).filter(Boolean).sort((a, b) => b.points - a.points);
  const maxStrokePts = Math.max(...strokeBest.map(s => s.points), 1);

  app.innerHTML = `
    <div class="pagebar" style="border:0;background:transparent"><div class="pagebar-in" style="padding-left:0">
      ${t('Reference standard:')}${help('standard')}
      <button class="chip" id="gF" aria-pressed="${SETTINGS.gender === 'F'}">${t("Women's records")}</button>
      <button class="chip" id="gM" aria-pressed="${SETTINGS.gender === 'M'}">${t("Men's records")}</button>
      <span class="mut">${t('World Aquatics points are scored against {0}.', t(WR_ASOF))}</span>
    </div></div>

    <div class="sec-title">${t('Performance against age')}</div>
    <div class="card">
      ${bestStrip([
        { label: t('Age now'), value: ageLabel(new Date().toISOString().slice(0, 10)),
          sub: t('born {0}', fmt.date(ATHLETE.birth)) },
        { label: t('Age at first race'), value: ageLabel(rows[0].date), sub: fmt.date(rows[0].date) },
        { label: t('Events modelled'), value: modelled.length,
          sub: t('of {0} recorded — {1} have fewer than 3 races', events.length, unmodelled.length) },
        { label: t('Median trend'), value: modelled.length
            ? fmt.pct([...modelled].map(e => e.model.ratePct).sort((a, b) => a - b)[Math.floor(modelled.length / 2)])
            : '—', sub: t('change in race time per year') },
      ])}
      <div class="legend" id="agelegend"></div>
      <div id="agechart"></div>
      <p class="footnote" style="margin-top:10px">${t("Every scored race plotted against the athlete's age on the day. Because World Aquatics points normalise for event and pool length, the vertical axis is comparable across all strokes and distances.")}</p>
    </div>

    <div class="sec-title">${t('Progression model, by event')}</div>
    <div class="tbl-wrap"><table class="data"><thead><tr>
      <th>${t('Event')}</th><th>${t('Pool')}</th><th>${t('n')}</th><th>${t('First')}</th>
      <th>${t('Best')}</th><th>${t('Gain')}</th><th>${t('Rate / year')}${help('rate')}</th>
      <th>${t('95% interval')}${help('interval')}</th><th>R²${help('r2')}</th>
      <th>${t('Signal')}${help('signal')}</th><th>${t('Pts')}${help('points')}</th>
    </tr></thead><tbody>
    ${events.map(e => {
      const m = e.model;
      return `<tr>
        <td><a href="events.html?e=${encodeURIComponent(e.key)}"
            style="color:${STROKE_COLOR[e.stroke]};font-weight:600;text-decoration:none">
            ${t('{0} m {1}', e.distance, STROKE_LABEL[e.stroke])}</a></td>
        <td>${courseTag(e.course)}</td>
        <td>${e.n}</td>
        <td class="mut">${fmt.time(e.first.seconds)}</td>
        <td class="pb">${fmt.time(e.best.seconds)}</td>
        <td class="${e.dropSec > 0 ? 'good' : 'mut'}">${e.dropSec > 0
            ? `−${e.dropSec.toFixed(2)} s<span class="mut"> (${e.dropPct.toFixed(1)}%)</span>` : '—'}</td>
        <td class="${m ? (m.ratePct < 0 ? 'good' : 'bad') : 'mut'}">${m ? fmt.pct(m.ratePct) : '—'}</td>
        <td class="mut">${m ? `${fmt.pct(m.loPct)} … ${fmt.pct(m.hiPct)}` : '—'}</td>
        <td>${m ? m.r2.toFixed(3) : '—'}</td>
        <td>${m ? (m.significant ? `<span class="good">${t('clear')}</span>` : `<span class="mut">${t('tentative')}</span>`) : '<span class="mut">n&lt;3</span>'}</td>
        <td>${e.points ?? '—'}</td></tr>`;
    }).join('')}
    </tbody></table></div>
    <p class="footnote" style="margin-top:8px">${t('Rate is the slope of a least-squares fit of log race-time on date, expressed as percentage change per year; negative means getting faster. The interval is the two-sided 95% confidence interval on that slope. "Clear" marks events where the interval excludes zero.')}
    ${t('An event needs at least three races to be modelled: two points define a line exactly, leaving no residual from which to estimate uncertainty.')}
    ${unmodelled.length ? t('Not yet modelled: {0}.',
        unmodelled.map(e => `${raceName(e.best)} ${e.course === 'SCM' ? '25 m' : '50 m'} (n=${e.n})`).join('; ')) : ''}</p>

    <div class="grid g2" style="margin-top:20px">
      <div class="card"><h2>${t('Stroke balance')}</h2>
        <p class="footnote" style="margin:6px 0 12px">${t('Best World Aquatics score reached in each stroke. Comparable across strokes by construction.')}</p>
        <div style="display:grid;gap:10px">
        ${strokeBest.map(s => `<div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
            <span style="font-weight:600;color:${STROKE_COLOR[s.stroke]}">${STROKE_LABEL[s.stroke]}</span>
            <span class="mono"><b>${s.points}</b> ${t('pts')} · ${t('{0} metres', s.ev.distance)} ${courseTag(s.ev.course)} · ${fmt.time(s.ev.best.seconds)}</span>
          </div>
          <div class="bar-track"><i style="width:${(s.points / maxStrokePts * 100).toFixed(1)}%;
            background:${STROKE_COLOR[s.stroke]};transition:width .7s cubic-bezier(.22,1,.36,1)"></i></div>
        </div>`).join('')}</div>
      </div>

      <div class="card"><h2>${t('Speed endurance')}${help('riegel')}</h2>
        <p class="footnote" style="margin:6px 0 12px">Riegel <code>n</code> · <code>T = k · d ⁿ</code> ·
        ${t('Lower is better; world-class sprinters sit near 1.05–1.10 over this step.')}</p>
        ${endurance.length ? `<div class="tbl-wrap" style="border:0">
        <table class="data"><thead><tr><th>${t('Stroke')}</th><th>${t('Pool')}</th>
          <th>${t('50 m')}</th><th>${t('100 m')}</th>
          <th>n${help('riegel')}</th><th>100 ⁄ 2×50</th></tr></thead><tbody>
        ${endurance.map(e => `<tr>
          <td style="color:${STROKE_COLOR[e.stroke]};font-weight:600">${STROKE_LABEL[e.stroke]}</td>
          <td>${courseTag(e.course)}</td>
          <td>${fmt.time(e.t50)}</td><td>${fmt.time(e.t100)}</td>
          <td><b>${e.n.toFixed(3)}</b></td><td>${e.ratio.toFixed(3)}</td></tr>
          ${e.gap > 180 ? `<tr><td colspan="6" class="mut" style="font-size:11.5px;border-top:0;padding-top:0">
            ${t('{0} months separate these two bests, so the exponent mixes two different levels of fitness.', Math.round(e.gap / 30))}</td></tr>` : ''}`).join('')}
        </tbody></table></div>` : `<div class="status">${t('Needs a 50 and a 100 in the same stroke and pool.')}</div>`}
      </div>
    </div>

    ${repeats.length ? `
    <div class="sec-title">${t('Racing the same event twice in a day')}</div>
    <div class="tbl-wrap"><table class="data"><thead><tr>
      <th>${t('Date')}</th><th>${t('Event')}</th><th>${t('Pool')}</th>
      <th>${t('Swims')}</th><th>${t('Spread')}</th><th>${t('Best of the day')}</th>
    </tr></thead><tbody>
    ${repeats.map(x => `<tr>
      <td>${fmt.date(x.date)}</td>
      <td style="color:${STROKE_COLOR[x.ev.stroke]};font-weight:600">${raceName(x.ev)}</td>
      <td>${courseTag(x.ev.course)}</td>
      <td class="mono">${x.swims.map(s => fmt.time(s.seconds)).join('  →  ')}</td>
      <td class="${x.spread > 0 ? 'good' : 'mut'}">${x.spread.toFixed(2)} s</td>
      <td class="pb">${fmt.time(x.fastest)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="footnote" style="margin-top:8px">${t('A small spread with the quicker swim last indicates the athlete can back up a heat and still improve in the final.')}</p>` : ''}

    <div class="sec-title">${t('Method and data provenance')}</div>
    <div class="card"><div class="footnote">
      <p><b>${t('Points.')}</b> ${t('World Aquatics points use {0}, where {1} is the base time for the event and pool length and {2} is the swum time. This build uses {3} as base times, selectable between the women\'s and men\'s tables above. Events with no base time in the table are shown as "—" rather than being estimated.',
        '<code>P = 1000 × (B ⁄ T)³</code>', '<code>B</code>', '<code>T</code>', t(WR_ASOF))}</p>
      <p><b>${t('Trend fitting.')}</b> ${t('Race times are logged before fitting, so the slope reads as a proportional rate and stays comparable between a 50 and a 200. Confidence intervals use the two-sided {0} distribution on {1} degrees of freedom. Events with fewer than three races are not fitted.',
        '<i>t</i>', '<i>n</i>−2')}</p>
      <p><b>${t('Pool length.')}</b> ${t('Short course (25 m) and long course (50 m) results are never pooled. Each is a separate event with its own base time, which is the correct way to compare across the two.')}</p>
      <p><b>${t('Age.')}</b> ${t('Calculated from {0} to the date of each race.', fmt.date(ATHLETE.birth))}</p>
      <p><b>${t('Source.')}</b> ${t('{0} races imported from the training record; one long-course 50 m backstroke on 5 September 2026 came from the summary sheet rather than the event sheet. Results added later through the intake page carry the source they were captured from.', rows.length)}</p>
    </div></div>`;

  /* age chart */
  /* x is the athlete's age in years on the day of the race */
  const ageSeries = seriesFromRows(scored).map(s => ({
    ...s, points: s.points.map(p => ({ xv: ageAt(p.r.date), y: waPoints(p.r), r: p.r })),
  }));
  document.getElementById('agelegend').innerHTML = legendHTML(ageSeries);
  lineChart(document.getElementById('agechart'), {
    series: ageSeries, height: 380, invertY: false,
    yFmt: v => Math.round(v), yTitle: t('WA POINTS  (higher ↑)'),
    xFmt: v => (LANG.get() === 'zh' ? v.toFixed(1) + '岁' : v.toFixed(1) + ' yrs'),
    xFmt2: ageToMonth,
    aria: 'World Aquatics points against age',
  });
  requestAnimationFrame(() => document.querySelectorAll('.bar-track i').forEach((el, i) => {
    const w = el.style.width; el.style.width = '0';
    setTimeout(() => { el.style.width = w; }, 80 + i * 60);
  }));

  document.getElementById('gF').onclick = () => { SETTINGS.gender = 'F'; location.reload(); };
  document.getElementById('gM').onclick = () => { SETTINGS.gender = 'M'; location.reload(); };
})();
