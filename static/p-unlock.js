/* Unlock — answers the server's one-time challenge.
   The passcode is typed here, hashed with the nonce, and discarded; it is never
   stored, never placed in the page, and never sent over the network. */
'use strict';

(async function () {
  mountShell('unlock.html');
  const app = document.getElementById('app');
  const next = new URLSearchParams(location.search).get('next') || '/add.html';

  app.innerHTML = `
    <div class="lockwrap">
      <div class="card lockcard">
        <h2>${t('Restricted area')}</h2>
        <p class="footnote" style="margin:8px 0 16px">
          ${t('Adding, editing and deleting results is limited to the account holder. Everything else on the site is open to view.')}
        </p>
        <form id="f" autocomplete="off">
          <label class="fl" for="pw">${t('Passcode')}</label>
          <input type="password" id="pw" inputmode="numeric" autocomplete="current-password"
                 style="width:100%;font-size:19px;letter-spacing:.35em;text-align:center;padding:11px"
                 required aria-describedby="msg">
          <button class="btn" id="go" type="submit" style="width:100%;margin-top:12px">
            ${t('Unlock')}</button>
        </form>
        <div id="msg"></div>
        <p class="footnote" style="margin-top:16px">
          <a href="index.html">← ${t('Back to the dashboard')}</a>
        </p>
      </div>
    </div>`;

  const msg = (text, kind = '') => {
    document.getElementById('msg').innerHTML =
      text ? `<div class="status ${kind}">${esc(text)}</div>` : '';
  };

  const status = await fetch('/api/auth/status').then(r => r.json()).catch(() => ({}));
  if (status.unlocked) {
    msg(t('Already unlocked.'), 'ok');
    setTimeout(() => location.replace(next), 400);
    return;
  }
  if (!status.configured) {
    msg(t('No passcode is configured on the server.'), 'err');
  }

  document.getElementById('f').onsubmit = async e => {
    e.preventDefault();
    const field = document.getElementById('pw');
    const entered = field.value;
    const btn = document.getElementById('go');
    btn.disabled = true;
    msg('');
    try {
      const { nonce } = await fetch('/api/auth/challenge').then(r => r.json());
      const proof = SHA256(`${nonce}:${entered}`);
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, proof }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || t('Unlock failed'));
      location.replace(next);
    } catch (err) {
      msg(err.message, 'err');
      field.value = '';
      field.focus();
    } finally {
      btn.disabled = false;
    }
  };
  document.getElementById('pw').focus();
})();
