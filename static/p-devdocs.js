/* Technical reference. Served only to an unlocked session. */
'use strict';

(async function () {
  mountShell('devdocs.html');
  const app = document.getElementById('app');
  const health = await fetch('/api/health').then(r => r.json()).catch(() => ({}));

  const sec = (title, body) =>
    `<div class="sec-title">${title}</div><div class="card helpdoc devdoc">${body}</div>`;
  const table = (head, rows) =>
    `<div class="tbl-wrap" style="border:0;margin:6px 0 0"><table class="data"><thead><tr>${
      head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
      rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  app.innerHTML = `
    <div class="sec-title">Technical reference</div>
    <div class="card helpdoc devdoc">
      <p><b>Ivy Swim Analytics</b> — version <code>${esc(health.version || '—')}</code>,
      ${health.count ?? '—'} results on record, DeepSeek
      ${health.deepseek ? '<span class="good">configured</span>' : '<span class="bad">not configured</span>'}.</p>
      <p>A single-process Python HTTP server over SQLite, with a static front end.
      No third-party Python packages, no build step, no bundler, no virtualenv:
      <code>python3 server.py</code> is the whole runtime. Every asset the browser
      loads is served from this host, so the site works with no external network.</p>
    </div>

    ${sec('Request lifecycle', `
      <p>${'<code>ThreadingHTTPServer</code>'} with <code>protocol_version = HTTP/1.1</code>.
      One thread per connection; SQLite is opened per request in WAL mode with a 20 s busy
      timeout, and writes are serialised behind a process-wide lock.</p>
      <p><b>Body draining.</b> <code>do_POST</code> reads the entire request body before
      dispatch. Replying to a POST while bytes are still queued would leave them to be parsed
      as the next request on the same keep-alive connection, silently shifting responses onto
      the wrong requests — an early bug that this ordering prevents.</p>
      <p><b>Caching.</b> Static responses carry an ETag derived from mtime and size and are
      served <code>no-cache, must-revalidate</code>; fonts, whose names contain a content
      hash, are <code>immutable</code> for a year. Asset URLs also carry a
      <code>?v=</code> stamp rewritten by <code>bump.sh</code> on every deploy.</p>`)}

    ${sec('Data model', `
      <p>One table. A unique index over the natural key makes re-importing the same result a
      no-op rather than a duplicate.</p>
      <pre><code>results(
  id           INTEGER PRIMARY KEY,
  date         TEXT     -- ISO 8601
  course       TEXT     -- SCM (25 m) | LCM (50 m)
  distance     INTEGER  -- metres, 25..25000
  stroke       TEXT     -- Free | Back | Breast | Fly | IM
  seconds      REAL
  meet, round, note, source, created_at TEXT
)
UNIQUE(date, course, distance, stroke, seconds)</code></pre>
      <p>Distance is open-ended and the front end derives the event list from the data, so a
      stroke and distance combination that has never been swum before — a 400 or an 800, say —
      needs no code change to appear everywhere.</p>`)}

    ${sec('HTTP API', `
      ${table(['Method', 'Path', 'Auth', 'Purpose'], [
        ['GET', '<code>/api/results</code>', 'public', 'every result, oldest first'],
        ['POST', '<code>/api/results</code>', '<b>locked</b>', 'insert one or many; validated and de-duplicated'],
        ['DELETE', '<code>/api/results/{id}</code>', '<b>locked</b>', 'remove one result'],
        ['GET', '<code>/api/export.csv</code>', 'public', 'the whole record as CSV'],
        ['GET', '<code>/api/export/pb.xlsx</code>', 'public', 'personal bests as OOXML; <code>lang</code>, <code>gender</code>'],
        ['POST', '<code>/api/export/pdf</code>', 'public', 'page images → PDF, returns a download URL'],
        ['POST', '<code>/api/export/png</code>', 'public', 'one image → download URL'],
        ['GET', '<code>/dl/{token}</code>', 'public', 'the generated file; 15 min TTL, 40 kept'],
        ['POST', '<code>/api/parse</code>', '<b>locked</b>', 'screenshot or text → candidate rows'],
        ['POST', '<code>/api/advice</code>', '<b>locked</b>', 'written review of the whole record'],
        ['GET', '<code>/api/auth/status</code>', 'public', 'is this session unlocked'],
        ['GET', '<code>/api/auth/challenge</code>', 'public', 'one-time nonce'],
        ['POST', '<code>/api/auth</code>', 'public', 'answer the challenge, set the session cookie'],
        ['POST', '<code>/api/auth/logout</code>', 'public', 'drop the session'],
        ['GET', '<code>/api/health</code>', 'public', 'version, result count, DeepSeek state'],
      ])}
      <p style="margin-top:10px">Reading is deliberately open: the record is meant to be shown
      to people. Everything that writes, spends money, or reveals the intake tooling is closed.</p>`)}

    ${sec('Access control', `
      <p>The passcode exists only in <code>/etc/ivy-swim.env</code> on the server, mode 600.
      It is never sent to the browser and never sent back over the wire.</p>
      <ol>
        <li>The browser asks <code>/api/auth/challenge</code> for a single-use nonce.</li>
        <li>The visitor types the passcode. The page computes
            <code>SHA-256(nonce + ":" + passcode)</code> and sends only that digest.</li>
        <li>The server recomputes it and compares with <code>hmac.compare_digest</code>.
            On success it issues an opaque token in an <code>HttpOnly</code>,
            <code>SameSite=Lax</code> cookie, valid 12 hours.</li>
      </ol>
      <p>The digest is computed by a self-contained SHA-256 in <code>sha256.js</code>, because
      <code>crypto.subtle</code> is unavailable outside a secure context and this origin is
      plain HTTP. Nonces are single-use with a 3 minute life; failed attempts are capped at 8
      per address per 10 minutes.</p>
      <p><b>The gate is server-side.</b> <code>/add.html</code> and <code>/devdocs.html</code>
      are not served at all to a locked client — the server answers 302 to the unlock page.
      There is no hidden element on the page for a viewer to reveal in developer tools,
      because the markup is never delivered.</p>
      <p class="bad"><b>Known limitation.</b> The origin is HTTP, so the session cookie and
      every response travel unencrypted. The challenge–response keeps the passcode itself off
      the wire, but a network observer could still copy the session cookie. Terminating TLS in
      front of this service would close that gap.</p>`)}

    ${sec('DeepSeek integration', `
      <p>The API key is held server-side and every call is brokered; the browser never sees it.</p>
      ${table(['Use', 'Model', 'Notes'], [
        ['text intake', '<code>deepseek-v4-flash</code>', 'strict JSON contract, one retry that shows the model its own non-JSON reply'],
        ['screenshot intake', '<code>deepseek-v4-flash-vision-exp</code>', 'image as a base64 data URL, downscaled to 1600 px by the browser first'],
        ['written review', '<code>deepseek-v4-pro</code>', 'streamed; falls back to flash'],
      ])}
      <p style="margin-top:10px"><b>Two behaviours worth knowing.</b>
      <code>response_format: json_object</code> makes these models return an <em>empty</em>
      message, so the JSON contract is enforced by prompt instead. And because they emit hidden
      reasoning before the answer, <code>max_tokens</code> has to cover both — a budget that
      looks generous can be consumed entirely by reasoning, leaving no answer. The review is
      therefore streamed with a large budget, which also keeps the socket alive through a
      two-minute generation.</p>
      <p>Extraction never writes directly to the database. It returns candidate rows with a
      confidence per row; a person edits and confirms them on the intake page before anything
      is saved.</p>`)}

    ${sec('Export pipeline', `
      <p>Documents are drawn by the browser and packaged by the server.</p>
      <ol>
        <li><code>doc.js</code> lays out A4-proportioned pages on a canvas at 2× scale —
            banner, metric strip, chart, tables, notes, link box, footer — breaking pages as
            content overflows.</li>
        <li>Pages are encoded as JPEG and posted to <code>/api/export/pdf</code>.</li>
        <li><code>exporters.py</code> embeds each JPEG verbatim as a <code>/DCTDecode</code>
            image XObject, one per page, and adds a <code>/Link</code> annotation over the
            footer box so the dashboard URL is clickable.</li>
      </ol>
      <p>JPEG rather than PNG for a reason: a PNG would have to be un-filtered byte by byte in
      pure Python to become PDF image data, which for a full A4 page at 2× is far too slow.
      JPEG needs no decoding at all. Single-image PNG downloads skip the server entirely apart
      from being handed back as a file.</p>
      <p>Files are returned through <code>/dl/{token}</code> with
      <code>Content-Disposition: attachment</code> rather than a <code>blob:</code> URL,
      because in-app browsers — WeChat in particular — will not save from a blob or honour a
      <code>download</code> attribute, but do follow an ordinary download response.</p>
      <p>The workbook is written directly as OOXML: a zip of six XML parts, inline strings, a
      frozen bold header row, and an autofilter scoped to the data so the trailing link and
      attribution rows stay outside it.</p>`)}

    ${sec('Statistics', `
      <p><b>Points.</b> <code>P = 1000 × (B ÷ T)³</code>, B being the world record for that
      event and pool length. The table is duplicated in <code>core.js</code> and
      <code>server.py</code> so the site and the workbook cannot disagree.</p>
      <p><b>Trend.</b> Ordinary least squares of <code>ln(time)</code> on years since the first
      race. The slope <code>b</code> is reported as <code>(e^b − 1) × 100</code> percent per
      year, which keeps events of different length comparable. Confidence intervals use the
      two-sided <em>t</em> distribution on <code>n − 2</code> degrees of freedom, from a table
      for <code>df ≤ 30</code> and an asymptotic approximation above it. Fewer than three races
      returns no model.</p>
      <p><b>Speed endurance.</b> The Riegel exponent from <code>T = k · dⁿ</code>, solved
      between the 50 and the 100 of one stroke and pool:
      <code>n = log(T₁₀₀ ⁄ T₅₀) ⁄ log 2</code>. Flagged when the two bests are more than six
      months apart, since it then mixes two levels of fitness.</p>`)}

    ${sec('Front end', `
      <p>No framework and no bundler. <code>i18n.js</code> then <code>core.js</code> load on
      every page, followed by one script per page.</p>
      ${table(['File', 'Contains'], [
        ['<code>i18n.js</code>', 'English strings are the keys; Chinese overrides; <code>LANG.as()</code> renders a block in another language, which is how exports switch independently of the site'],
        ['<code>core.js</code>', 'config and world records, formatting, statistics, the SVG chart engine, the store, search, navigation, inline help'],
        ['<code>doc.js</code>', 'canvas page layout and the export chart with per-point captions'],
        ['<code>exports.js</code>', 'document builders and download delivery'],
        ['<code>sha256.js</code>', 'digest for the unlock challenge'],
        ['<code>p-*.js</code>', 'one per page'],
      ])}
      <p style="margin-top:10px">Charts are hand-drawn SVG. Colour encodes stroke only; pool
      length is a dash pattern and the personal best a star, so nothing depends on colour
      alone. Reveal animation runs on <code>IntersectionObserver</code> with a timeout and a
      <code>beforeprint</code> hook as fallbacks, so a chart can never stay blank.</p>`)}

    ${sec('Operations', `
      <pre><code>/opt/ivy-swim/            server.py, exporters.py, static/, data/ivy.db
/etc/ivy-swim.env         DEEPSEEK_API_KEY, IVY_PASSCODE, IVY_PORT, IVY_PUBLIC_URL  (600)
/etc/systemd/system/ivy-swim.service
/var/log/ivy-swim.log</code></pre>
      <p><code>./deploy.sh</code> stamps a new asset version, refuses to start if the port is
      held by anything other than this service, rsyncs over one multiplexed SSH connection,
      writes the environment file, restarts the unit and health-checks it.</p>
      <p>The database is the only stateful file. Back it up with
      <code>scp root@…:/opt/ivy-swim/data/ivy.db .</code></p>`)}

    ${sec('Constraints', `
      <ul>
        <li>Plain HTTP; no TLS in front of the service.</li>
        <li>Single process. Fine for this load; the SQLite write lock would be the first limit.</li>
        <li>Generated files live in memory for 15 minutes and do not survive a restart.</li>
        <li>World records are a fixed table and need updating when records fall.</li>
        <li>Chinese uses whichever CJK font the viewer's device provides; only the Latin faces are self-hosted.</li>
      </ul>`)}`;
})();
