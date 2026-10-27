// Storage lab: quota, persistence, eviction tracker, IndexedDB notes and OPFS
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const kv = rows => rows
    .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
    .join('');
  const day = 24 * 60 * 60 * 1000;

  // Quota and persistence
  async function renderQuota() {
    if (!navigator.storage || !navigator.storage.estimate) {
      $('quota').innerHTML = kv([['Storage estimate', 'Not supported']]);
      return;
    }
    const { usage, quota } = await navigator.storage.estimate();
    $('quota').innerHTML = kv([
      ['Used', Lab.formatBytes(usage)],
      ['Quota', Lab.formatBytes(quota)],
      ['Used %', quota ? (usage / quota * 100).toFixed(2) + '%' : '–']
    ]);
    $('quotaBar').style.width = quota ? Math.max(1, usage / quota * 100) + '%' : '0';

    if (navigator.storage.persisted) {
      const persisted = await navigator.storage.persisted();
      Lab.setStatus($('persistStatus'), persisted ? 'yes' : 'partial', persisted ? 'Persistent' : 'Best effort');
      $('persist').disabled = persisted;
    } else {
      Lab.setStatus($('persistStatus'), 'no', 'No persist()');
      $('persist').disabled = true;
    }
  }

  $('persist').addEventListener('click', async () => {
    try {
      const granted = await navigator.storage.persist();
      log(granted ? 'Storage is now persistent' : 'Persistence was not granted (Safari decides based on how you use the site)', granted ? 'ok' : 'warn');
    } catch (error) {
      log(error.message, 'error');
    }
    renderQuota();
  });

  // IndexedDB helpers
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pwa-lab', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('meta');
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function tx(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const result = fn(t.objectStore(store));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }

  // Eviction tracker: same facts kept in two places
  async function renderTracker(db) {
    const now = Date.now();
    let idb = await tx(db, 'meta', 'readonly', s => s.get('visits'));
    const gap = idb ? now - idb.last : 0;
    idb = idb ? { first: idb.first, last: now, count: idb.count + 1 } : { first: now, last: now, count: 1 };
    await tx(db, 'meta', 'readwrite', s => s.put(idb, 'visits'));

    let local = null;
    try {
      local = JSON.parse(localStorage.getItem('lab-visits') || 'null');
      local = local ? { first: local.first, count: local.count + 1 } : { first: now, count: 1 };
      localStorage.setItem('lab-visits', JSON.stringify(local));
    } catch (error) {
      log('localStorage unavailable: ' + error.message, 'warn');
    }

    const date = t => new Date(t).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const agree = local && Math.abs(local.first - idb.first) < 60000;
    $('tracker').innerHTML = kv([
      ['First visit (IndexedDB)', date(idb.first)],
      ['First visit (localStorage)', local ? date(local.first) : '–'],
      ['Visits', String(idb.count)],
      ['Since last visit', gap ? (gap / day).toFixed(1) + ' days' : 'first visit'],
      ['Data age', ((now - idb.first) / day).toFixed(1) + ' days'],
      ['Stores agree', agree ? 'Yes' : 'No, one was wiped']
    ]);
    if (gap > 7 * day) log('Last visit was over 7 days ago and the data survived', 'ok');
  }

  // Notes
  async function renderNotes(db) {
    const notes = await tx(db, 'notes', 'readonly', s => s.getAll());
    $('notes').innerHTML = notes.length
      ? notes.reverse().map(note =>
        '<li><span class="feature-name">' + Lab.escape(note.text) +
        '<span class="feature-detail">' + new Date(note.created).toLocaleString('en-GB') + '</span></span>' +
        '<button type="button" class="button secondary" data-id="' + note.id + '">Delete</button></li>'
      ).join('')
      : '<li class="muted small">No notes yet. They survive reloads, restarts and offline use.</li>';
  }

  // OPFS
  async function listOpfs() {
    const root = await navigator.storage.getDirectory();
    const rows = [];
    for await (const [name, handle] of root.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await handle.getFile();
      rows.push('<li><span class="feature-name small">' + Lab.escape(name) + '</span><span class="muted small">' +
        Lab.formatBytes(file.size) + '</span></li>');
    }
    $('opfsFiles').innerHTML = rows.join('') || '<li class="muted small">No files.</li>';
    return rows.length;
  }

  async function writeOpfs() {
    const mb = Number($('opfsSize').value);
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('test-' + mb + 'mb-' + Date.now() + '.bin', { create: true });
    if (!handle.createWritable) throw new Error('createWritable is not supported here (only from workers)');
    const started = performance.now();
    const writable = await handle.createWritable();
    const chunk = new Uint8Array(1024 * 1024);
    crypto.getRandomValues(chunk.subarray(0, 65536));
    for (let i = 0; i < mb; i++) await writable.write(chunk);
    await writable.close();
    const writeMs = performance.now() - started;

    const readStart = performance.now();
    const file = await handle.getFile();
    await file.arrayBuffer();
    const readMs = performance.now() - readStart;
    log('Wrote ' + mb + ' MB in ' + writeMs.toFixed(0) + ' ms (' + (mb / writeMs * 1000).toFixed(0) +
      ' MB/s), read back in ' + readMs.toFixed(0) + ' ms', 'ok');
  }

  async function init() {
    renderQuota();

    if (!('indexedDB' in window)) {
      log('IndexedDB is not available', 'error');
    } else {
      try {
        const db = await openDb();
        await renderTracker(db);
        await renderNotes(db);

        $('noteForm').addEventListener('submit', async event => {
          event.preventDefault();
          const text = $('noteText').value.trim();
          if (!text) return;
          await tx(db, 'notes', 'readwrite', s => s.add({ text, created: Date.now() }));
          $('noteText').value = '';
          renderNotes(db);
          renderQuota();
        });
        $('notes').addEventListener('click', async event => {
          const id = event.target.dataset.id;
          if (!id) return;
          await tx(db, 'notes', 'readwrite', s => s.delete(Number(id)));
          renderNotes(db);
        });
      } catch (error) {
        log('IndexedDB failed: ' + error.message, 'error');
      }
    }

    const opfs = !!(navigator.storage && navigator.storage.getDirectory);
    Lab.setStatus($('opfsStatus'), opfs ? 'yes' : 'no');
    if (!opfs) {
      ['opfsWrite', 'opfsList', 'opfsClear'].forEach(id => { $(id).disabled = true; });
      return;
    }
    listOpfs().catch(error => log('OPFS: ' + error.message, 'error'));

    $('opfsWrite').addEventListener('click', async event => {
      event.target.disabled = true;
      try {
        await writeOpfs();
      } catch (error) {
        log('Write failed: ' + error.name + ' ' + error.message, 'error');
      }
      event.target.disabled = false;
      listOpfs();
      renderQuota();
    });
    $('opfsList').addEventListener('click', () => listOpfs());
    $('opfsClear').addEventListener('click', async () => {
      const root = await navigator.storage.getDirectory();
      const names = [];
      for await (const name of root.keys()) names.push(name);
      for (const name of names) await root.removeEntry(name, { recursive: true });
      log('Deleted ' + names.length + ' files');
      listOpfs();
      renderQuota();
    });
  }

  init();
})();
