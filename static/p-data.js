/* Data — full record with advanced search, sorting and export */
'use strict';

(async function () {
  mountShell('data.html');
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="sec-title">${t('Search the record')}${help('search')}</div>
    <div class="searchbar">
      <input id="q" type="text" autocomplete="off" spellcheck="false"
        placeholder="${esc(t("Search anything — 'fly', '50 back', 'lcm 2026', 'stroke:free time<35', 'pb'"))}">
      <button class="btn ghost" id="clear">${t('Clear')}</button>
    </div>
    <div class="qhelp" id="qhelp"></div>
    <div class="pagebar" style="border:0;background:transparent"><div class="pagebar-in" style="padding-left:0">
      <span id="count"></span><div style="flex:1"></div>
      <a class="chip" href="/api/export.csv">${t('Export CSV')}</a>
    </div></div>
    <div class="tbl-wrap"><table class="data" id="tbl"></table></div>
    <div class="card" style="margin-top:20px"><h2>${t('Search syntax')}</h2>
      <div class="footnote" style="margin-top:8px">
      <p>${t('Bare words match every field at once — event name, pool, date, meet, round, notes, even the formatted time. Add qualifiers to narrow it, and combine as many as you like; all of them must match.')}</p>
      <table class="data" style="margin-top:10px"><tbody>
        <tr><td><code>stroke:fly</code></td><td>${t('stroke name or short form (free, back, breast, fly, im)')}</td></tr>
        <tr><td><code>course:lcm</code></td><td>${t('pool length — {0} or {1}', '<code>lcm</code>/<code>50</code>', '<code>scm</code>/<code>25</code>')}</td></tr>
        <tr><td><code>dist:100</code></td><td>${t('race distance; also {0}', '<code>dist&gt;50</code>')}</td></tr>
        <tr><td><code>year:2026</code></td><td>${t('calendar year')}</td></tr>
        <tr><td><code>after:2025-06-01</code></td><td>${t('on or after a date ({0} for the other side)', '<code>before:</code>')}</td></tr>
        <tr><td><code>time&lt;35</code></td><td>${t('time comparison, accepts {0}', '<code>1:23.96</code>')}</td></tr>
        <tr><td><code>age&lt;10</code></td><td>${t('age in years on the day of the race')}</td></tr>
        <tr><td><code>points&gt;300</code></td><td>${t('World Aquatics points')}</td></tr>
        <tr><td><code>meet:"city open"</code></td><td>${t('meet name; quote anything with spaces')}</td></tr>
        <tr><td><code>pb</code></td><td>${t('only swims that set a personal best')}</td></tr>
      </tbody></table></div>
    </div>`;

  const rows = await store.load();
  const tagged = tagProgression(rows);
  const byId = new Map(tagged.map(r => [r.id, r]));
  let sortKey = 'date', sortDir = -1;

  const EXAMPLES = ['pb', 'stroke:free', 'course:lcm', 'dist:100', 'year:2026',
                    'time<40', 'age<10', 'points>300', 'stroke:back course:lcm'];
  document.getElementById('qhelp').innerHTML =
    EXAMPLES.map(e => `<code data-q="${esc(e)}">${esc(e)}</code>`).join('');
  document.querySelectorAll('#qhelp code').forEach(c => c.onclick = () => {
    q.value = c.dataset.q; sync(); });

  const q = document.getElementById('q');
  const params = new URLSearchParams(location.search);
  q.value = params.get('q') || '';

  const COLS = [
    ['date', t('Date'), r => fmt.date(r.date)],
    ['age', t('Age') + help('age'), r => `<span class="mut">${ageLabel(r.date)}</span>`],
    ['event', t('Event'), r => `<a href="events.html?e=${encodeURIComponent(eventKey(r))}"
        style="color:${STROKE_COLOR[r.stroke]};font-weight:600;text-decoration:none">${raceName(r)}</a>`],
    ['course', t('Pool'), r => courseTag(r.course)],
    ['seconds', t('Time'), r => `<span class="${byId.get(r.id)?.wasPB ? 'pb' : ''}" style="font-weight:700">
        ${byId.get(r.id)?.wasPB ? '★ ' : ''}${fmt.time(r.seconds)}</span>`],
    ['speed', t('Speed'), r => fmt.speed(r.distance, r.seconds).toFixed(3) + ' m/s'],
    ['pace', t('Pace /100'), r => fmt.time(fmt.pace100(r.distance, r.seconds))],
    ['points', t('WA pts') + help('points'), r => waPoints(r) ?? '—'],
    ['meet', t('Meet'), r => `<span class="mut">${esc(r.meet || '—')}</span>`],
    ['round', t('Round'), r => `<span class="mut">${esc(r.round || '—')}</span>`],
    ['source', t('Source'), r => `<span class="mut">${esc(r.source || '—')}</span>`],
  ];
  const VAL = {
    date: r => r.date, age: r => ageAt(r.date), event: r => r.distance + r.stroke,
    course: r => r.course, seconds: r => r.seconds,
    speed: r => fmt.speed(r.distance, r.seconds), pace: r => fmt.pace100(r.distance, r.seconds),
    points: r => waPoints(r) ?? -1, meet: r => r.meet || '', round: r => r.round || '',
    source: r => r.source || '',
  };

  function render() {
    let list = runSearch(rows, q.value);
    list = [...list].sort((a, b) => {
      const x = VAL[sortKey](a), y = VAL[sortKey](b);
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
    document.getElementById('count').innerHTML =
      t('{0} of {1} races', `<b>${list.length}</b>`, rows.length) +
      (q.value.trim() ? ' · ' + t('matching {0}', `<code>${esc(q.value.trim())}</code>`) : '');
    const tbl = document.getElementById('tbl');
    if (!list.length) {
      tbl.innerHTML = `<tbody><tr><td style="padding:26px;text-align:center;color:#4a566b">
        ${t('Nothing matches that search.')}</td></tr></tbody>`;
      return;
    }
    tbl.innerHTML =
      `<thead><tr>${COLS.map(c => `<th data-k="${c[0]}" style="cursor:pointer">${c[1]}
        ${sortKey === c[0] ? (sortDir > 0 ? '▲' : '▼') : ''}</th>`).join('')}</tr></thead>
       <tbody>${list.map(r => `<tr>${COLS.map(c => `<td>${c[2](r)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    tbl.querySelectorAll('th').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = k === 'date' ? -1 : 1; }
      render();
    });
  }

  function sync() {
    const u = new URL(location.href);
    if (q.value.trim()) u.searchParams.set('q', q.value.trim()); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
    render();
  }
  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(sync, 140); });
  document.getElementById('clear').onclick = () => { q.value = ''; sync(); q.focus(); };
  render();
})();
