// Share & clipboard lab
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const canvas = $('card');

  // A small image to share and copy, drawn fresh each time
  function drawCard() {
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0e1013');
    gradient.addColorStop(1, '#14301f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 54px Kode, monospace';
    ctx.fillText('~/pwa-lab', 40, 130);
    ctx.fillStyle = '#e6e8eb';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText($('shareText').value.slice(0, 40), 40, 190);
    ctx.fillStyle = '#6b7280';
    ctx.font = '20px Kode, monospace';
    ctx.fillText(new Date().toLocaleString('en-GB'), 40, 260);
  }

  const cardBlob = () => new Promise(resolve => {
    drawCard();
    canvas.toBlob(resolve, 'image/png');
  });

  async function share(data, label) {
    if (!navigator.share) return log('Web Share is not available here', 'error');
    if (navigator.canShare && !navigator.canShare(data)) return log('canShare() says no to ' + label, 'warn');
    try {
      await navigator.share(data);
      log('Shared ' + label, 'ok');
    } catch (error) {
      log(error.name === 'AbortError' ? 'Share sheet dismissed' : 'Share failed: ' + error.message, error.name === 'AbortError' ? 'info' : 'error');
    }
  }

  $('shareLink').addEventListener('click', () => share({
    title: 'PWA Lab',
    text: $('shareText').value,
    url: location.origin + '/pwa/'
  }, 'a link'));

  // Build the file before awaiting anything, so the share keeps the tap's user activation
  let pendingImage = null;
  const prepareImage = () => cardBlob().then(blob => {
    pendingImage = new File([blob], 'pwa-lab.png', { type: 'image/png' });
  });

  $('shareImage').addEventListener('click', () => {
    if (!pendingImage) return log('Image not ready yet, try again', 'warn');
    share({ files: [pendingImage], title: 'PWA Lab' }, 'an image');
    prepareImage();
  });

  $('shareFile').addEventListener('click', () => {
    const text = 'Shared from PWA Lab at ' + new Date().toISOString() + '\n\n' + $('shareText').value + '\n';
    share({ files: [new File([text], 'pwa-lab.txt', { type: 'text/plain' })] }, 'a text file');
  });

  $('shareText').addEventListener('input', () => prepareImage());

  // Clipboard
  $('copyText').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('clipText').value);
      log('Copied text', 'ok');
    } catch (error) {
      log('Copy failed: ' + error.message, 'error');
    }
  });

  $('pasteText').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('pasted').textContent = text || '(clipboard is empty)';
      log('Pasted ' + text.length + ' characters', 'ok');
    } catch (error) {
      log('Paste failed: ' + error.name + ' ' + error.message, 'error');
    }
  });

  $('copyImage').addEventListener('click', async () => {
    if (!('ClipboardItem' in window)) return log('ClipboardItem is not supported', 'error');
    try {
      // Safari wants the promise handed over synchronously inside the tap
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob() })]);
      log('Copied the image. Paste it into Notes or Messages.', 'ok');
    } catch (error) {
      log('Image copy failed: ' + error.message, 'error');
    }
  });

  Lab.setStatus($('shareStatus'), 'share' in navigator ? 'yes' : 'no');
  Lab.setStatus($('clipStatus'), navigator.clipboard ? 'yes' : 'no');
  if (document.fonts) document.fonts.ready.then(prepareImage); else prepareImage();
})();
