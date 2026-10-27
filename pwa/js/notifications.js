// Notifications & badge lab
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const supported = 'Notification' in window;
  let badge = 0;

  function renderPermission() {
    const el = document.getElementById('permission');
    if (!supported) {
      Lab.setStatus(el, Lab.isStandalone() ? 'no' : 'install');
      return;
    }
    const p = Notification.permission;
    Lab.setStatus(el, p === 'granted' ? 'yes' : p === 'denied' ? 'no' : 'partial', p);
    document.getElementById('request').disabled = p !== 'default';
  }

  function renderBadge() {
    const el = document.getElementById('badgeStatus');
    if (!('setAppBadge' in navigator)) {
      Lab.setStatus(el, Lab.isStandalone() ? 'no' : 'install');
    } else {
      Lab.setStatus(el, 'yes', 'Badge: ' + badge);
    }
  }

  document.getElementById('request').addEventListener('click', async () => {
    if (!supported) return log('Notifications are not available here', 'error');
    try {
      const result = await Notification.requestPermission();
      log('Permission: ' + result, result === 'granted' ? 'ok' : 'warn');
    } catch (error) {
      log(error.message, 'error');
    }
    renderPermission();
  });

  document.getElementById('send').addEventListener('click', async () => {
    if (!supported) return log('Notifications are not available here', 'error');
    if (Notification.permission !== 'granted') return log('Grant permission first', 'warn');
    const reg = await Lab.ready;
    if (!reg) return log('No service worker registration', 'error');

    const title = document.getElementById('nTitle').value || 'PWA Lab';
    const body = document.getElementById('nBody').value;
    const delay = Number(document.getElementById('nDelay').value);
    const tag = document.getElementById('nSameTag').checked ? 'lab' : 'lab-' + Date.now();

    const show = async () => {
      try {
        await reg.showNotification(title, {
          body,
          tag,
          icon: '/pwa/icons/icon-192.png',
          badge: '/pwa/icons/icon-192.png',
          data: { url: '/pwa/notifications.html?from=notification' }
        });
        log('Notification shown (tag ' + tag + ')', 'ok');
      } catch (error) {
        log('showNotification failed: ' + error.message, 'error');
      }
    };

    if (delay) {
      log('Sending in ' + delay + ' s. Leave the app to see it as a banner.');
      setTimeout(show, delay * 1000);
    } else {
      show();
    }
  });

  async function setBadge(count) {
    if (!('setAppBadge' in navigator)) return log('Badging is not available here', 'error');
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
      badge = count;
      log(count > 0 ? 'Badge set to ' + count + '. Check the home screen icon.' : 'Badge cleared', 'ok');
    } catch (error) {
      log('Badge failed: ' + error.message + ' (it needs notification permission)', 'error');
    }
    renderBadge();
  }

  const countInput = document.getElementById('badgeCount');
  document.getElementById('setBadge').addEventListener('click', () => setBadge(Math.max(0, Number(countInput.value) || 0)));
  document.getElementById('bumpBadge').addEventListener('click', () => {
    countInput.value = badge + 1;
    setBadge(badge + 1);
  });
  document.getElementById('clearBadge').addEventListener('click', () => setBadge(0));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      const data = event.data || {};
      if (data.type === 'notification-click') log('Notification tapped: "' + data.title + '"', 'ok');
      if (data.type === 'notification-close') log('Notification dismissed (tag ' + data.tag + ')');
    });
  }

  if (new URLSearchParams(location.search).get('from') === 'notification') {
    log('Opened by tapping a notification', 'ok');
  }

  renderPermission();
  renderBadge();
})();
