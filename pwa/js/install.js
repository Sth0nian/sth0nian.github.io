// Install & launch lab
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const kv = rows => rows
    .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
    .join('');

  // Count launches once per session
  let launches = 0;
  let firstLaunch = null;
  try {
    launches = Number(localStorage.getItem('lab-launches') || 0);
    if (!sessionStorage.getItem('lab-session')) {
      sessionStorage.setItem('lab-session', '1');
      launches += 1;
      localStorage.setItem('lab-launches', launches);
    }
    firstLaunch = localStorage.getItem('lab-first-launch');
    if (!firstLaunch) {
      firstLaunch = new Date().toISOString();
      localStorage.setItem('lab-first-launch', firstLaunch);
    }
  } catch (error) {
    log('Storage unavailable: ' + error.message, 'warn');
  }

  const fromHomeScreen = new URLSearchParams(location.search).get('source') === 'homescreen' ||
    document.referrer === '' && Lab.isStandalone();

  function renderState() {
    const media = q => window.matchMedia(q).matches;
    document.getElementById('state').innerHTML = kv([
      ['Display mode', Lab.displayMode()],
      ['navigator.standalone', String(navigator.standalone)],
      ['Launched from home screen', fromHomeScreen ? 'Yes' : 'No'],
      ['Sessions on this device', String(launches)],
      ['First seen', firstLaunch ? new Date(firstLaunch).toLocaleString('en-GB') : '–'],
      ['Colour scheme', media('(prefers-color-scheme: dark)') ? 'Dark' : 'Light'],
      ['Reduced motion', media('(prefers-reduced-motion: reduce)') ? 'On' : 'Off']
    ]);
  }

  // Measure env(safe-area-inset-*) through a probe element
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);

  function renderInsets() {
    const style = getComputedStyle(probe);
    const orientation = (screen.orientation && screen.orientation.type) ||
      (window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape');
    document.getElementById('insets').innerHTML = kv([
      ['Inset top', style.paddingTop],
      ['Inset bottom', style.paddingBottom],
      ['Inset left', style.paddingLeft],
      ['Inset right', style.paddingRight],
      ['Viewport', window.innerWidth + '×' + window.innerHeight],
      ['Screen', screen.width + '×' + screen.height + ' @' + devicePixelRatio + 'x'],
      ['Orientation', orientation]
    ]);
  }

  async function loadManifest() {
    const el = document.getElementById('manifest');
    try {
      const href = document.querySelector('link[rel="manifest"]').href;
      const manifest = await (await fetch(href)).json();
      el.textContent = JSON.stringify(manifest, null, 2);
    } catch (error) {
      el.textContent = 'Could not load the manifest: ' + error.message;
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    log('beforeinstallprompt fired (this browser offers its own install prompt)', 'ok');
    event.preventDefault();
  });
  window.addEventListener('appinstalled', () => log('appinstalled fired', 'ok'));
  window.addEventListener('resize', renderInsets);
  window.addEventListener('orientationchange', () => {
    log('Orientation changed');
    setTimeout(renderInsets, 300);
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', event => {
    log('Display mode changed: standalone = ' + event.matches);
    renderState();
  });
  document.addEventListener('visibilitychange', () => log('Visibility: ' + document.visibilityState));

  renderState();
  renderInsets();
  loadManifest();
  log(Lab.isStandalone() ? 'Running as an installed app' : 'Running in a browser tab', Lab.isStandalone() ? 'ok' : 'info');
})();
