/* Add Result — screenshot or text capture via DeepSeek, plus manual entry and deletion */
'use strict';

(async function () {
  mountShell('add.html');
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="sec-title">${t('Capture from a screenshot or a note')}</div>
    <div class="grid g2">
      <div class="card">
        <h2>${t('Screenshot')} <span class="hint">${t('from a meet app, results PDF or scoreboard')}</span></h2>
        <div class="drop" id="drop" tabindex="0" role="button" aria-label="${esc(t('Drop an image here'))}">
          <div class="big">${t('Drop an image here')}</div>
          <div class="small">${t('or click to choose · you can also paste with ⌘V / Ctrl+V')}</div>
        </div>
        <input type="file" id="file" accept="image/*" hidden>
        <div id="preview"></div>
      </div>
      <div class="card">
        <h2>${t('Meet Mobile export')} <span class="hint">${t('paste the results JSON from the app')}</span></h2>
        <label class="fl" for="mmjson">${t('Meet Mobile data')}</label>
        <textarea id="mmjson" spellcheck="false" placeholder='{"meetName":"…","results":[ … ]}'></textarea>
        <div class="controls" style="margin:10px 0 0">
          <button class="btn" id="mmgo">${t('Match against my records')}</button>
          <a class="chip" href="help.html#meetmobile">${t('How do I get this?')}</a>
        </div>
        <div id="mmstatus"></div>
      </div>
      <div class="card">
        <h2>${t('Description')} <span class="hint">${t('plain language, English or 中文')}</span></h2>
        <label class="fl" for="txt">${t('What was swum')}</label>
        <textarea id="txt" placeholder="${esc(t('Ivy swam the 50 free long course in 33.74 at the provincial championships on 30 May 2026, and went 1:19.43 in the 100 back the same day.'))}"></textarea>
        <div class="controls" style="margin:10px 0 0">
          <button class="btn" id="go">${t('Read the result')}</button>
          <button class="btn ghost" id="reset">${t('Reset')}</button>
        </div>
      </div>
    </div>
    <div id="status"></div>
    <div id="review"></div>

    <div class="sec-title">${t('Add a result by hand')}</div>
    <div class="card">
      <form id="manual" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:10px;align-items:end">
        <div><label class="fl" for="m_date">${t('Date')}</label><input type="date" id="m_date" required></div>
        <div><label class="fl" for="m_dist">${t('Distance (m)')}</label><input type="number" id="m_dist" min="25" max="25000" step="25" value="50" required></div>
        <div><label class="fl" for="m_stroke">${t('Stroke')}</label><select id="m_stroke">
          ${STROKES.map(s => `<option value="${s}">${STROKE_LABEL[s]}</option>`).join('')}</select></div>
        <div><label class="fl" for="m_course">${t('Pool')}</label><select id="m_course">
          <option value="SCM">${t('25 m — short course')}</option><option value="LCM">${t('50 m — long course')}</option></select></div>
        <div><label class="fl" for="m_time">${t('Time')}</label><input type="text" id="m_time" placeholder="33.74 / 1:19.43" required></div>
        <div><label class="fl" for="m_meet">${t('Meet')}</label><input type="text" id="m_meet" placeholder="${esc(t('optional'))}"></div>
        <div><label class="fl" for="m_round">${t('Round')}</label><select id="m_round">
          <option value="">—</option><option>Heat</option><option>Semifinal</option>
          <option>Final</option><option>Time Trial</option></select></div>
        <div><button class="btn alt" type="submit">${t('Add result')}</button></div>
      </form>
      <div id="mstatus"></div>
    </div>

    <div class="controls" style="margin:18px 0 0">
      <a class="chip" href="devdocs.html">${t('Technical reference')}</a>
      <a class="chip" href="help.html">${t('Help')}</a>
      <button class="chip" id="lockbtn">${t('Lock')}</button>
    </div>
    <div class="sec-title">${t('Recorded results')}</div>
    <div class="pagebar" style="border:0;background:transparent"><div class="pagebar-in" style="padding-left:0">
      <span id="tcount"></span><div style="flex:1"></div>
      <input type="text" id="filter" placeholder="${esc(t('Filter…'))}" style="max-width:230px">
    </div></div>
    <div class="tbl-wrap"><table class="data" id="tbl"></table></div>`;

  const $ = id => document.getElementById(id);
  let picked = null;                       // { dataUrl, name }

  /* ------------------------------ image intake ------------------------------ */
  const MAX_EDGE = 1600;
  function loadImage(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('could not read that file'));
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          if (scale === 1) return res({ dataUrl: fr.result, name: file.name || 'screenshot' });
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res({ dataUrl: c.toDataURL('image/jpeg', 0.9), name: file.name || 'screenshot' });
        };
        img.onerror = () => rej(new Error('that file is not an image'));
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function take(file) {
    if (!file || !/^image\//.test(file.type)) return;
    try {
      picked = await loadImage(file);
      $('preview').innerHTML = `<img class="thumb" src="${picked.dataUrl}" alt="selected screenshot">
        <div class="small" style="font-size:12px;color:#4a566b;margin-top:4px">${esc(picked.name)}</div>`;
      say('');
    } catch (e) { say(e.message, 'err'); }
  }
  const drop = $('drop');
  drop.onclick = () => $('file').click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } };
  $('file').onchange = e => take(e.target.files[0]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));
  document.addEventListener('paste', e => {
    const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (it) take(it.getAsFile());
  });

  const say = (msg, kind = '') => {
    $('status').innerHTML = msg ? `<div class="status ${kind}">${msg}</div>` : '';
  };

  /* -------------------------------- parsing -------------------------------- */
  $('reset').onclick = () => {
    picked = null; $('preview').innerHTML = ''; $('txt').value = '';
    $('review').innerHTML = ''; say(''); $('file').value = '';
  };

  $('go').onclick = async () => {
    const text = $('txt').value.trim();
    if (!text && !picked) return say(t('Add a screenshot or describe the swim first.'), 'err');
    $('go').disabled = true;
    say('<span class="spin"></span>' + t(picked ? 'Reading the screenshot…' : 'Reading the description…'));
    try {
      const res = await fetch('/api/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, image: picked ? picked.dataUrl : '' }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      if (!j.rows?.length) {
        say(t('No results could be read from that.') +
            (j.warnings?.length ? '\n' + j.warnings.join('\n') : ''), 'err');
        $('review').innerHTML = '';
      } else {
        say(tn(j.rows.length, 'Found {0} result. Check the details, then save.',
                                 'Found {0} results. Check the details, then save.') +
            (j.warnings?.length ? '\n' + j.warnings.join('\n') : ''), 'ok');
        renderReview(j.rows);
      }
    } catch (e) {
      say(t('Could not read that: {0}', e.message), 'err');
    } finally { $('go').disabled = false; }
  };

  function renderReview(list) {
    $('review').innerHTML = `
      <div class="sec-title">${t('Check before saving')}</div>
      <div class="status">${t('Are these correct? Edit any field below, remove anything that should not be saved, then confirm.')}</div>
      <div class="tbl-wrap"><table class="data review"><thead><tr>
        <th>${t('Date')}</th><th>${t('Dist')}</th><th>${t('Stroke')}</th><th>${t('Pool')}</th>
        <th>${t('Time')}</th><th>${t('Meet')}</th><th>${t('Round')}</th>
        <th>${t('Confidence')}</th><th></th></tr></thead><tbody>
      ${list.map((r, i) => `<tr data-i="${i}">
        <td><input type="date" value="${esc(r.date)}" data-f="date"></td>
        <td><input type="number" value="${r.distance}" data-f="distance" min="25" step="25"></td>
        <td><select data-f="stroke">${STROKES.map(s =>
            `<option value="${s}"${s === r.stroke ? ' selected' : ''}>${STROKE_LABEL[s]}</option>`).join('')}</select></td>
        <td><select data-f="course">
            <option value="SCM"${r.course === 'SCM' ? ' selected' : ''}>25 m</option>
            <option value="LCM"${r.course === 'LCM' ? ' selected' : ''}>50 m</option></select></td>
        <td><input type="text" value="${esc(fmt.time(r.seconds))}" data-f="seconds"></td>
        <td><input type="text" value="${esc(r.meet || '')}" data-f="meet" placeholder="${esc(t('optional'))}"></td>
        <td><input type="text" value="${esc(r.round || '')}" data-f="round" placeholder="—"></td>
        <td class="${r.confidence >= 0.85 ? 'good' : r.confidence >= 0.6 ? '' : 'bad'}">
            ${Math.round((r.confidence ?? 0.8) * 100)}%${r.note ? `<div class="mut" style="font-size:11px;white-space:normal">${esc(r.note)}</div>` : ''}</td>
        <td><button class="del" data-drop="${i}">${t('remove')}</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="controls" style="margin-top:12px">
        <button class="btn alt" id="save">${t('Confirm and save')}</button>
        <button class="btn ghost" id="discard">${t('Discard')}</button>
      </div>`;
    $('review').querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
      list.splice(+b.dataset.drop, 1);
      list.length ? renderReview(list) : ($('review').innerHTML = '', say(t('All rows discarded.')));
    });
    $('discard').onclick = () => { $('review').innerHTML = ''; say(''); };
    $('save').onclick = async () => {
      const out = [...$('review').querySelectorAll('tbody tr')].map(tr => {
        const o = {};
        tr.querySelectorAll('[data-f]').forEach(el => o[el.dataset.f] = el.value);
        return { ...o, source: list[+tr.dataset.i]?.source || 'deepseek' };
      });
      $('save').disabled = true;
      try {
        const j = await post('/api/results', { results: out });
        say(tn(j.added, 'Saved {0} result.', 'Saved {0} results.') +
            (j.duplicates ? ' ' + t('{0} were already on record.', j.duplicates) : '') +
            (j.errors?.length ? '\n' + j.errors.join('\n') : ''), j.errors?.length ? 'err' : 'ok');
        $('review').innerHTML = '';
        if (!j.errors?.length) { picked = null; $('preview').innerHTML = ''; $('txt').value = ''; }
        refresh(j.results);
      } catch (e) { say(t('Could not save: {0}', e.message), 'err'); }
      finally { $('save').disabled = false; }
    };
  }

  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify(body) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  }

  /* ------------------------- Meet Mobile reconciliation ------------------------- */
  $('mmgo').onclick = async () => {
    const raw = $('mmjson').value.trim();
    if (!raw) { $('mmstatus').innerHTML =
      `<div class="status err">${t('Paste the Meet Mobile results JSON first.')}</div>`; return; }
    $('mmgo').disabled = true;
    $('mmstatus').innerHTML = `<div class="status"><span class="spin"></span>${t('Matching…')}</div>`;
    try {
      const j = await post('/api/import/meetmobile', { data: raw });
      const rec = j.reconcile;
      if (!rec) {
        $('mmstatus').innerHTML = `<div class="status err">${esc((j.warnings || [t('Nothing found.')]).join(' '))}</div>`;
        return;
      }
      const toAdd = [...rec.new, ...rec.conflicts.map(c => ({ ...c.incoming, _was: c.existing }))];
      $('mmstatus').innerHTML =
        `<div class="status ok">${t('Compared {0} swims: {1} already match, {2} new, {3} differ.',
          rec.total, rec.matched.length, rec.new.length, rec.conflicts.length)}` +
        (j.warnings?.length ? '\n' + j.warnings.join('\n') : '') + `</div>`;
      if (toAdd.length) {
        toAdd.forEach(r => { r.confidence = r._was ? 0.5 : 0.95;
          if (r._was) r.note = t('Meet Mobile has {0}; the record had {1}', fmt.time(r.seconds), fmt.time(r._was)); });
        renderReview(toAdd);
        say(t('{0} swims are new or differ. Confirm the ones to save.', toAdd.length), 'ok');
      } else {
        $('review').innerHTML = '';
        say(t('Everything in that export already matches your records.'), 'ok');
      }
    } catch (e) {
      $('mmstatus').innerHTML = `<div class="status err">${esc(t('Could not read that: {0}', e.message))}</div>`;
    } finally { $('mmgo').disabled = false; }
  };

  /* ------------------------------ manual entry ------------------------------ */
  const today = () => { const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  $('m_date').value = today();
  $('manual').onsubmit = async e => {
    e.preventDefault();
    const row = { date: $('m_date').value, distance: +$('m_dist').value,
                  stroke: $('m_stroke').value, course: $('m_course').value,
                  seconds: $('m_time').value, meet: $('m_meet').value,
                  round: $('m_round').value, source: 'manual' };
    try {
      const j = await post('/api/results', { results: [row] });
      $('mstatus').innerHTML = j.added
        ? `<div class="status ok">${t('Added {0} in {1}.', raceName(row), esc($('m_time').value))}</div>`
        : `<div class="status err">${esc(j.errors?.join('; ') || t('That result is already on record.'))}</div>`;
      if (j.added) { $('m_time').value = ''; $('m_meet').value = ''; }
      refresh(j.results);
    } catch (err) {
      $('mstatus').innerHTML = `<div class="status err">${esc(err.message)}</div>`;
    }
  };

  document.getElementById('lockbtn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{}' });
    location.href = 'index.html';
  };

  /* --------------------------- record table + delete --------------------------- */
  let rows = await store.load();
  function refresh(next) {
    if (next) { rows = next.map(r => ({ ...r, seconds: +r.seconds, distance: +r.distance }));
                store.results = rows; }
    renderTable();
  }
  $('filter').oninput = () => renderTable();

  function renderTable() {
    const list = runSearch(rows, $('filter').value)
      .slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    $('tcount').innerHTML = t('{0} of {1} results', `<b>${list.length}</b>`, rows.length);
    $('tbl').innerHTML = `<thead><tr>
        <th>${t('Date')}</th><th>${t('Event')}</th><th>${t('Pool')}</th><th>${t('Time')}</th>
        <th>${t('Meet')}</th><th>${t('Round')}</th><th>${t('Source')}</th><th></th></tr></thead><tbody>
      ${list.map(r => `<tr>
        <td>${fmt.date(r.date)}</td>
        <td style="color:${STROKE_COLOR[r.stroke]};font-weight:600">${raceName(r)}</td>
        <td>${courseTag(r.course)}</td>
        <td style="font-weight:700">${fmt.time(r.seconds)}</td>
        <td class="mut">${esc(r.meet || '—')}</td>
        <td class="mut">${esc(r.round || '—')}</td>
        <td class="mut">${esc(r.source || '—')}</td>
        <td><button class="del" data-id="${r.id}">${t('delete')}</button></td></tr>`).join('')}
      </tbody>`;
    $('tbl').querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
      const r = rows.find(x => x.id === +b.dataset.id);
      if (!confirm(t('Delete {0} — {1} on {2}?', raceName(r), fmt.time(r.seconds), fmt.date(r.date)))) return;
      const res = await fetch('/api/results/' + b.dataset.id, { method: 'DELETE' });
      const j = await res.json();
      refresh(j.results);
    });
  }
  renderTable();
})();
