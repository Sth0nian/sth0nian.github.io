// Visuals lab: view transitions, scroll-driven animation and anchor positioning
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const colors = ['#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c'];
  let order = colors.map((_, i) => i);
  let expanded = null;

  // Same-document transitions
  const canTransition = 'startViewTransition' in document;
  Lab.setStatus($('sameStatus'), canTransition ? 'yes' : 'no');

  function renderGrid() {
    $('grid').innerHTML = order.map(i =>
      '<button type="button" class="vt-tile' + (expanded === i ? ' expanded' : '') + '" data-i="' + i +
      '" style="background:' + colors[i] + ';view-transition-name:tile-' + i + '">' + (i + 1) + '</button>'
    ).join('');
  }

  function transition(update, label) {
    if (!canTransition) {
      update();
      return;
    }
    const started = performance.now();
    const vt = document.startViewTransition(update);
    vt.finished.then(() => log(label + ' animated in ' + Math.round(performance.now() - started) + ' ms', 'ok'));
  }

  $('shuffle').addEventListener('click', () => transition(() => {
    order = order.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
    renderGrid();
  }, 'Shuffle'));

  $('grid').addEventListener('click', event => {
    const tile = event.target.closest('.vt-tile');
    if (!tile) return;
    const i = Number(tile.dataset.i);
    transition(() => {
      expanded = expanded === i ? null : i;
      // Move the expanded tile to the front so it spans the full row
      if (expanded != null) order = [i, ...order.filter(v => v !== i)];
      renderGrid();
    }, expanded === i ? 'Collapse' : 'Expand');
  });

  // Cross-document transitions: the same page in two states
  const detail = new URLSearchParams(location.search).get('view') === 'detail';
  $('hero').classList.toggle('big', detail);
  $('heroLink').href = detail ? '/pwa/transitions.html' : '/pwa/transitions.html?view=detail';
  $('heroLink').textContent = detail ? 'Back to the small version' : 'Open the big version';

  // Recorded by an inline script in <head>, since pagereveal can fire before this file runs
  function reportReveal() {
    const reveal = window.labReveal;
    if (!reveal) {
      Lab.setStatus($('crossStatus'), 'no', 'No pagereveal event');
      log('pagereveal never fired: cross-document transitions are not supported', 'warn');
      return;
    }
    Lab.setStatus($('crossStatus'), reveal.transition ? 'yes' : 'partial', reveal.transition ? 'Transition ran' : 'Not this time');
    log(reveal.transition
      ? 'pagereveal: a cross-document view transition ran on this load'
      : 'pagereveal fired without a transition (normal on a first load: use the link)', reveal.transition ? 'ok' : 'info');
  }
  if (window.labReveal || !('onpagereveal' in window)) {
    reportReveal();
  } else {
    // pagereveal waits for the first render, which can come after this script and even after load
    const timer = setTimeout(reportReveal, 3000);
    window.addEventListener('lab-reveal', () => {
      clearTimeout(timer);
      reportReveal();
    }, { once: true });
  }

  const scroll = CSS.supports('animation-timeline: scroll()');
  Lab.setStatus($('scrollStatus'), scroll ? 'yes' : 'no');
  const anchor = CSS.supports('anchor-name: --a');
  Lab.setStatus($('anchorStatus'), anchor ? 'yes' : 'no');
  if (!anchor) log('Anchor positioning not supported: the tooltip stays hidden', 'warn');

  renderGrid();
})();
