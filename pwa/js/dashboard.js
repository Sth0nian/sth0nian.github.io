// Dashboard: device summary plus a live run of every capability check
(function () {
  const results = [];

  function renderEnv() {
    const env = Lab.env();
    const rows = [
      ['Device', env.device],
      ['Mode', env.standalone ? 'Installed app (' + env.mode + ')' : 'Browser tab'],
      ['Safari', env.safari || '–'],
      ['iOS (user agent)', env.ios || '–'],
      ['Screen', env.screen],
      ['Online', env.online ? 'Yes' : 'No']
    ];
    document.getElementById('env').innerHTML = rows
      .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
      .join('');
  }

  function renderSummary() {
    const counts = { yes: 0, partial: 0, install: 0, no: 0, unknown: 0 };
    results.forEach(r => counts[r.result.state]++);
    document.getElementById('summary').innerHTML = [
      Lab.pill('yes', counts.yes + ' supported'),
      counts.partial ? Lab.pill('partial', counts.partial + ' partial') : '',
      counts.install ? Lab.pill('install', counts.install + ' need install') : '',
      Lab.pill('no', counts.no + ' missing')
    ].join('');
  }

  async function runAll() {
    results.length = 0;
    const container = document.getElementById('groups');
    container.innerHTML = FEATURE_GROUPS.map((group, g) =>
      '<section class="card">' +
        '<div class="group-head">' +
          '<h2 class="card-title"><span class="emoji">' + group.emoji + '</span> ' + Lab.escape(group.name) + '</h2>' +
          (group.lab ? '<a href="' + group.lab + '">Open lab →</a>' : '') +
        '</div>' +
        '<ul class="features">' +
          group.items.map((item, i) =>
            '<li><span class="feature-name">' + Lab.escape(item.name) +
            '<span class="feature-detail" id="d-' + g + '-' + i + '"></span></span>' +
            '<span id="s-' + g + '-' + i + '">' + Lab.pill('unknown', 'Checking…') + '</span></li>'
          ).join('') +
        '</ul>' +
      '</section>'
    ).join('');

    await Promise.all(FEATURE_GROUPS.flatMap((group, g) =>
      group.items.map(async (item, i) => {
        const result = await runFeature(item);
        results.push({ group: group.name, name: item.name, result, order: g * 100 + i });
        Lab.setStatus(document.getElementById('s-' + g + '-' + i), result.state);
        document.getElementById('d-' + g + '-' + i).textContent = result.detail || '';
      })
    ));
    results.sort((a, b) => a.order - b.order);
    renderSummary();
  }

  function report() {
    const env = Lab.env();
    const icon = { yes: '✅', partial: '🟡', install: '📲', no: '❌', unknown: '❔' };
    const lines = [
      'PWA Lab report · ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
      env.device + ' · Safari ' + (env.safari || '?') + ' · iOS (UA) ' + (env.ios || '?') + ' · ' +
        (env.standalone ? 'installed app' : 'browser tab'),
      env.ua,
      ''
    ];
    let group = null;
    for (const r of results) {
      if (r.group !== group) {
        group = r.group;
        lines.push('', '## ' + group);
      }
      lines.push(icon[r.result.state] + ' ' + r.name + (r.result.detail ? ' (' + r.result.detail + ')' : ''));
    }
    return lines.join('\n');
  }

  document.getElementById('copyReport').addEventListener('click', async event => {
    const ok = await Lab.copyText(report());
    event.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { event.target.textContent = 'Copy report'; }, 2000);
  });

  const shareButton = document.getElementById('shareReport');
  if ('share' in navigator) {
    shareButton.hidden = false;
    shareButton.addEventListener('click', () => {
      navigator.share({ title: 'PWA Lab report', text: report() }).catch(() => {});
    });
  }

  document.getElementById('rerun').addEventListener('click', () => {
    renderEnv();
    runAll();
  });

  renderEnv();
  runAll();
  // The page becomes controlled once the worker activates: refresh that row
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', runAll);
  }
})();
