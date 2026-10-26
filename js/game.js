// TechJourney: an isometric dungeon crawl through my career.
// Each room holds a shrine with one chapter of the story; bugs roam the halls.
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const codexList = document.getElementById('codexList');
  const overlay = document.getElementById('loreOverlay');
  const overlayTitle = document.getElementById('loreTitle');
  const overlaySub = document.getElementById('loreSub');
  const overlayBody = document.getElementById('loreBody');
  const overlayClose = document.getElementById('loreClose');
  const fog = document.createElement('canvas');
  const fctx = fog.getContext('2d');

  const loadImage = src => { const i = new Image(); i.src = src; return i; };
  const heroSheet = loadImage('./img/player.png'); // 4 frames of 13x22, facing right
  const foeSheet = loadImage('./img/enemy.png');   // 2 frames of 13x24, facing left

  // Tile / projection constants
  const TW = 64, TH = 32, WALL_H = 46;
  const MAP_W = 40, MAP_H = 38;
  const VOID = 0, FLOOR = 1, WALL = 2, PROP = 3;
  const PLAYER_SPEED = 3.6;
  const MAX_HP = 5;

  // Room rectangles in tile coordinates, in the order the story is told
  const LAYOUT = [
    { x: 2, y: 2, w: 7, h: 7 },
    { x: 14, y: 3, w: 7, h: 6 },
    { x: 26, y: 2, w: 8, h: 8 },
    { x: 26, y: 16, w: 8, h: 7 },
    { x: 14, y: 16, w: 7, h: 8 },
    { x: 2, y: 16, w: 7, h: 7 },
    { x: 8, y: 29, w: 9, h: 6 }
  ];

  // Deterministic RNG so the dungeon looks the same on every visit
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(1337);

  // Colour helpers
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const shadeOf = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

  // World state
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const roomAt = new Int8Array(MAP_W * MAP_H).fill(-1);
  const tintAt = new Int8Array(MAP_W * MAP_H).fill(-1);
  const explored = new Uint8Array(MAP_W * MAP_H);
  const floorColor = [];
  const noise = new Float32Array(MAP_W * MAP_H);
  const idx = (x, y) => y * MAP_W + x;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const tileAt = (x, y) => inBounds(x, y) ? tiles[idx(x, y)] : VOID;

  let rooms = [];
  let props = [];
  let torches = [];
  let enemies = [];
  let particles = [];
  let floaters = [];
  let chest = null;

  const player = {
    x: 0, y: 0, r: 0.28, fx: 1, fy: 0, faceRight: true,
    hp: MAX_HP, inv: 0, atkCd: 0, swing: 0, kx: 0, ky: 0,
    moving: false, anim: 0, dead: 0
  };
  let path = null;
  let pathGoal = null;
  let repath = 0;
  let kills = 0;
  let paused = null;
  let strikeOnArrive = null;
  let currentRoom = -1;
  let banner = null;
  let shake = 0;
  let time = 0;
  const cam = { x: 0, y: 0 };
  const keys = {};
  let W = 0, H = 0, dpr = 1;

  // ---------- Dungeon generation ----------

  function buildDungeon(data) {
    rooms = LAYOUT.map((r, n) => {
      const d = data[n];
      return {
        ...r, ...d, n,
        rgb: hexToRgb(d.color),
        cx: r.x + Math.floor(r.w / 2),
        cy: r.y + Math.floor(r.h / 2),
        read: false, visited: false, respawn: 0
      };
    });

    const carve = (x, y) => { if (inBounds(x, y)) tiles[idx(x, y)] = FLOOR; };

    rooms.forEach(r => {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          carve(x, y);
          roomAt[idx(x, y)] = r.n;
        }
      }
    });

    // Two-wide L-shaped corridors joining each room to the next
    for (let n = 0; n < rooms.length - 1; n++) {
      const a = rooms[n], b = rooms[n + 1];
      for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx) + 1; x++) {
        carve(x, a.cy); carve(x, a.cy + 1);
      }
      for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy) + 1; y++) {
        carve(b.cx, y); carve(b.cx + 1, y);
      }
    }

    // Any void touching a floor becomes wall
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tiles[idx(x, y)] !== VOID) continue;
        let near = -2;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (tileAt(x + dx, y + dy) === FLOOR) {
              near = Math.max(near, inBounds(x + dx, y + dy) ? roomAt[idx(x + dx, y + dy)] : -1);
            }
          }
        }
        if (near > -2) {
          tiles[idx(x, y)] = WALL;
          tintAt[idx(x, y)] = near;
        }
      }
    }

    // Floor shading: stone, warmed by the room's colour
    const stone = [44, 42, 56];
    for (let i = 0; i < tiles.length; i++) {
      noise[i] = rand();
      const r = rooms[roomAt[i]];
      const base = r ? mix(stone, r.rgb, 0.13) : shadeOf(stone, 0.85);
      floorColor[i] = rgb(shadeOf(base, 0.86 + noise[i] * 0.22));
    }

    // Shrines, the chest, props and torches
    rooms.forEach(r => {
      tiles[idx(r.cx, r.cy)] = PROP;
      if (r.id === 'thanks') chest = { x: r.cx + 0.5, y: r.cy + 0.5, open: 0, room: r };

      const corners = [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]];
      corners.forEach(([x, y], k) => {
        if (k === 3 || rand() < 0.35) return;
        if (Math.abs(x - r.cx) <= 1 || Math.abs(y - r.cy) <= 1) return;
        tiles[idx(x, y)] = PROP;
        props.push({ x: x + 0.5, y: y + 0.5, kind: rand() < 0.5 ? 'barrel' : 'crate' });
      });

      [r.x + 1, r.x + r.w - 2].forEach(x => {
        if (tileAt(x, r.y - 1) === WALL) torches.push({ wx: x, wy: r.y - 1, face: 'y', x: x + 0.5, y: r.y, seed: rand() * 10 });
      });
      const ty = r.y + Math.floor(r.h / 2) - 2;
      if (tileAt(r.x - 1, ty) === WALL) torches.push({ wx: r.x - 1, wy: ty, face: 'x', x: r.x, y: ty + 0.5, seed: rand() * 10 });
    });

    rooms.forEach(spawnRoomFoes);

    const start = rooms[0];
    player.x = start.x + 1.5;
    player.y = start.y + start.h - 1.5;
    cam.x = (player.x - player.y) * TW / 2;
    cam.y = (player.x + player.y) * TH / 2;
  }

  function randomRoomSpot(r) {
    for (let tries = 0; tries < 40; tries++) {
      const x = r.x + 1 + Math.floor(rand() * (r.w - 2));
      const y = r.y + 1 + Math.floor(rand() * (r.h - 2));
      if (tileAt(x, y) === FLOOR && Math.hypot(x - r.cx, y - r.cy) > 1.5) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: r.x + 0.5, y: r.y + 0.5 };
  }

  function makeFoe(r, name) {
    const p = randomRoomSpot(r);
    return {
      x: p.x, y: p.y, r: 0.26, name, home: r.n, hp: 3, maxHp: 3,
      kx: 0, ky: 0, flash: 0, frame: 0, anim: rand(), faceRight: false,
      goal: null, wait: rand() * 2, rest: 0, speed: 0.8 + rand() * 0.3
    };
  }

  function spawnRoomFoes(r) {
    r.foes.forEach(name => enemies.push(makeFoe(r, name)));
  }

  // ---------- Movement & collision ----------

  function blocked(x, y, r) {
    return tileAt(Math.floor(x - r), Math.floor(y - r)) !== FLOOR ||
      tileAt(Math.floor(x + r), Math.floor(y - r)) !== FLOOR ||
      tileAt(Math.floor(x - r), Math.floor(y + r)) !== FLOOR ||
      tileAt(Math.floor(x + r), Math.floor(y + r)) !== FLOOR;
  }

  function move(e, dx, dy) {
    if (!blocked(e.x + dx, e.y, e.r)) e.x += dx;
    if (!blocked(e.x, e.y + dy, e.r)) e.y += dy;
  }

  // Breadth-first search to any walkable tile within one step of the goal
  function findPath(gx, gy, exact) {
    const sx = Math.floor(player.x), sy = Math.floor(player.y);
    const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
    const queue = [idx(sx, sy)];
    prev[queue[0]] = queue[0];
    const isGoal = (x, y) => exact ? (x === gx && y === gy) : Math.max(Math.abs(x - gx), Math.abs(y - gy)) <= 1;
    let found = -1;
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      const x = cur % MAP_W, y = (cur / MAP_W) | 0;
      if (isGoal(x, y)) { found = cur; break; }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (tileAt(nx, ny) !== FLOOR) continue;
          if (dx && dy && (tileAt(x + dx, y) !== FLOOR || tileAt(x, y + dy) !== FLOOR)) continue;
          const ni = idx(nx, ny);
          if (prev[ni] !== -1) continue;
          prev[ni] = cur;
          queue.push(ni);
        }
      }
    }
    if (found < 0) return null;
    const steps = [];
    for (let c = found; c !== prev[c]; c = prev[c]) steps.unshift({ x: c % MAP_W + 0.5, y: ((c / MAP_W) | 0) + 0.5 });
    return steps;
  }

  function walkTo(x, y, exact) {
    const p = findPath(Math.floor(x), Math.floor(y), exact);
    if (p) { path = p.length ? p : null; pathGoal = { x, y, exact }; }
  }

  // ---------- Combat ----------

  function attack() {
    if (player.atkCd > 0 || player.dead) return;
    // Snap to the closest foe in reach so clicking / mashing feels good
    let best = null, bestD = 1.7;
    enemies.forEach(e => {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bestD) { best = e; bestD = d; }
    });
    if (best && bestD > 0.01) {
      player.fx = (best.x - player.x) / bestD;
      player.fy = (best.y - player.y) / bestD;
      player.faceRight = player.fx - player.fy >= 0;
    }
    player.atkCd = 0.36;
    player.swing = 0.2;
    enemies.forEach(e => {
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d < 1.35 && (d < 0.6 || (dx * player.fx + dy * player.fy) / d > 0.2)) hitFoe(e, dx / d, dy / d);
    });

    // Striking an intact shrine (or the closed chest) reveals its chapter
    const shrine = shrineInReach();
    if (shrine) {
      const dx = shrine.cx + 0.5 - player.x, dy = shrine.cy + 0.5 - player.y;
      const d = Math.hypot(dx, dy) || 1;
      player.fx = dx / d; player.fy = dy / d;
      player.faceRight = player.fx - player.fy >= 0;
      shake = Math.max(shake, 0.15);
      burst(shrine.cx + 0.5, shrine.cy + 0.5, 50, '#ffffff', 10, 3);
      burst(shrine.cx + 0.5, shrine.cy + 0.5, 60, shrine.color, 14, 3);
      if (shrine.id === 'thanks') chest.open = Math.max(chest.open, 0.001);
      openLore(shrine);
    }
  }

  const isIntact = r => r.id === 'thanks' ? chest.open === 0 : !r.broken;

  function shrineInReach() {
    return rooms.find(r => isIntact(r) && Math.hypot(player.x - (r.cx + 0.5), player.y - (r.cy + 0.5)) < 1.75);
  }

  function hitFoe(e, nx, ny) {
    e.hp--;
    e.flash = 0.14;
    e.kx = nx * 6; e.ky = ny * 6;
    shake = Math.max(shake, 0.08);
    burst(e.x, e.y, 26, '#ffffff', 6, 2.5);
    if (e.hp <= 0) {
      kills++;
      burst(e.x, e.y, 20, rgb(rooms[e.home].rgb), 18, 3.5);
      burst(e.x, e.y, 20, '#9be35a', 8, 2.5);
      floaters.push({ x: e.x, y: e.y, z: 70, text: `${e.name} squashed!`, color: '#9be35a', life: 1.4, max: 1.4 });
      enemies = enemies.filter(o => o !== e);
      rooms[e.home].respawn = 35;
    }
  }

  function hurtPlayer(fromX, fromY) {
    if (player.inv > 0 || player.dead) return;
    const dx = player.x - fromX, dy = player.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    player.hp--;
    player.inv = 1.1;
    player.kx = dx / d * 7; player.ky = dy / d * 7;
    shake = 0.3;
    // Resume any auto-walk once the knockback settles
    if (path) { path = null; repath = 0.35; }
    burst(player.x, player.y, 30, '#ff4d6d', 10, 2.5);
    floaters.push({ x: player.x, y: player.y, z: 80, text: '-1', color: '#ff4d6d', life: 0.9, max: 0.9 });
    if (player.hp <= 0) player.dead = 2.6;
  }

  function respawn() {
    const r = rooms[0];
    player.x = r.x + 1.5; player.y = r.y + r.h - 1.5;
    player.hp = MAX_HP; player.inv = 1.5; player.kx = player.ky = 0;
    path = null;
    repath = 0;
    strikeOnArrive = null;
    enemies.forEach(e => { e.hp = e.maxHp; });
  }

  // ---------- Particles ----------

  function burst(x, y, z, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed;
      particles.push({
        x, y, z, vx: Math.cos(a) * s * 0.4, vy: Math.sin(a) * s * 0.4,
        vz: 40 + Math.random() * 90, g: 260, life: 0.5 + Math.random() * 0.4, max: 0.9,
        color, size: 2 + Math.random() * 2.5
      });
    }
  }

  function ambient(dt) {
    // Dust motes drifting in the torchlight
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 6;
      particles.push({
        x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d, z: Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, vz: 6 + Math.random() * 8,
        g: 0, life: 3 + Math.random() * 3, max: 6, color: '#d8cfb8', size: 1.5
      });
    }
    torches.forEach(t => {
      if (explored[idx(t.wx, t.wy)] && Math.random() < dt * 5) {
        const tx = t.face === 'y' ? t.x : t.x + 0.05, ty = t.face === 'y' ? t.y + 0.05 : t.y;
        particles.push({
          x: tx + (Math.random() - 0.5) * 0.1, y: ty, z: WALL_H * 0.62 + 14,
          vx: (Math.random() - 0.5) * 0.2, vy: 0, vz: 30 + Math.random() * 30,
          g: -10, life: 0.6 + Math.random() * 0.5, max: 1.1, color: '#ffb347', size: 2
        });
      }
    });
  }

  // ---------- Lore panel & codex ----------

  function openLore(r) {
    r.read = true;
    let body = r.info;
    if (r.id === 'thanks') {
      const read = rooms.filter(o => o.read && o.id !== 'thanks').length;
      body += `<br><br><b>Your run:</b> ${read}/${rooms.length - 1} shrines read · ${kills} bug${kills === 1 ? '' : 's'} squashed.`;
    }
    overlay.style.setProperty('--accent', r.color);
    overlayTitle.textContent = r.label;
    overlaySub.textContent = r.subtitle;
    overlayBody.innerHTML = body;
    overlayBody.scrollTop = 0;
    overlay.hidden = false;
    paused = r;
    Object.keys(keys).forEach(k => { keys[k] = false; });
    renderCodex();
    overlayClose.focus({ preventScroll: true });
  }

  function closeLore() {
    const r = paused;
    if (!r) return;
    overlay.hidden = true;
    paused = null;
    if (r.id !== 'thanks' && !r.broken) breakShrine(r);
    canvas.focus({ preventScroll: true });
  }

  function breakShrine(r) {
    r.broken = true;
    tiles[idx(r.cx, r.cy)] = FLOOR;
    r.rubble = Array.from({ length: 6 }, () => ({
      x: r.cx + 0.5 + (Math.random() - 0.5) * 0.9,
      y: r.cy + 0.5 + (Math.random() - 0.5) * 0.9,
      s: 0.06 + Math.random() * 0.08,
      h: 6 + Math.random() * 10
    }));
    shake = 0.4;
    burst(r.cx + 0.5, r.cy + 0.5, 30, '#6b6682', 30, 4);
    burst(r.cx + 0.5, r.cy + 0.5, 66, r.color, 40, 4.5);
    floaters.push({ x: r.cx + 0.5, y: r.cy + 0.5, z: 90, text: 'Chapter unlocked!', color: r.color, life: 1.8, max: 1.8 });
  }

  function renderCodex() {
    codexList.innerHTML = '';
    rooms.forEach(r => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'codex-item' + (r.read ? ' read' : '');
      btn.style.setProperty('--accent', r.color);
      btn.innerHTML = `<span class="codex-gem"></span><span class="codex-name">${r.label}</span>` +
        `<span class="codex-state">${r.read ? 'read' : r.visited ? 'found' : '???'}</span>`;
      btn.title = r.read ? `Read ${r.label} again` : `Walk to ${r.subtitle}`;
      btn.addEventListener('click', () => {
        if (paused || player.dead) return;
        if (!isIntact(r)) { openLore(r); return; }
        walkTo(r.cx, r.cy, false);
        strikeOnArrive = r;
        canvas.focus({ preventScroll: true });
      });
      li.appendChild(btn);
      codexList.appendChild(li);
    });
  }

  // ---------- Update ----------

  const held = (...ks) => ks.some(k => keys[k]);

  function update(dt) {
    time += dt;
    player.atkCd -= dt; player.swing -= dt; player.inv -= dt;
    shake = Math.max(0, shake - dt);

    if (player.dead > 0) {
      player.dead -= dt;
      if (player.dead <= 0) { player.dead = 0; respawn(); }
    } else {
      if (repath > 0 && (repath -= dt) <= 0 && pathGoal) walkTo(pathGoal.x, pathGoal.y, pathGoal.exact);
      updatePlayer(dt);
    }

    // Reveal what's around the player, and whole rooms on entry
    const px = Math.floor(player.x), py = Math.floor(player.y);
    for (let y = py - 3; y <= py + 3; y++) {
      for (let x = px - 3; x <= px + 3; x++) {
        if (inBounds(x, y) && Math.hypot(x - px, y - py) <= 3.2) explored[idx(x, y)] = 1;
      }
    }
    const here = inBounds(px, py) ? roomAt[idx(px, py)] : -1;
    if (here !== currentRoom) {
      currentRoom = here;
      if (here >= 0) {
        const r = rooms[here];
        for (let y = r.y - 1; y <= r.y + r.h; y++) {
          for (let x = r.x - 1; x <= r.x + r.w; x++) if (inBounds(x, y)) explored[idx(x, y)] = 1;
        }
        if (!r.visited) {
          r.visited = true;
          banner = { title: r.subtitle, sub: r.label, color: r.color, life: 3 };
          renderCodex();
        }
      }
    }

    // Auto-walks from the codex finish with a strike
    if (strikeOnArrive && !path && repath <= 0 && !player.dead) {
      if (shrineInReach() === strikeOnArrive) attack();
      strikeOnArrive = null;
    }
    if (chest && chest.open > 0 && chest.open < 1) {
      chest.open = Math.min(1, chest.open + dt * 2.5);
      if (Math.random() < 0.6) burst(chest.x, chest.y, 30, '#ffd166', 1, 2);
    }

    updateEnemies(dt);

    // Restock rooms the player isn't standing in
    rooms.forEach(r => {
      if (r.respawn > 0) {
        r.respawn -= dt;
        if (r.respawn <= 0 && currentRoom !== r.n) {
          const alive = enemies.filter(e => e.home === r.n).map(e => e.name);
          const missing = r.foes.find(n => !alive.includes(n));
          if (missing) {
            enemies.push(makeFoe(r, missing));
            if (alive.length + 1 < r.foes.length) r.respawn = 20;
          }
        } else if (r.respawn <= 0) {
          r.respawn = 5;
        }
      }
    });

    ambient(dt);
    particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= p.g * dt; p.z = Math.max(0, p.z + p.vz * dt);
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
    floaters.forEach(f => { f.life -= dt; f.z += dt * 30; });
    floaters = floaters.filter(f => f.life > 0);
    if (banner && (banner.life -= dt) <= 0) banner = null;

    // Camera eases toward the player
    const tx = (player.x - player.y) * TW / 2, ty = (player.x + player.y) * TH / 2;
    const k = 1 - Math.exp(-dt * 6);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  function updatePlayer(dt) {
    let ix = 0, iy = 0;
    if (held('w', 'arrowup')) { ix -= 1; iy -= 1; }
    if (held('s', 'arrowdown')) { ix += 1; iy += 1; }
    if (held('a', 'arrowleft')) { ix -= 1; iy += 1; }
    if (held('d', 'arrowright')) { ix += 1; iy -= 1; }

    if (ix || iy) {
      path = null;
      repath = 0;
      strikeOnArrive = null;
    } else if (path) {
      const t = path[0];
      const dx = t.x - player.x, dy = t.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.12) {
        path.shift();
        if (!path.length) path = null;
      } else {
        ix = dx; iy = dy;
      }
    }

    const len = Math.hypot(ix, iy);
    player.moving = len > 0;
    if (player.moving) {
      ix /= len; iy /= len;
      player.fx = ix; player.fy = iy;
      const sx = ix - iy;
      if (Math.abs(sx) > 0.01) player.faceRight = sx > 0;
      player.anim += dt * 9;
    }
    const decay = Math.exp(-dt * 10);
    player.kx *= decay; player.ky *= decay;
    move(player, (ix * PLAYER_SPEED + player.kx) * dt, (iy * PLAYER_SPEED + player.ky) * dt);
  }

  function updateEnemies(dt) {
    enemies.forEach(e => {
      e.flash -= dt;
      e.rest -= dt;
      e.anim += dt * 4;
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const aggro = !player.dead && (d < 2.5 || (d < 7 && currentRoom === e.home));
      let mx = 0, my = 0, speed = e.speed;

      if (aggro && e.rest > 0) {
        // Back off for a moment after landing a hit
        mx = -dx / d; my = -dy / d;
        speed = 1.2;
      } else if (aggro) {
        if (d > 0.45) { mx = dx / d; my = dy / d; }
        speed = 1.6;
      } else {
        e.wait -= dt;
        if (!e.goal || e.wait <= 0 || Math.hypot(e.goal.x - e.x, e.goal.y - e.y) < 0.15) {
          if (e.wait <= 0) { e.goal = randomRoomSpot(rooms[e.home]); e.wait = 2 + rand() * 3; }
        }
        if (e.goal) {
          const gx = e.goal.x - e.x, gy = e.goal.y - e.y, gd = Math.hypot(gx, gy);
          if (gd > 0.15) { mx = gx / gd; my = gy / gd; }
        }
      }

      // Keep foes from stacking on top of each other
      enemies.forEach(o => {
        if (o === e) return;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
        if (od < 0.55 && od > 0.001) { mx += ox / od * 0.8; my += oy / od * 0.8; }
      });

      const decay = Math.exp(-dt * 8);
      e.kx *= decay; e.ky *= decay;
      if (e.flash > 0) { mx = 0; my = 0; }
      move(e, (mx * speed + e.kx) * dt, (my * speed + e.ky) * dt);
      if (Math.abs(mx - my) > 0.05) e.faceRight = mx - my > 0;

      if (d < 0.6 && e.flash <= 0 && e.rest <= 0 && player.inv <= 0 && !player.dead) {
        hurtPlayer(e.x, e.y);
        e.rest = 1.4;
      }
    });
  }

  // ---------- Rendering ----------

  function iso(x, y, z = 0) {
    return [(x - y) * TW / 2 - cam.x + W / 2, (x + y) * TH / 2 - z - cam.y + H / 2];
  }

  function poly(pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // An axis-aligned box centred on (x, y) with half-size s and pixel height h
  function drawBlock(x, y, s, h, colors, opts = {}) {
    const n = iso(x - s, y - s), e = iso(x + s, y - s), so = iso(x + s, y + s), w = iso(x - s, y + s);
    const up = p => [p[0], p[1] - h];
    if (!opts.skipLeft) poly([w, so, up(so), up(w)], colors.left);
    if (!opts.skipRight) poly([so, e, up(e), up(so)], colors.right);
    poly([up(n), up(e), up(so), up(w)], colors.top);
    return { n, e, so, w, up };
  }

  function drawFloors() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = idx(x, y);
        const t = tiles[i];
        if ((t !== FLOOR && t !== PROP) || !explored[i]) continue;
        const [sx, sy] = iso(x, y);
        if (sx < -TW || sx > W + TW || sy < -TH || sy > H + TH) continue;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + TW / 2, sy + TH / 2);
        ctx.lineTo(sx, sy + TH);
        ctx.lineTo(sx - TW / 2, sy + TH / 2);
        ctx.closePath();
        ctx.fillStyle = floorColor[i];
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Bevel highlight and the odd crack
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(sx - TW / 2 + 2, sy + TH / 2);
        ctx.lineTo(sx, sy + 1);
        ctx.lineTo(sx + TW / 2 - 2, sy + TH / 2);
        ctx.stroke();
        if (noise[i] > 0.86) {
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.moveTo(sx - 10, sy + 12);
          ctx.lineTo(sx - 2, sy + 16);
          ctx.lineTo(sx + 2, sy + 13);
          ctx.lineTo(sx + 11, sy + 19);
          ctx.stroke();
        }
      }
    }

    // Glowing rune circles beneath each shrine
    rooms.forEach(r => {
      if (!explored[idx(r.cx, r.cy)] || r.broken) return;
      const [sx, sy] = iso(r.cx + 0.5, r.cy + 0.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.5);
      ctx.strokeStyle = rgb(r.rgb, r.read ? 0.45 : 0.25 + 0.15 * Math.sin(time * 3));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -time * 20;
      ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawWall(i, j, alpha) {
    const r = rooms[tintAt[idx(i, j)]];
    const base = r ? mix([58, 54, 72], r.rgb, 0.1) : [58, 54, 72];
    ctx.globalAlpha = alpha;
    const b = drawBlock(i + 0.5, j + 0.5, 0.5, WALL_H, {
      top: rgb(shadeOf(base, 1.15)), left: rgb(shadeOf(base, 0.72)), right: rgb(shadeOf(base, 0.52))
    }, { skipLeft: tileAt(i, j + 1) === WALL, skipRight: tileAt(i + 1, j) === WALL });

    // Brick courses
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 3; k++) {
      const h = WALL_H * k / 3;
      ctx.moveTo(b.w[0], b.w[1] - h); ctx.lineTo(b.so[0], b.so[1] - h); ctx.lineTo(b.e[0], b.e[1] - h);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(b.w[0], b.w[1] - WALL_H); ctx.lineTo(b.so[0], b.so[1] - WALL_H); ctx.lineTo(b.e[0], b.e[1] - WALL_H);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawTorch(t) {
    const [sx, sy] = iso(t.x, t.y, WALL_H * 0.62);
    const flick = Math.sin(time * 14 + t.seed) * 1.5 + Math.sin(time * 23 + t.seed * 2);
    ctx.fillStyle = '#3b2a1c';
    ctx.fillRect(sx - 2, sy - 2, 4, 12);
    ctx.fillStyle = '#ff7b1c';
    ctx.beginPath(); ctx.ellipse(sx, sy - 6, 5, 9 + flick, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.ellipse(sx, sy - 4, 2.5, 5 + flick * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawShadow(x, y, rx) {
    const [sx, sy] = iso(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawSprite(sheet, frame, fw, fh, scale, x, y, flip, flash) {
    if (!sheet.complete || !sheet.naturalWidth) return;
    const [sx, sy] = iso(x, y);
    const w = fw * scale, h = fh * scale;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    if (flip) ctx.scale(-1, 1);
    if (flash) ctx.filter = 'brightness(3.5)';
    ctx.drawImage(sheet, frame * fw, 0, fw, fh, -w / 2, -h + 4, w, h);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.dead) return;
    if (player.inv > 0 && Math.floor(player.inv * 12) % 2) return;
    drawShadow(player.x, player.y, 15);
    const frame = player.moving ? Math.floor(player.anim) % 3 : 3;
    drawSprite(heroSheet, frame, 13, 22, 2.7, player.x, player.y, !player.faceRight, false);

    if (player.swing > 0) {
      const [sx, sy] = iso(player.x, player.y, 26);
      const ang = Math.atan2((player.fx + player.fy) * TH / 2, (player.fx - player.fy) * TW / 2);
      const p = 1 - player.swing / 0.2;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.6);
      ctx.strokeStyle = `rgba(255,248,220,${0.9 * (1 - p)})`;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 52, ang - 1.1 + p * 0.6, ang + 0.2 + p * 0.9);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFoe(e) {
    drawShadow(e.x, e.y, 14);
    const bob = Math.abs(Math.sin(e.anim * 2)) * 3;
    const frame = Math.floor(e.anim) % 2;
    ctx.save();
    ctx.translate(0, -bob);
    drawSprite(foeSheet, frame, 13, 24, 2.4, e.x, e.y, e.faceRight, e.flash > 0);
    ctx.restore();
  }

  function drawShrine(r) {
    const x = r.cx + 0.5, y = r.cy + 0.5;
    if (r.broken) {
      r.rubble.forEach(p => drawBlock(p.x, p.y, p.s, p.h, { top: '#5b5670', left: '#3d394d', right: '#2d2a3a' }));
      return;
    }
    drawShadow(x, y, 22);
    drawBlock(x, y, 0.3, 14, { top: '#5b5670', left: '#3d394d', right: '#2d2a3a' });
    drawBlock(x, y, 0.2, 34, { top: '#6b6682', left: '#48435b', right: '#363245' });
    const bob = Math.sin(time * 2 + r.n) * 5;
    const [sx, sy] = iso(x, y, 66 + bob);
    const spin = Math.cos(time * 1.6 + r.n);
    const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 34);
    g.addColorStop(0, rgb(r.rgb, 0.55));
    g.addColorStop(1, rgb(r.rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(sx - 34, sy - 34, 68, 68);
    const hw = 10 * Math.max(0.2, Math.abs(spin));
    poly([[sx, sy - 18], [sx + hw, sy], [sx, sy + 18], [sx - hw, sy]], rgb(shadeOf(r.rgb, spin > 0 ? 1.15 : 0.8)));
    poly([[sx, sy - 18], [sx + hw * 0.4, sy], [sx, sy + 18]], 'rgba(255,255,255,0.35)');
    if (!r.read && Math.random() < 0.08) burst(x, y, 66, r.color, 1, 1.5);
  }

  function drawChest() {
    const { x, y, open } = chest;
    drawShadow(x, y, 24);
    const wood = { top: '#8a5a2b', left: '#6b4220', right: '#523218' };
    const b = drawBlock(x, y, 0.34, open > 0 ? 20 : 28, wood);
    // Gold trim
    ctx.strokeStyle = '#e9b949';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.w[0], b.w[1] - 12); ctx.lineTo(b.so[0], b.so[1] - 12); ctx.lineTo(b.e[0], b.e[1] - 12);
    ctx.stroke();
    if (open > 0) {
      const g = ctx.createRadialGradient(b.so[0], b.so[1] - 30, 2, b.so[0], b.so[1] - 30, 60 * open);
      g.addColorStop(0, 'rgba(255,214,102,0.8)');
      g.addColorStop(1, 'rgba(255,214,102,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.so[0] - 60, b.so[1] - 90, 120, 120);
      const lift = 22 * open;
      const up = p => [p[0], p[1] - 20 - lift];
      poly([b.up(b.n), b.up(b.e), up(b.e), up(b.n)], '#9c6a35');
    } else {
      ctx.fillStyle = '#e9b949';
      ctx.fillRect(b.so[0] - 3, b.so[1] - 22, 6, 7);
    }
  }

  function drawProp(p) {
    if (p.kind === 'crate') {
      const b = drawBlock(p.x, p.y, 0.3, 30, { top: '#7a5a36', left: '#5e4428', right: '#48331e' });
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.w[0], b.w[1]); ctx.lineTo(b.so[0], b.so[1] - 30);
      ctx.moveTo(b.so[0], b.so[1]); ctx.lineTo(b.e[0], b.e[1] - 30);
      ctx.stroke();
    } else {
      const [sx, sy] = iso(p.x, p.y);
      drawShadow(p.x, p.y, 18);
      ctx.fillStyle = '#5e3d22';
      ctx.fillRect(sx - 15, sy - 34, 30, 34);
      ctx.beginPath(); ctx.ellipse(sx, sy, 15, 7, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(sx - 15, sy - 28, 30, 3);
      ctx.fillRect(sx - 15, sy - 10, 30, 3);
      ctx.fillStyle = '#7b5530';
      ctx.beginPath(); ctx.ellipse(sx, sy - 34, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a3a44';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawWorld() {
    const pDepth = player.x + player.y;
    const pDiag = player.x - player.y;
    const list = [];

    for (let j = 0; j < MAP_H; j++) {
      for (let i = 0; i < MAP_W; i++) {
        const k = idx(i, j);
        if (tiles[k] !== WALL || !explored[k]) continue;
        const [sx, sy] = iso(i, j);
        if (sx < -TW || sx > W + TW || sy < -TH || sy > H + TH + WALL_H) continue;
        const depth = i + j + 1;
        // Fade walls standing between the camera and the player
        const front = depth > pDepth && depth - pDepth < 3.2 && Math.abs(i - j - pDiag) < 1.6;
        list.push({ d: depth, draw: () => drawWall(i, j, front ? 0.3 : 1) });
      }
    }
    torches.forEach(t => {
      if (explored[idx(t.wx, t.wy)]) list.push({ d: t.wx + t.wy + 1.01, draw: () => drawTorch(t) });
    });
    props.forEach(p => {
      if (explored[idx(Math.floor(p.x), Math.floor(p.y))]) list.push({ d: p.x + p.y, draw: () => drawProp(p) });
    });
    rooms.forEach(r => {
      if (!explored[idx(r.cx, r.cy)]) return;
      if (r.id === 'thanks') list.push({ d: chest.x + chest.y, draw: drawChest });
      else if (r.broken) list.push({ d: r.cx + r.cy, draw: () => drawShrine(r) });
      else list.push({ d: r.cx + r.cy + 1, draw: () => drawShrine(r) });
    });
    enemies.forEach(e => {
      if (explored[idx(Math.floor(e.x), Math.floor(e.y))]) list.push({ d: e.x + e.y, draw: () => drawFoe(e) });
    });
    list.push({ d: pDepth, draw: drawPlayer });

    list.sort((a, b) => a.d - b.d).forEach(o => o.draw());

    particles.forEach(p => {
      const [sx, sy] = iso(p.x, p.y, p.z);
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function light(c, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawLighting() {
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, W, H);
    fctx.fillStyle = 'rgba(4,3,10,0.76)';
    fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = 'destination-out';

    const [px, py] = iso(player.x, player.y, 30);
    light(fctx, px, py, 320 + Math.sin(time * 9) * 6, 1);
    torches.forEach(t => {
      if (!explored[idx(t.wx, t.wy)]) return;
      const [sx, sy] = iso(t.x, t.y, WALL_H * 0.5);
      light(fctx, sx, sy, 170 + Math.sin(time * 13 + t.seed) * 8, 0.85);
    });
    rooms.forEach(r => {
      if (!explored[idx(r.cx, r.cy)]) return;
      const [sx, sy] = iso(r.cx + 0.5, r.cy + 0.5, 40);
      light(fctx, sx, sy, r.broken ? 90 : 150, r.broken ? 0.4 : 0.75);
    });
    ctx.drawImage(fog, 0, 0, W, H);

    // Warm additive glow
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, c) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    torches.forEach(t => {
      if (!explored[idx(t.wx, t.wy)]) return;
      const [sx, sy] = iso(t.x, t.y, WALL_H * 0.62);
      glow(sx, sy, 90 + Math.sin(time * 11 + t.seed) * 6, 'rgba(255,140,40,0.16)');
    });
    rooms.forEach(r => {
      if (!explored[idx(r.cx, r.cy)]) return;
      const [sx, sy] = iso(r.cx + 0.5, r.cy + 0.5, 50);
      glow(sx, sy, 120, rgb(r.rgb, 0.12));
    });
    ctx.globalCompositeOperation = 'source-over';

    // Vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function text(str, x, y, size, color, align = 'center') {
    ctx.font = `${size}px 'Silkscreen', monospace`;
    ctx.textAlign = align;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawLabels() {
    rooms.forEach(r => {
      if (!explored[idx(r.cx, r.cy)]) return;
      const [sx, sy] = iso(r.cx + 0.5, r.cy + 0.5, 110 + Math.sin(time * 2 + r.n) * 3);
      text(r.label.toUpperCase(), sx, sy, 15, r.color);
    });
    const near = !player.dead && !paused && shrineInReach();
    if (near) {
      const [sx, sy] = iso(near.cx + 0.5, near.cy + 0.5, 135);
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 6);
      text(near.id === 'thanks' ? 'SPACE - OPEN THE CHEST' : 'SPACE - STRIKE THE SHRINE', sx, sy, 12, '#ffffff');
      ctx.globalAlpha = 1;
    }
    enemies.forEach(e => {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d > 4.5 || !explored[idx(Math.floor(e.x), Math.floor(e.y))]) return;
      const [sx, sy] = iso(e.x, e.y, 70);
      ctx.globalAlpha = Math.min(1, (4.5 - d) * 1.5);
      text(e.name, sx, sy - 6, 11, '#f2e6d0');
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx - 18, sy, 36, 5);
      ctx.fillStyle = '#e2384d';
      ctx.fillRect(sx - 17, sy + 1, 34 * e.hp / e.maxHp, 3);
      ctx.globalAlpha = 1;
    });
    floaters.forEach(f => {
      const [sx, sy] = iso(f.x, f.y, f.z);
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      text(f.text, sx, sy, 13, f.color);
    });
    ctx.globalAlpha = 1;
  }

  const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  function drawHeart(x, y, full) {
    const s = 3;
    HEART.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c !== 'X') return;
        ctx.fillStyle = full ? (ry === 1 && rx === 1 ? '#ff9aa8' : '#e2384d') : '#3b2430';
        ctx.fillRect(x + rx * s, y + ry * s, s, s);
      });
    });
  }

  function drawMinimap() {
    const s = 4, mw = MAP_W * s, mh = MAP_H * s;
    const ox = W - mw - 16, oy = 16;
    ctx.fillStyle = 'rgba(8,7,14,0.72)';
    ctx.fillRect(ox - 6, oy - 6, mw + 12, mh + 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(ox - 6.5, oy - 6.5, mw + 13, mh + 13);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = idx(x, y);
        if (!explored[i]) continue;
        const t = tiles[i];
        if (t === WALL) ctx.fillStyle = '#4a4560';
        else if (roomAt[i] >= 0) ctx.fillStyle = rgb(rooms[roomAt[i]].rgb, 0.45);
        else ctx.fillStyle = '#2e2b3c';
        ctx.fillRect(ox + x * s, oy + y * s, s, s);
      }
    }
    rooms.forEach(r => {
      if (!explored[idx(r.cx, r.cy)]) return;
      ctx.fillStyle = r.read ? r.color : '#ffffff';
      ctx.fillRect(ox + r.cx * s - 1, oy + r.cy * s - 1, s + 2, s + 2);
    });
    if (Math.floor(time * 3) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox + player.x * s, oy + player.y * s, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHud() {
    for (let i = 0; i < MAX_HP; i++) drawHeart(18 + i * 26, 18, i < player.hp);
    const read = rooms.filter(r => r.read && r.id !== 'thanks').length;
    text(`LORE ${read}/${rooms.length - 1}`, 18, 58, 14, '#f2e6d0', 'left');
    text(`BUGS SQUASHED ${kills}`, 18, 78, 14, '#9be35a', 'left');
    drawMinimap();

    if (banner) {
      const a = Math.min(1, banner.life, (3 - banner.life) * 3);
      ctx.globalAlpha = Math.max(0, a);
      text(banner.title.toUpperCase(), W / 2, H * 0.2, 26, banner.color);
      text(`- ${banner.sub} -`, W / 2, H * 0.2 + 28, 13, '#f2e6d0');
      ctx.globalAlpha = 1;
    }

    if (time < 9 && !player.dead) {
      ctx.globalAlpha = Math.min(1, 9 - time);
      text('WASD / ARROWS TO MOVE  -  SPACE TO ATTACK  -  CLICK TO WALK', W / 2, H - 24, 13, '#d8cfb8');
      ctx.globalAlpha = 1;
    }

    if (player.dead) {
      const a = Math.min(1, (2.6 - player.dead) * 1.5);
      ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a;
      text('YOU DIED', W / 2, H / 2, 54, '#b3122e');
      text('Respawning at the Entrance Hall...', W / 2, H / 2 + 36, 14, '#d8cfb8');
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 30, (Math.random() - 0.5) * shake * 30);
    drawFloors();
    drawWorld();
    drawLighting();
    drawLabels();
    ctx.restore();
    drawHud();
  }

  // ---------- Loop & input ----------

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = fog.width = Math.round(W * dpr);
    canvas.height = fog.height = Math.round(H * dpr);
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    if (W > 0) {
      if (!paused) update(dt);
      render();
    }
    requestAnimationFrame(frame);
  }

  const GAME_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'j'];
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  document.addEventListener('keydown', e => {
    if (typing(e) || !canvas.clientWidth) return;
    const k = e.key.toLowerCase();
    if (paused) {
      if (['escape', 'enter', ' ', 'e'].includes(k)) {
        e.preventDefault();
        if (!e.repeat) closeLore();
      }
      return;
    }
    if (!GAME_KEYS.includes(k)) return;
    e.preventDefault();
    keys[k] = true;
    if ((k === ' ' || k === 'j') && !e.repeat) attack();
  });
  document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach(k => { keys[k] = false; }); });

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    if (player.dead || paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left + cam.x - W / 2;
    const my = e.clientY - rect.top + cam.y - H / 2;
    const a = mx / (TW / 2), b = my / (TH / 2);
    const wx = (a + b) / 2, wy = (b - a) / 2;

    // Clicking a nearby foe swings at it
    const foe = enemies.find(o => Math.hypot(o.x - wx, o.y - wy) < 0.9);
    if (foe && Math.hypot(foe.x - player.x, foe.y - player.y) < 1.7) { attack(); return; }

    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (!inBounds(tx, ty) || !explored[idx(tx, ty)]) return;
    const t = tiles[idx(tx, ty)];
    const shrine = rooms.find(r => r.cx === tx && r.cy === ty && isIntact(r));
    if (shrine) {
      if (shrineInReach() === shrine) attack();
      else { walkTo(tx, ty, false); strikeOnArrive = shrine; }
    } else if (t === FLOOR) walkTo(tx, ty, true);
    else if (t === PROP) walkTo(tx, ty, false);
  });

  overlayClose.addEventListener('click', closeLore);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closeLore(); });

  // Phones, tablets and touch screens get the text version instead (see style.css)
  const textOnly = window.matchMedia('(max-width: 1032px), (hover: none) and (pointer: coarse)');
  let started = false;
  function start() {
    if (started || textOnly.matches) return;
    started = true;
    fetch('rooms.json')
      .then(r => r.json())
      .then(data => {
        buildDungeon(data);
        renderCodex();
        resize();
        requestAnimationFrame(frame);
      });
  }
  textOnly.addEventListener('change', start);
  start();
})();
