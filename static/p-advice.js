/* Review — a written assessment of the record, generated on request. */
'use strict';

(async function () {
  mountShell('advice.html');
  const app = document.getElementById('app');
  const rows = await store.load();
  const CACHE = 'ivy.advice.' + LANG.get();

  app.innerHTML = `
    <div class="sec-title">${t('Written review')}</div>
    <div class="card">
      <p class="footnote" style="margin:0 0 14px">
        ${t('A written assessment of the complete competition record: where she stands, what the numbers show, and what is worth discussing with her coach. Written in the language the site is currently set to.')}
      </p>
      <label class="fl" for="focus">${t('Anything specific to look at (optional)')}</label>
      <input type="text" id="focus" style="width:100%"
             placeholder="${esc(t('e.g. which events to prioritise next season'))}">
      <div class="controls" style="margin:12px 0 0">
        <button class="btn alt" id="go">${t('Generate review')}</button>
        <button class="btn ghost" id="print" style="display:none">${t('Print / save as PDF')}</button>
        <span class="footnote" id="meta"></span>
      </div>
    </div>
    <div id="out"></div>`;

  const out = document.getElementById('out');
  const meta = document.getElementById('meta');

  function render(text, stamp) {
    out.innerHTML = `<div class="card prose" id="prose">${markdown(text)}</div>`;
    document.getElementById('print').style.display = '';
    if (stamp) {
      meta.textContent = t('Generated {0}', new Date(stamp).toLocaleString(LOCALE()));
    }
  }

  const cached = sessionStorage.getItem(CACHE);
  if (cached) {
    try { const c = JSON.parse(cached); render(c.text, c.generated); } catch (_) {}
  }

  document.getElementById('go').onclick = async () => {
    const btn = document.getElementById('go');
    btn.disabled = true;
    out.innerHTML = `<div class="card"><div class="status">
      <span class="spin"></span>${t('Reading the full record and writing the review. This usually takes under a minute.')}
      </div><div class="skel" style="height:14px;margin-top:14px"></div>
      <div class="skel" style="height:14px;margin-top:8px;width:88%"></div>
      <div class="skel" style="height:14px;margin-top:8px;width:94%"></div>
      <div class="skel" style="height:14px;margin-top:8px;width:72%"></div></div>`;
    try {
      const res = await fetch('/api/advice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: LANG.get(), gender: SETTINGS.gender,
                               focus: document.getElementById('focus').value }),
      });
      const j = await res.json();
      if (res.status === 401 || j.locked) {
        out.innerHTML = `<div class="card"><div class="status err">
          ${t('This is limited to the account holder.')}
          <a href="unlock.html?next=/advice.html">${t('Unlock')}</a></div></div>`;
        return;
      }
      if (j.error) throw new Error(j.error);
      sessionStorage.setItem(CACHE, JSON.stringify(j));
      render(j.text, j.generated);
    } catch (e) {
      out.innerHTML = `<div class="card"><div class="status err">${esc(e.message)}</div></div>`;
    } finally {
      btn.disabled = false;
    }
  };

  document.getElementById('print').onclick = () => window.print();

  /** Headings, bold, italic and simple lists — the shapes the review uses. */
  function markdown(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    const html = [];
    let list = null;
    const inline = s => esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
    for (const raw of lines) {
      const line = raw.trimEnd();
      const li = /^\s*[-*]\s+(.*)$/.exec(line);
      if (li) {
        if (!list) { list = 'ul'; html.push('<ul>'); }
        html.push(`<li>${inline(li[1])}</li>`);
        continue;
      }
      if (list) { html.push(`</${list}>`); list = null; }
      const h = /^(#{2,4})\s+(.*)$/.exec(line);
      if (h) { html.push(`<h3>${inline(h[2])}</h3>`); continue; }
      if (!line) continue;
      html.push(`<p>${inline(line)}</p>`);
    }
    if (list) html.push(`</${list}>`);
    return html.join('');
  }
})();
