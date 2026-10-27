// Screen wake lock lab
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  let lock = null;
  let wanted = false;
  let since = null;
  let timer = null;

  function render() {
    const active = !!lock && !lock.released;
    Lab.setStatus($('status'), active ? 'yes' : wanted ? 'partial' : 'unknown', active ? 'Screen kept on' : wanted ? 'Waiting to re-acquire' : 'Off');
    $('toggle').textContent = wanted ? 'Let the screen sleep' : 'Keep screen on';
    $('toggle').className = wanted ? 'button secondary' : 'button';
  }

  function tick() {
    const seconds = since ? Math.floor((Date.now() - since) / 1000) : 0;
    $('elapsed').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  async function acquire() {
    try {
      lock = await navigator.wakeLock.request('screen');
      since = since || Date.now();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
      log('Wake lock acquired', 'ok');
      lock.addEventListener('release', () => {
        log('Wake lock released' + (document.visibilityState === 'hidden' ? ' (app went to the background)' : ''), 'warn');
        render();
      });
    } catch (error) {
      log('Wake lock request failed: ' + error.name + ' ' + error.message, 'error');
    }
    render();
  }

  async function release() {
    wanted = false;
    if (lock && !lock.released) await lock.release();
    lock = null;
    since = null;
    clearInterval(timer);
    tick();
    render();
  }

  if (!('wakeLock' in navigator)) {
    $('toggle').disabled = true;
    Lab.setStatus($('status'), 'no');
    log('The Screen Wake Lock API is not available here', 'error');
    return;
  }

  $('toggle').addEventListener('click', () => {
    if (wanted) {
      release();
    } else {
      wanted = true;
      acquire();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && $('auto').checked && (!lock || lock.released)) {
      log('Back in the app, re-acquiring…');
      acquire();
    }
  });

  render();
})();
