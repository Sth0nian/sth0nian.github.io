// Offline lab: service worker state, simulated offline and cache contents
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const simToggle = document.getElementById('simOffline');
  const kv = rows => rows
    .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
    .join('');

  if (!('serviceWorker' in navigator)) {
    document.getElementById('sw').innerHTML = kv([['Service worker', 'Not supported']]);
    simToggle.disabled = true;
    return;
  }

  function renderNetwork() {
    Lab.setStatus(document.getElementById('netStatus'), navigator.onLine ? 'yes' : 'no', navigator.onLine ? 'Online' : 'Offline');
  }

  async function renderWorker() {
    const reg = await Lab.ready;
    let state = { version: '–', offline: false };
    try {
      state = await Lab.askWorker({ type: 'state' });
    } catch (error) {
      log(error.message, 'warn');
    }
    simToggle.checked = !!state.offline;
    document.getElementById('sw').innerHTML = kv([
      ['Version', state.version],
      ['Controls this page', navigator.serviceWorker.controller ? 'Yes' : 'Not yet, reload once'],
      ['Active', reg && reg.active ? reg.active.state : '–'],
      ['Waiting update', reg && reg.waiting ? 'Yes' : 'No'],
      ['Scope', reg ? new URL(reg.scope).pathname : '–'],
      ['Simulating offline', state.offline ? 'Yes' : 'No']
    ]);
  }

  async function renderCaches() {
    const el = document.getElementById('caches');
    try {
      const names = await caches.keys();
      if (!names.length) {
        el.textContent = 'No caches yet.';
        return;
      }
      const parts = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        let total = 0;
        const rows = [];
        for (const request of requests) {
          const response = await cache.match(request);
          const size = response ? (await response.clone().blob()).size : 0;
          total += size;
          rows.push('<li><span class="feature-name small">' + Lab.escape(new URL(request.url).pathname) +
            '</span><span class="muted small">' + Lab.formatBytes(size) + '</span></li>');
        }
        parts.push('<h3>' + Lab.escape(name) + ' · ' + requests.length + ' files · ' + Lab.formatBytes(total) + '</h3>' +
          '<ul class="features">' + rows.join('') + '</ul>');
      }
      el.innerHTML = parts.join('');
    } catch (error) {
      el.textContent = 'Could not read caches: ' + error.message;
    }
  }

  simToggle.addEventListener('change', async () => {
    try {
      const reply = await Lab.askWorker({ type: 'sim-offline', on: simToggle.checked });
      log(reply.offline ? 'Simulated offline: on. Reload to see pages come from the cache.' : 'Simulated offline: off', reply.offline ? 'warn' : 'ok');
      renderWorker();
    } catch (error) {
      simToggle.checked = !simToggle.checked;
      log(error.message, 'error');
    }
  });

  document.getElementById('ping').addEventListener('click', async () => {
    try {
      const data = await (await fetch('/pwa/__ping?t=' + Date.now())).json();
      log('Answered by ' + data.source + (data.reason ? ' (' + data.reason + ')' : '') +
        (data.commit ? ', site commit ' + data.commit : ''), data.source === 'network' ? 'ok' : 'warn');
    } catch (error) {
      log('Request failed: ' + error.message + ' (is the service worker in control?)', 'error');
    }
  });

  document.getElementById('update').addEventListener('click', async () => {
    const reg = await Lab.ready;
    if (!reg) return log('No registration', 'error');
    try {
      await reg.update();
      log(reg.installing || reg.waiting ? 'Update found, installing…' : 'Already up to date', 'ok');
    } catch (error) {
      log('Update check failed: ' + error.message, 'error');
    }
    renderWorker();
  });

  document.getElementById('reload').addEventListener('click', () => location.reload());
  document.getElementById('refreshCaches').addEventListener('click', renderCaches);

  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm('Delete all lab caches and unregister the service worker?')) return;
    for (const name of await caches.keys()) await caches.delete(name);
    const reg = await navigator.serviceWorker.getRegistration('/pwa/');
    if (reg) await reg.unregister();
    log('Caches cleared and worker unregistered. Reload to start fresh.', 'warn');
    renderCaches();
  });

  window.addEventListener('online', () => { renderNetwork(); log('Back online', 'ok'); });
  window.addEventListener('offline', () => { renderNetwork(); log('Network lost', 'warn'); });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    log('A new service worker took control', 'ok');
    renderWorker();
  });

  renderNetwork();
  renderWorker();
  renderCaches();
})();
