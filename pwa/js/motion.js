// Motion & location lab
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const fmt = (n, digits = 1, unit = '') => n == null || isNaN(n) ? '–' : Number(n).toFixed(digits) + unit;
  const kv = rows => rows
    .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
    .join('');

  // Sensors
  const latest = { orientation: null, motion: null, events: 0 };
  let frameQueued = false;
  let started = 0;

  function renderSensors() {
    frameQueued = false;
    const o = latest.orientation || {};
    const m = latest.motion || {};
    const g = m.accelerationIncludingGravity || {};
    const r = m.rotationRate || {};
    const heading = o.webkitCompassHeading != null ? o.webkitCompassHeading
      : o.absolute && o.alpha != null ? 360 - o.alpha : null;

    $('sensors').innerHTML = kv([
      ['Alpha (z)', fmt(o.alpha, 0, '°')],
      ['Beta (x tilt)', fmt(o.beta, 0, '°')],
      ['Gamma (y tilt)', fmt(o.gamma, 0, '°')],
      ['Compass heading', fmt(heading, 0, '°')],
      ['Compass accuracy', o.webkitCompassAccuracy != null ? '±' + fmt(o.webkitCompassAccuracy, 0, '°') : '–'],
      ['Acceleration', [g.x, g.y, g.z].map(v => fmt(v, 1)).join(' / ') + ' m/s²'],
      ['Rotation rate', [r.alpha, r.beta, r.gamma].map(v => fmt(v, 0)).join(' / ') + ' °/s'],
      ['Events/s', started ? fmt(latest.events / ((Date.now() - started) / 1000), 0) : '–']
    ]);

    // Spirit level: tilt moves the bubble, clamped to the instrument
    const clamp = (v, max) => Math.max(-max, Math.min(max, v || 0));
    $('bubble').style.transform = 'translate(' + clamp(o.gamma, 45) * 2 + 'px,' + clamp(o.beta, 45) * 2 + 'px)';
    if (heading != null) {
      $('needle').style.transform = 'rotate(' + -heading + 'deg)';
      $('headingLabel').textContent = 'Heading ' + Math.round(heading) + '°';
    }
  }

  function queue() {
    latest.events++;
    if (!frameQueued) {
      frameQueued = true;
      requestAnimationFrame(renderSensors);
    }
  }

  async function enableMotion() {
    try {
      for (const Event of [window.DeviceOrientationEvent, window.DeviceMotionEvent]) {
        if (Event && typeof Event.requestPermission === 'function') {
          const result = await Event.requestPermission();
          log((Event === window.DeviceMotionEvent ? 'Motion' : 'Orientation') + ' permission: ' + result, result === 'granted' ? 'ok' : 'warn');
          if (result !== 'granted') {
            Lab.setStatus($('motionStatus'), 'no', 'Denied');
            return;
          }
        }
      }
    } catch (error) {
      return log('Permission request failed: ' + error.message, 'error');
    }
    window.addEventListener('deviceorientation', event => { latest.orientation = event; queue(); });
    window.addEventListener('devicemotion', event => { latest.motion = event; queue(); });
    started = Date.now();
    $('enableMotion').disabled = true;
    Lab.setStatus($('motionStatus'), 'yes', 'Listening');
    log('Listening for sensor events. Tilt the phone.', 'ok');
    setTimeout(() => {
      if (!latest.events) log('No sensor events yet. This device may not have motion sensors.', 'warn');
    }, 2000);
  }

  // Geolocation
  let watchId = null;
  let track = [];
  let distance = 0;

  function haversine(a, b) {
    const R = 6371000;
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function renderPosition(pos) {
    const c = pos.coords;
    $('geo').innerHTML = kv([
      ['Latitude', fmt(c.latitude, 5)],
      ['Longitude', fmt(c.longitude, 5)],
      ['Accuracy', '±' + fmt(c.accuracy, 0, ' m')],
      ['Altitude', c.altitude != null ? fmt(c.altitude, 0, ' m') + ' ±' + fmt(c.altitudeAccuracy, 0) : '–'],
      ['Speed', c.speed != null ? fmt(c.speed * 3.6, 1, ' km/h') : '–'],
      ['Heading', fmt(c.heading, 0, '°')],
      ['Fixes', String(track.length || 1)],
      ['Distance tracked', fmt(distance, 0, ' m')],
      ['Time', new Date(pos.timestamp).toLocaleTimeString('en-GB')]
    ]);
  }

  function geoError(error) {
    const names = { 1: 'Permission denied', 2: 'Position unavailable', 3: 'Timed out' };
    log('Geolocation: ' + (names[error.code] || error.message), 'error');
    Lab.setStatus($('geoStatus'), 'no', names[error.code] || 'Error');
  }

  const geoOptions = () => ({ enableHighAccuracy: $('highAccuracy').checked, timeout: 20000, maximumAge: 0 });

  $('locate').addEventListener('click', () => {
    if (!('geolocation' in navigator)) return log('Geolocation not available', 'error');
    log('Locating…');
    navigator.geolocation.getCurrentPosition(pos => {
      renderPosition(pos);
      Lab.setStatus($('geoStatus'), 'yes', 'Located');
      log('Fix with ±' + Math.round(pos.coords.accuracy) + ' m accuracy', 'ok');
    }, geoError, geoOptions());
  });

  $('watch').addEventListener('click', () => {
    if (!('geolocation' in navigator)) return log('Geolocation not available', 'error');
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      $('watch').textContent = 'Start tracking';
      Lab.setStatus($('geoStatus'), 'partial', 'Stopped');
      log('Tracking stopped after ' + track.length + ' fixes, ' + Math.round(distance) + ' m');
      return;
    }
    track = [];
    distance = 0;
    watchId = navigator.geolocation.watchPosition(pos => {
      const prev = track[track.length - 1];
      const step = prev ? haversine(prev, pos.coords) : Infinity;
      // Ignore jitter smaller than the reported accuracy
      if (step > Math.max(pos.coords.accuracy, 5)) {
        if (prev) distance += step;
        track.push(pos.coords);
      }
      renderPosition(pos);
    }, geoError, geoOptions());
    $('watch').textContent = 'Stop tracking';
    Lab.setStatus($('geoStatus'), 'yes', 'Tracking');
    log('Tracking. Walk around; iOS pauses this when you leave the app.', 'ok');
  });

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(status => {
      log('Geolocation permission: ' + status.state);
      status.onchange = () => log('Geolocation permission changed: ' + status.state);
    }).catch(() => {});
  }

  $('enableMotion').addEventListener('click', enableMotion);
  if (!('DeviceOrientationEvent' in window)) {
    $('enableMotion').disabled = true;
    Lab.setStatus($('motionStatus'), 'no');
  }
  renderSensors();
})();
