/* Export — build print-ready documents from the live record. */
'use strict';

(async function () {
  mountShell('export.html');
  const app = document.getElementById('app');
  const rows = await store.load();
  if (!rows.length) {
    app.innerHTML = `<div class="empty-state" style="margin-top:30px">
      <h2>${t('No results yet')}</h2></div>`;
    return;
  }
  const events = store.events(rows);
  let lang = localStorage.getItem('ivy.exportLang') || LANG.get();

  app.innerHTML = `
    <div class="sec-title">${t('Export')}</div>
    <div class="card">
      <div class="controls" style="margin:0">
        <span class="crumb">${t('Document language')}${help('exportLang')}</span>
        <button class="chip" data-lang="en">English</button>
        <button class="chip" data-lang="zh">中文</button>
        <div style="flex:1"></div>
        <span class="footnote">${t('{0} races · {1} events · {2} competitions',
          rows.length, events.length, store.meets(rows).length)}</span>
      </div>
    </div>

    <div class="sec-title">${t('Whole-record documents')}</div>
    <div class="grid g3">
      <div class="card exp">
        <h3>${t('Personal bests')}</h3>
        <p class="footnote">${t('Every event with its best time, meet, pool length, date and age. Written straight from the database.')}</p>
        <div class="controls" style="margin-top:auto">
          <button class="btn alt" data-do="pb-xlsx">${t('Excel')}</button>
          <button class="btn" data-do="pb-pdf">PDF</button>
        </div>
      </div>
      <div class="card exp">
        <h3>${t('Analysis')}</h3>
        <p class="footnote">${t('The full analysis page: age curve, progression model for every event, stroke balance, speed endurance and method notes.')}</p>
        <div class="controls" style="margin-top:auto">
          <button class="btn" data-do="analysis-pdf">PDF</button>
        </div>
      </div>
      <div class="card exp">
        <h3>${t('All event reports')}</h3>
        <p class="footnote">${t('One page per event: labelled progression chart, progression model and every swim. {0} pages.', events.length)}</p>
        <div class="controls" style="margin-top:auto">
          <button class="btn" data-do="events-pdf">PDF</button>
        </div>
      </div>
    </div>

    <div class="sec-title">${t('Single events')}</div>
    <div class="tbl-wrap"><table class="data" id="evtbl"></table></div>
    <div id="busy"></div>
    <p class="footnote" style="margin-top:16px">
      ${t('Every file carries the athlete\'s name and date of birth, the date it was produced, and a link back to this dashboard.')}
    </p>`;

  const busy = (text) => {
    document.getElementById('busy').innerHTML = text
      ? `<div class="status"><span class="spin"></span>${esc(text)}</div>` : '';
  };
  const failed = (e) => {
    document.getElementById('busy').innerHTML =
      `<div class="status err">${esc(t('Export failed: {0}', e.message))}</div>`;
  };

  function paintLang() {
    document.querySelectorAll('[data-lang]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => {
    lang = b.dataset.lang; localStorage.setItem('ivy.exportLang', lang); paintLang(); paintTable();
  });
  paintLang();

  function paintTable() {
    document.getElementById('evtbl').innerHTML = `
      <thead><tr><th>${t('Event')}</th><th>${t('Pool')}</th><th>${t('Races')}</th>
        <th>${t('Best time')}</th><th>${t('Pts')}</th><th></th></tr></thead>
      <tbody>${events.map(e => `<tr>
        <td style="color:${STROKE_COLOR[e.stroke]};font-weight:600">${LANG.as(lang, () => raceName(e.best))}</td>
        <td>${courseTag(e.course)}</td><td>${e.n}</td>
        <td style="font-weight:700">${fmt.time(e.best.seconds)}</td>
        <td>${e.points ?? '—'}</td>
        <td style="white-space:nowrap">
          <button class="del" data-png="${esc(e.key)}">PNG</button>
          <button class="del" data-pdf="${esc(e.key)}">PDF</button>
        </td></tr>`).join('')}</tbody>`;
    document.querySelectorAll('[data-png]').forEach(b => b.onclick = () =>
      run(t('Rendering the chart…'), async () => {
        const ev = events.find(x => x.key === b.dataset.png);
        await fontsReady();
        const canvas = buildChartCard(ev, lang);
        await exportCanvasAsPNG(canvas, fileName(ev, lang, 'png'));
      }));
    document.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () =>
      run(t('Building the report…'), async () => {
        const ev = events.find(x => x.key === b.dataset.pdf);
        await fontsReady();
        const doc = buildEventDoc(ev, lang);
        await exportDocAsPDF(doc, fileName(ev, lang, 'pdf'), LANG.as(lang, () => ev.label));
      }));
  }

  function fileName(ev, l, ext) {
    const label = LANG.as(l, () => `${ev.distance}${STROKE_LABEL[ev.stroke]}`).replace(/\s+/g, '');
    return `${ATHLETE.preferred}-${label}-${ev.course}.${ext}`;
  }

  async function run(label, fn) {
    busy(label);
    try { await fn(); busy(''); } catch (e) { failed(e); }
  }

  document.querySelector('[data-do="pb-xlsx"]').onclick = () => {
    location.href = `/api/export/pb.xlsx?lang=${lang}&gender=${SETTINGS.gender}`;
  };
  document.querySelector('[data-do="pb-pdf"]').onclick = () =>
    run(t('Building the document…'), async () => {
      await fontsReady();
      const doc = buildPBDoc(rows, lang);
      await exportDocAsPDF(doc, `${ATHLETE.preferred}-personal-bests.pdf`,
                           LANG.as(lang, () => t('Personal bests')));
    });
  document.querySelector('[data-do="analysis-pdf"]').onclick = () =>
    run(t('Building the document…'), async () => {
      await fontsReady();
      const doc = buildAnalysisDoc(rows, lang);
      await exportDocAsPDF(doc, `${ATHLETE.preferred}-analysis.pdf`,
                           LANG.as(lang, () => t('Analysis')));
    });
  document.querySelector('[data-do="events-pdf"]').onclick = () =>
    run(t('Building {0} pages…', events.length), async () => {
      await fontsReady();
      const doc = buildAllEventsDoc(events, lang);
      await exportDocAsPDF(doc, `${ATHLETE.preferred}-event-reports.pdf`,
                           LANG.as(lang, () => t('Event reports')));
    });

  paintTable();
})();
