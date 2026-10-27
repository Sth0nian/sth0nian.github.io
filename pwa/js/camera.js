// Camera & microphone lab
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const video = $('preview');
  let stream = null;
  let recorder = null;
  let scanning = false;
  let torchOn = false;

  const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if (!hasMedia) {
    $('start').disabled = true;
    $('recAudio').disabled = true;
    log('getUserMedia is not available here', 'error');
  }

  function setRunning(running) {
    $('start').disabled = running || !hasMedia;
    $('stop').disabled = !running;
    $('snap').disabled = !running;
    $('recVideo').disabled = !running || !('MediaRecorder' in window);
    $('scan').disabled = !running || !('BarcodeDetector' in window);
    video.hidden = !running;
  }

  function renderTrack() {
    const track = stream && stream.getVideoTracks()[0];
    if (!track) {
      $('track').innerHTML = '';
      return;
    }
    const s = track.getSettings();
    const rows = [
      ['Camera', track.label || '–'],
      ['Size', (s.width || '?') + '×' + (s.height || '?')],
      ['Frame rate', s.frameRate ? Math.round(s.frameRate) + ' fps' : '–'],
      ['Facing', s.facingMode || '–']
    ];
    $('track').innerHTML = rows
      .map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
      .join('');

    const caps = track.getCapabilities ? track.getCapabilities() : {};
    $('torch').hidden = !caps.torch;
  }

  async function start() {
    const [width, height] = $('resolution').value.split('x').map(Number);
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: $('facing').value, width: { ideal: width }, height: { ideal: height } },
        audio: true
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      setRunning(true);
      renderTrack();
      log('Camera started', 'ok');
      const devices = await navigator.mediaDevices.enumerateDevices();
      log(devices.filter(d => d.kind === 'videoinput').length + ' cameras, ' +
        devices.filter(d => d.kind === 'audioinput').length + ' microphones');
    } catch (error) {
      log('Camera failed: ' + error.name + ' ' + error.message, 'error');
    }
  }

  function stop() {
    scanning = false;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    setRunning(false);
    renderTrack();
    log('Camera stopped');
  }

  function snap() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.alt = 'Captured photo';
      img.title = 'Tap to share or save';
      img.addEventListener('click', () => shareBlob(blob, 'lab-photo.jpg'));
      $('photos').prepend(img);
      log('Photo ' + canvas.width + '×' + canvas.height + ', ' + Lab.formatBytes(blob.size), 'ok');
    }, 'image/jpeg', 0.9);
  }

  async function shareBlob(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(error => log('Share: ' + error.message, 'warn'));
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
  }

  function pickMimeType(kind) {
    const candidates = kind === 'video'
      ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      : ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function record(kind) {
    if (!('MediaRecorder' in window)) return log('MediaRecorder is not available', 'error');
    let source = stream;
    let ownStream = false;
    if (kind === 'audio') {
      try {
        source = await navigator.mediaDevices.getUserMedia({ audio: true });
        ownStream = true;
      } catch (error) {
        return log('Microphone failed: ' + error.message, 'error');
      }
    }
    const mimeType = pickMimeType(kind);
    const chunks = [];
    recorder = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
    const started = Date.now();
    recorder.ondataavailable = event => event.data.size && chunks.push(event.data);
    recorder.onstop = () => {
      if (ownStream) source.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      const el = document.createElement(kind === 'video' ? 'video' : 'audio');
      el.src = URL.createObjectURL(blob);
      el.controls = true;
      el.playsInline = true;
      el.className = 'media';
      $('recordings').prepend(el);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      log('Recorded ' + seconds + ' s of ' + kind + ' as ' + (blob.type || 'unknown type') + ', ' + Lab.formatBytes(blob.size), 'ok');
      Lab.setStatus($('recStatus'), 'yes', 'Done');
      $('recStop').disabled = true;
      $('recAudio').disabled = false;
      $('recVideo').disabled = !stream;
    };
    recorder.start(1000);
    Lab.setStatus($('recStatus'), 'no', '● Recording ' + kind);
    $('recStop').disabled = false;
    $('recAudio').disabled = true;
    $('recVideo').disabled = true;
    log('Recording ' + kind + ' as ' + (mimeType || 'default type'));
  }

  async function scan() {
    let detector;
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      detector = new BarcodeDetector({ formats });
      log('Scanning for: ' + formats.join(', '));
    } catch (error) {
      return log('BarcodeDetector failed: ' + error.message, 'error');
    }
    scanning = true;
    $('scan').disabled = true;
    const loop = async () => {
      if (!scanning) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          codes.forEach(code => log(code.format + ': ' + code.rawValue, 'ok'));
          scanning = false;
          $('scan').disabled = !stream;
          return;
        }
      } catch (error) {
        log('Detect failed: ' + error.message, 'error');
        scanning = false;
        return;
      }
      setTimeout(loop, 250);
    };
    loop();
  }

  $('start').addEventListener('click', start);
  $('stop').addEventListener('click', stop);
  $('snap').addEventListener('click', snap);
  $('recVideo').addEventListener('click', () => record('video'));
  $('recAudio').addEventListener('click', () => record('audio'));
  $('recStop').addEventListener('click', () => recorder && recorder.state !== 'inactive' && recorder.stop());
  $('scan').addEventListener('click', scan);
  $('facing').addEventListener('change', () => { if (stream) { stop(); start(); } });
  $('resolution').addEventListener('change', () => { if (stream) { stop(); start(); } });
  $('torch').addEventListener('click', async () => {
    const track = stream && stream.getVideoTracks()[0];
    if (!track) return;
    try {
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      log('Torch ' + (torchOn ? 'on' : 'off'), 'ok');
    } catch (error) {
      log('Torch failed: ' + error.message, 'error');
    }
  });

  $('fileInput').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    $('filePreview').src = URL.createObjectURL(file);
    $('filePreview').hidden = false;
    log('Got ' + (file.name || 'a photo') + ' (' + file.type + ', ' + Lab.formatBytes(file.size) + ')', 'ok');
  });

  Lab.setStatus($('barcodeStatus'), 'BarcodeDetector' in window ? 'yes' : 'no');
  Lab.setStatus($('recStatus'), 'MediaRecorder' in window ? 'yes' : 'no', 'MediaRecorder' in window ? 'Ready' : 'No MediaRecorder');
  window.addEventListener('pagehide', stop);
})();
