// TechJourney: an isometric dungeon crawl through my career.
// Each room of the story map holds a shrine with one chapter; bugs roam the halls.
// The chest at the end holds a key to the Endless Depths: procedurally generated
// floors with nastier bugs, and Wings, a bat with opinions.
// Progress is kept in localStorage so it survives a page reload.
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
  const settings = document.getElementById('codexSettings');
  const wingsToggle = document.getElementById('wingsToggle');
  const resetButton = document.getElementById('resetSave');
  const teleportButton = document.getElementById('teleportEnd');
  const replayButton = document.getElementById('replayStory');
  const newsCard = document.getElementById('newsCard');
  const wardrobe = document.getElementById('wardrobe');
  const wardrobeButton = document.getElementById('wardrobeOpen');
  const wingsLog = document.getElementById('wingsLog');
  const fog = document.createElement('canvas');
  const fctx = fog.getContext('2d');

  const loadImage = src => { const i = new Image(); i.src = src; return i; };
  const heroSheet = loadImage('./img/player.png'); // 4 frames of 13x22, facing right
  // The hero as actually drawn: player.png recoloured to the chosen look, with room above for hats
  const heroCanvas = document.createElement('canvas');
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

  // Seeded RNG: the story map looks the same on every visit, endless floors
  // are reproducible per run and depth
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rand = mulberry32(1337);
  const pick = (list, r = Math.random) => list[Math.floor(r() * list.length)];

  // Colour helpers
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const shadeOf = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

  // ---------- Save data (localStorage) ----------

  const SAVE_KEY = 'sth0nian.techjourney.v1';
  const NEWS_KEY = 'sth0nian.wings.news.v2';

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; }
  }
  function storeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
  }

  const save = Object.assign({
    look: null,
    read: [], broken: [], chest: false, key: false, kills: 0, explored: '',
    best: 0, runs: 0, deepKills: 0, wingsMuted: false
  }, loadJSON(SAVE_KEY));
  const persist = () => storeJSON(SAVE_KEY, save);

  // ---------- The hero's look (unlocked with the key) ----------

  const HEAD_ROOM = 6;
  const HERO_W = 13, HERO_H = 22 + HEAD_ROOM;
  const HEAD_DROP = [0, 1, 0, 1]; // frames 1 and 3 sit a pixel lower

  // Each option recolours a pair of the sprite's palette entries: [main, shade]
  const LOOKS = {
    hair: {
      label: 'Hair', original: ['6a4834', '432e27'], options: [
        { id: 'brown', name: 'Brown', c: ['#6a4834', '#432e27'] },
        { id: 'black', name: 'Black', c: ['#2b2b33', '#141418'] },
        { id: 'blonde', name: 'Blonde', c: ['#e3c16f', '#a8843f'] },
        { id: 'ginger', name: 'Ginger', c: ['#c8642c', '#8a3f17'] },
        { id: 'grey', name: 'Grey', c: ['#b8b8c0', '#7c7c88'] },
        { id: 'blue', name: 'Blue', c: ['#4f7fe0', '#2c4f9e'] },
        { id: 'pink', name: 'Pink', c: ['#e57ab4', '#a3477c'] }
      ]
    },
    skin: {
      label: 'Skin', original: ['e8d4b2', 'bfa787'], options: [
        { id: 's1', name: 'Light', c: ['#e8d4b2', '#bfa787'] },
        { id: 's2', name: 'Fair', c: ['#f1c9a5', '#c99a76'] },
        { id: 's3', name: 'Medium', c: ['#d9a679', '#a87a52'] },
        { id: 's4', name: 'Tan', c: ['#b5784e', '#8a5634'] },
        { id: 's5', name: 'Brown', c: ['#8d5a3b', '#663f27'] },
        { id: 's6', name: 'Dark', c: ['#5c3a28', '#3f2619'] }
      ]
    },
    shirt: {
      label: 'Shirt', original: ['c43c3c', '882e2e'], options: [
        { id: 'red', name: 'Red', c: ['#c43c3c', '#882e2e'] },
        { id: 'green', name: 'Green', c: ['#3fb860', '#257a3c'] },
        { id: 'blue', name: 'Blue', c: ['#3f78c4', '#294f88'] },
        { id: 'purple', name: 'Purple', c: ['#8a55d4', '#5c3591'] },
        { id: 'orange', name: 'Orange', c: ['#e8822c', '#a8561a'] },
        { id: 'white', name: 'White', c: ['#e9e9ee', '#a9a9b6'] },
        { id: 'black', name: 'Black', c: ['#3a3a44', '#22222a'] }
      ]
    },
    pants: {
      label: 'Trousers', original: ['65659b', '5586b9'], options: [
        { id: 'indigo', name: 'Indigo', c: ['#65659b', '#5586b9'] },
        { id: 'denim', name: 'Denim', c: ['#3e5f8f', '#5b82b8'] },
        { id: 'black', name: 'Black', c: ['#2e2e36', '#4a4a56'] },
        { id: 'khaki', name: 'Khaki', c: ['#a08a5c', '#c2ab79'] },
        { id: 'grey', name: 'Grey', c: ['#76767f', '#9a9aa4'] }
      ]
    }
  };

  // Hats in sprite coordinates of an upright frame: rows may start above the head (negative)
  const HATS = [
    { id: 'none', name: 'None' },
    { id: 'cap', name: 'Cap', top: -1, rows: ['....CCCCC....', '...CXXXXXC...', '..CXXXXXXXC..', '..CCCCCCCCCCC'], colors: { X: '#3f78c4' } },
    { id: 'beanie', name: 'Beanie', top: -2, rows: ['.....CCC.....', '...CXXXXXC...', '..CXXXXXXXC..', '..CRRRRRRRRC.'], colors: { X: '#c43c3c', R: '#e9e9ee' } },
    { id: 'headphones', name: 'Headphones', top: 0, rows: ['....CCCCCC...', '...C.........', '...C.........', '...C.........', '...C.........', '..CXXC.......', '..CXXC.......', '..CXXC.......', '...CC........'], colors: { X: '#ff4d6d' } },
    { id: 'crown', name: 'Crown', top: -2, rows: ['....Y.Y.Y.Y..', '....YYYYYYY..', '....OROOOOO..'], colors: { Y: '#ffd166', O: '#c9971f', R: '#e2384d' } },
    { id: 'wizard', name: 'Wizard', top: -5, rows: ['........P....', '.......PP....', '......PPP....', '.....PPSPP...', '....PPPPPP...', '...PPPPPPPP..', '..LLLLLLLLLL.'], colors: { P: '#6a3fb5', S: '#ffd166', L: '#4a2a80' } }
  ];

  const DEFAULT_LOOK = { hair: 'brown', skin: 's1', shirt: 'red', pants: 'indigo', hat: 'none' };
  const look = () => ({ ...DEFAULT_LOOK, ...(save.look || {}) });
  const hexOf = (r, g, b) => [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

  // Recolour player.png to the current look and draw the hat on every frame
  function buildHero(target = heroCanvas, l = look()) {
    if (!heroSheet.complete || !heroSheet.naturalWidth) return;
    target.width = HERO_W * 4;
    target.height = HERO_H;
    const c = target.getContext('2d');
    c.clearRect(0, 0, target.width, target.height);
    c.drawImage(heroSheet, 0, HEAD_ROOM);
    const img = c.getImageData(0, 0, target.width, target.height);
    const map = {};
    Object.entries(LOOKS).forEach(([key, group]) => {
      const opt = group.options.find(o => o.id === l[key]) || group.options[0];
      group.original.forEach((hex, i) => { map[hex] = hexToRgb(opt.c[i]); });
    });
    for (let i = 0; i < img.data.length; i += 4) {
      if (!img.data[i + 3]) continue;
      const hex = hexOf(img.data[i], img.data[i + 1], img.data[i + 2]);
      const to = map[hex];
      if (!to) continue;
      // The darkest brown is hair on the head but boots and belt below it
      const px = (i / 4) % target.width, py = Math.floor(i / 4 / target.width);
      if (hex === '432e27' && py - HEAD_ROOM >= 13 + HEAD_DROP[Math.floor(px / HERO_W)]) continue;
      img.data[i] = to[0]; img.data[i + 1] = to[1]; img.data[i + 2] = to[2];
    }
    c.putImageData(img, 0, 0);

    const hat = HATS.find(h => h.id === l.hat);
    if (hat && hat.rows) {
      for (let f = 0; f < 4; f++) {
        hat.rows.forEach((row, r) => {
          [...row].forEach((ch, col) => {
            if (ch === '.') return;
            c.fillStyle = ch === 'C' ? '#171717' : hat.colors[ch];
            c.fillRect(f * HERO_W + col, HEAD_ROOM + hat.top + r + HEAD_DROP[f] + 1, 1, 1);
          });
        });
      }
    }
  }
  heroSheet.addEventListener('load', () => buildHero());

  // ---------- World state ----------

  const tiles = new Uint8Array(MAP_W * MAP_H);
  const roomAt = new Int8Array(MAP_W * MAP_H);
  const tintAt = new Int8Array(MAP_W * MAP_H);
  const explored = new Uint8Array(MAP_W * MAP_H);
  const floorColor = [];
  const noise = new Float32Array(MAP_W * MAP_H);
  const idx = (x, y) => y * MAP_W + x;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const tileAt = (x, y) => inBounds(x, y) ? tiles[idx(x, y)] : VOID;

  let storyData = [];
  let mode = 'story';
  let depth = 0;
  let runSeed = 1;
  let runKills = 0;
  // Floors already generated this run, kept as they were left (depth -> snapshot)
  const floors = new Map();
  let runActive = false;
  let exitCooldown = 0;
  const HEAP_LIMIT = 768 * 1024;
  let rooms = [];
  let props = [];
  let torches = [];
  let enemies = [];
  let projectiles = [];
  let pickups = [];
  let particles = [];
  let floaters = [];
  let chest = null;
  let portal = null;
  let stairsDown = null;
  let stairsUp = null;
  let bossAlive = false;

  const player = {
    x: 0, y: 0, r: 0.28, fx: 1, fy: 0, faceRight: true,
    hp: MAX_HP, inv: 0, atkCd: 0, swing: 0, kx: 0, ky: 0,
    moving: false, anim: 0, dead: 0
  };
  let path = null;
  let pathGoal = null;
  let repath = 0;
  let kills = save.kills;
  let paused = null;
  let wardrobeOpen = false;
  let wardrobeDue = 0;
  let strikeOnArrive = null;
  let currentRoom = -1;
  let banner = null;
  let shake = 0;
  let fade = 0;
  let time = 0;
  let lastInput = 0;
  let saveTimer = 0;
  let recentKills = [];
  const cam = { x: 0, y: 0 };
  const keys = {};
  let W = 0, H = 0, dpr = 1;

  // ---------- Map building blocks ----------

  function resetLevel() {
    tiles.fill(VOID);
    roomAt.fill(-1);
    tintAt.fill(-1);
    explored.fill(0);
    rooms = []; props = []; torches = []; enemies = []; projectiles = []; pickups = []; shots = [];
    particles = []; floaters = [];
    chest = null; portal = null; stairsDown = null; stairsUp = null; bossAlive = false;
    path = null; repath = 0; strikeOnArrive = null; currentRoom = -1;
  }

  function finishRoom(r, n) {
    return {
      ...r, n,
      rgb: hexToRgb(r.color),
      cx: r.x + Math.floor(r.w / 2),
      cy: r.y + Math.floor(r.h / 2),
      visited: false, respawn: 0
    };
  }

  const carve = (x, y) => { if (inBounds(x, y)) tiles[idx(x, y)] = FLOOR; };

  function carveRooms() {
    rooms.forEach(r => {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          carve(x, y);
          roomAt[idx(x, y)] = r.n;
        }
      }
    });
  }

  // Two-wide L-shaped corridor between two room centres
  function corridor(a, b) {
    for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx) + 1; x++) {
      carve(x, a.cy); carve(x, a.cy + 1);
    }
    for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy) + 1; y++) {
      carve(b.cx, y); carve(b.cx + 1, y);
    }
  }

  // Walls around every floor, then per-tile floor shading tinted by room colour
  function finishMap(stone) {
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
    for (let i = 0; i < tiles.length; i++) {
      noise[i] = rand();
      const r = rooms[roomAt[i]];
      const base = r ? mix(stone, r.rgb, 0.13) : shadeOf(stone, 0.85);
      floorColor[i] = rgb(shadeOf(base, 0.86 + noise[i] * 0.22));
    }
  }

  // Barrels and crates in some corners, torches on north and west walls
  function decorate(r) {
    const corners = [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]];
    corners.forEach(([x, y], k) => {
      if (k === 3 || rand() < 0.35) return;
      if (Math.abs(x - r.cx) <= 1 || Math.abs(y - r.cy) <= 1) return;
      if (tileAt(x, y) !== FLOOR) return;
      // Never block a doorway
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tileAt(x + dx, y + dy) === FLOOR && roomAt[idx(x + dx, y + dy)] !== r.n).length;
      if (open) return;
      tiles[idx(x, y)] = PROP;
      props.push({ x: x + 0.5, y: y + 0.5, kind: rand() < 0.5 ? 'barrel' : 'crate' });
    });

    [r.x + 1, r.x + r.w - 2].forEach(x => {
      if (tileAt(x, r.y - 1) === WALL) torches.push({ wx: x, wy: r.y - 1, face: 'y', x: x + 0.5, y: r.y, seed: rand() * 10 });
    });
    const ty = r.y + Math.floor(r.h / 2) - 2;
    if (tileAt(r.x - 1, ty) === WALL) torches.push({ wx: r.x - 1, wy: ty, face: 'x', x: r.x, y: ty + 0.5, seed: rand() * 10 });
  }

  function placePlayer(x, y) {
    player.x = x; player.y = y;
    player.kx = player.ky = 0;
    cam.x = (player.x - player.y) * TW / 2;
    cam.y = (player.x + player.y) * TH / 2;
  }

  // ---------- The story map ----------

  function buildStory() {
    resetLevel();
    mode = 'story';
    depth = 0;
    rand = mulberry32(1337);
    rooms = LAYOUT.map((r, n) => finishRoom({ ...r, ...storyData[n], kind: storyData[n].id === 'thanks' ? 'chest' : 'shrine' }, n));
    carveRooms();
    for (let n = 0; n < rooms.length - 1; n++) corridor(rooms[n], rooms[n + 1]);
    finishMap([44, 42, 56]);

    rooms.forEach(r => {
      tiles[idx(r.cx, r.cy)] = PROP;
      r.read = save.read.includes(r.id);
      if (r.kind === 'chest') {
        chest = { x: r.cx + 0.5, y: r.cy + 0.5, open: save.chest ? 1 : 0, room: r };
        portal = { x: r.x + 1.5, y: r.cy + 0.5 };
      } else if (save.broken.includes(r.id)) {
        breakShrine(r, true);
      }
      decorate(r);
    });

    rooms.forEach(r => r.foes.forEach(name => enemies.push(makeFoe('bug', r, { name }))));
    unpackExplored(save.explored);
    const start = rooms[0];
    placePlayer(start.x + 1.5, start.y + start.h - 1.5);
  }

  const portalOpen = () => mode === 'story' && save.key && portal;

  // ---------- The Endless Depths ----------

  const DEPTH_NAMES = [
    'The Deprecated Catacombs', 'The Legacy Archives', 'The Unmerged Branches', 'The Cold Storage',
    'The Callback Pit', 'The Technical Debt Vault', 'The Undocumented Wing', 'The Dependency Hell',
    'The Abandoned Microservices', 'The Monolith Cellar', 'The YAML Mines', 'The Null Abyss',
    'The Cache Miss Caverns', 'The Spaghetti Sewers', 'The Feature Flag Graveyard', 'The 3AM Pager Halls'
  ];
  const DEPTH_COLORS = ['#7b8cff', '#3ccf6e', '#ff9f43', '#a77bff', '#4aa3ff', '#ff4d6d', '#e8b04b', '#2dd4bf'];

  function buildEndless(d) {
    resetLevel();
    mode = 'endless';
    depth = d;
    rand = mulberry32(runSeed * 7919 + d * 104729);
    const theme = DEPTH_COLORS[(d - 1) % DEPTH_COLORS.length];

    // Scatter non-overlapping rooms
    const target = Math.min(10, 5 + Math.floor(d / 2));
    const placed = [];
    for (let tries = 0; tries < 400 && placed.length < target; tries++) {
      const w = 5 + Math.floor(rand() * 5), h = 5 + Math.floor(rand() * 4);
      const x = 2 + Math.floor(rand() * (MAP_W - w - 4)), y = 2 + Math.floor(rand() * (MAP_H - h - 4));
      if (placed.some(o => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue;
      placed.push({ x, y, w, h });
    }

    // Order them as a greedy nearest-neighbour chain so the stairs end up far away
    const order = [placed.shift()];
    while (placed.length) {
      const last = order[order.length - 1];
      let best = 0, bestD = Infinity;
      placed.forEach((o, k) => {
        const dd = Math.hypot(o.x - last.x, o.y - last.y);
        if (dd < bestD) { best = k; bestD = dd; }
      });
      order.push(placed.splice(best, 1)[0]);
    }

    rooms = order.map((r, n) => finishRoom({
      ...r, kind: 'plain', id: `depth-${d}-${n}`,
      label: `Depth ${d}`, subtitle: n === 0 ? pick(DEPTH_NAMES, rand) : '',
      color: n === order.length - 1 ? '#ffd166' : theme
    }, n));
    carveRooms();
    for (let n = 0; n < rooms.length - 1; n++) corridor(rooms[n], rooms[n + 1]);
    // An extra loop or two keeps it from being a straight line
    for (let k = 0; k < Math.min(2, rooms.length - 2); k++) {
      const a = rooms[Math.floor(rand() * rooms.length)], b = rooms[Math.floor(rand() * rooms.length)];
      if (a !== b) corridor(a, b);
    }
    finishMap([34, 34, 46]);
    rooms.forEach(decorate);

    const first = rooms[0], last = rooms[rooms.length - 1];
    stairsUp = { x: first.cx + 0.5, y: first.cy + 0.5 };
    stairsDown = { x: last.cx + 0.5, y: last.cy + 0.5 };

    // Foes get nastier the deeper you go
    const pool = ['bug'];
    if (d >= 2) pool.push('leak');
    if (d >= 3) pool.push('race');
    if (d >= 4) pool.push('zombie');
    if (d >= 5) pool.push('panic');
    rooms.forEach((r, n) => {
      if (n === 0) return;
      const count = 1 + Math.floor(rand() * (1 + Math.min(2, d / 3)));
      for (let k = 0; k < count; k++) enemies.push(makeFoe(pick(pool, rand), r));
      if (rand() < 0.3) {
        const p = randomRoomSpot(r);
        pickups.push({ x: p.x, y: p.y, kind: 'heart', seed: rand() * 6 });
      }
    });
    if (d % 5 === 0) {
      enemies.push(makeFoe('loop', last));
      bossAlive = true;
    }

    placePlayer(first.cx + 1.5, first.cy + 0.5);
    currentRoom = -1;
  }

  // ---------- Floor cache & memory pressure ----------

  function snapshotLevel() {
    return {
      tiles: tiles.slice(), roomAt: roomAt.slice(), tintAt: tintAt.slice(), explored: explored.slice(),
      noise: noise.slice(), floorColor: floorColor.slice(),
      rooms, props, torches, enemies, pickups, stairsDown, stairsUp, bossAlive
    };
  }

  function restoreLevel(snap, d) {
    resetLevel();
    mode = 'endless';
    depth = d;
    tiles.set(snap.tiles); roomAt.set(snap.roomAt); tintAt.set(snap.tintAt);
    explored.set(snap.explored); noise.set(snap.noise);
    floorColor.length = 0;
    floorColor.push(...snap.floorColor);
    ({ rooms, props, torches, enemies, pickups, stairsDown, stairsUp, bossAlive } = snap);
  }

  // Rough size of a stored floor: typed arrays plus the JSON size of its objects (UTF-16)
  function floorBytes(snap) {
    if (!snap.bytes) {
      const arrays = snap.tiles.byteLength + snap.roomAt.byteLength + snap.tintAt.byteLength +
        snap.explored.byteLength + snap.noise.byteLength;
      const colours = snap.floorColor.reduce((n, c) => n + (c ? c.length * 2 : 0), 0);
      const objects = JSON.stringify([snap.rooms, snap.props, snap.torches, snap.pickups,
        snap.enemies.map(e => ({ ...e, def: e.type }))]).length * 2;
      snap.bytes = arrays + colours + objects;
    }
    return snap.bytes;
  }

  function heapUsed() {
    let total = 0;
    floors.forEach(snap => { total += floorBytes(snap); });
    return total;
  }

  // The garbage collector evicts the floors furthest from the player when memory runs out.
  // An evicted floor regenerates with the same layout (same seed) but fresh foes.
  function collectGarbage() {
    while (heapUsed() > HEAP_LIMIT && floors.size > 1) {
      let victim = null;
      floors.forEach((snap, d) => {
        if (d !== depth && (victim === null || Math.abs(d - depth) > Math.abs(victim - depth))) victim = d;
      });
      if (victim === null) break;
      floors.delete(victim);
      floaters.push({ x: player.x, y: player.y, z: 110, text: `GC: depth ${victim} evicted`, color: '#ff9f43', life: 2.2, max: 2.2 });
      wingsSay(fill(pick(LINES.gc), victim), 2);
    }
  }

  // Step off the stairs we arrived by, onto the first free neighbouring tile
  function arriveAt(s) {
    const sx = Math.floor(s.x), sy = Math.floor(s.y);
    const spots = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const free = spots.find(([dx, dy]) => tileAt(sx + dx, sy + dy) === FLOOR) || [0, 0];
    placePlayer(sx + free[0] + 0.5, sy + free[1] + 0.5);
    exitCooldown = 0.8;
  }

  // from: 'above' when descending (arrive at the stairs up), 'below' when climbing
  function enterEndless(d, from = 'above') {
    const newRun = mode === 'story' && !runActive;
    if (newRun) {
      runSeed = Math.floor(Math.random() * 1e9);
      runKills = 0;
      floors.clear();
      save.runs++;
      player.hp = MAX_HP;
    }
    if (mode === 'endless') floors.set(depth, snapshotLevel());
    const cached = floors.get(d);
    if (cached) restoreLevel(cached, d); else buildEndless(d);
    floors.set(d, cached || snapshotLevel());
    runActive = true;
    arriveAt(from === 'below' ? stairsDown : stairsUp);
    currentRoom = -1;
    collectGarbage();

    if (d > save.best) save.best = d;
    persist();
    fade = 1;
    banner = { title: rooms[0].subtitle, sub: `Depth ${d}`, color: rooms[0].color, life: 3 };
    renderCodex();
    if (newRun) wingsSay(pick(LINES.enter), 2);
    else if (cached) wingsSay(fill(pick(from === 'below' ? LINES.up : LINES.back)), 1);
    else if (d % 5 === 0) wingsSay(pick(LINES.boss), 3);
    else wingsSay(fill(pick(LINES.depth)), 1);
  }

  function leaveEndless(died) {
    const reached = depth;
    if (died) {
      floors.clear();
      runActive = false;
    } else {
      floors.set(depth, snapshotLevel());
    }
    buildStory();
    fade = 1;
    placePlayer(portal.x + 1, portal.y);
    exitCooldown = 0.8;
    player.hp = died ? MAX_HP : player.hp;
    player.inv = 1.5;
    renderCodex();
    if (died) wingsSay(fill(pick(LINES.death), reached), 3);
    else wingsSay(pick(runActive ? LINES.paused : LINES.surface), 2);
  }

  function randomRoomSpot(r) {
    for (let tries = 0; tries < 40; tries++) {
      const x = r.x + 1 + Math.floor(rand() * (r.w - 2));
      const y = r.y + 1 + Math.floor(rand() * (r.h - 2));
      if (tileAt(x, y) === FLOOR && Math.hypot(x - r.cx, y - r.cy) > 1.5) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: r.x + 0.5, y: r.y + 0.5 };
  }

  // ---------- Foes ----------

  const FOE_TYPES = {
    bug: { names: ['Heisenbug', 'Off-by-one', 'Null Pointer', 'Typo', 'Flaky Test', 'Merge Conflict'], hp: 3, speed: 1.6, wander: 0.9, look: 'sprite', r: 0.26 },
    leak: { names: ['Memory Leak'], hp: 5, speed: 1.0, wander: 0.5, look: 'slime', color: '#5fd068', r: 0.32 },
    leaklet: { names: ['Leaked Byte'], hp: 1, speed: 1.9, wander: 1.2, look: 'slime', color: '#9be8a0', r: 0.2, small: true },
    race: { names: ['Race Condition'], hp: 2, speed: 4.6, wander: 1.4, look: 'dart', color: '#ff4d6d', r: 0.22 },
    zombie: { names: ['Zombie Process'], hp: 3, speed: 1.3, wander: 0.7, look: 'sprite', grey: true, r: 0.26 },
    panic: { names: ['Kernel Panic', 'Segfault', 'Stack Overflow'], hp: 3, speed: 1.1, wander: 0.7, look: 'orb', color: '#ff9f43', r: 0.26, ranged: true },
    loop: { names: ['The Infinite Loop'], hp: 18, speed: 2.2, wander: 0, look: 'ring', color: '#a77bff', r: 0.45, boss: true }
  };

  function makeFoe(type, r, opts = {}) {
    const def = FOE_TYPES[type];
    const p = opts.at || randomRoomSpot(r);
    const extra = mode === 'endless' ? (def.boss ? depth * 2 : Math.floor(depth / 4)) : 0;
    const hp = def.hp + extra;
    return {
      type, def, x: p.x, y: p.y, r: def.r, name: opts.name || pick(def.names, rand), home: r.n,
      hp, maxHp: hp, kx: 0, ky: 0, flash: 0, anim: rand(), faceRight: false,
      goal: null, wait: rand() * 2, rest: 0, speed: def.wander + rand() * 0.3,
      cd: 1 + rand() * 2, dash: 0, dashing: false, down: 0, revived: false, ang: 0, charge: 0, vx: 0, vy: 0
    };
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

  const hittable = e => !e.down;

  // Melee arc: a foe is hit if it is within reach and its direction has at least
  // this dot product with the facing direction (0.2 ~ 156 degrees, -0.55 ~ 247)
  const WEAPONS = [
    { id: 'sword', name: 'Sword', cd: 0.36, swing: 0.2, reach: 1.1, arc: 0.2, push: 6, radius: 52, sweep: [-1.1, 0.2] },
    { id: 'cleaver', name: 'Cleaver', cd: 0.62, swing: 0.3, reach: 1.45, arc: -0.55, push: 9, radius: 66, sweep: [-2.2, 1.0] },
    { id: 'blaster', name: 'Packet Blaster', cd: 0.3, ranged: true, speed: 9, range: 7.5 }
  ];
  let weapon = WEAPONS.find(w => w.id === save.weapon) || WEAPONS[0];
  let shots = [];

  function setWeapon(i) {
    const w = WEAPONS[(i + WEAPONS.length) % WEAPONS.length];
    if (w === weapon) return;
    weapon = w;
    save.weapon = w.id;
    persist();
    floaters.push({ x: player.x, y: player.y, z: 90, text: w.name.toUpperCase(), color: '#ffd166', life: 1, max: 1 });
    wingsSay(pick(LINES.weapon[w.id]), 0);
  }

  function face(x, y) {
    const d = Math.hypot(x - player.x, y - player.y) || 1;
    player.fx = (x - player.x) / d;
    player.fy = (y - player.y) / d;
    player.faceRight = player.fx - player.fy >= 0;
  }

  // target: optional foe to aim at (clicked); otherwise the nearest sensible one
  function attack(target = null) {
    if (player.atkCd > 0 || player.dead) return;
    lastInput = time;
    player.atkCd = weapon.cd;

    if (weapon.ranged) {
      // Aim at the clicked foe, else the nearest one roughly in front, else straight ahead
      let aim = target;
      if (!aim) {
        let bestD = weapon.range;
        enemies.forEach(e => {
          if (!hittable(e)) return;
          const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 0.001;
          if (d < bestD && (dx * player.fx + dy * player.fy) / d > 0.35) { aim = e; bestD = d; }
        });
      }
      if (aim) face(aim.x, aim.y);
      shots.push({
        x: player.x + player.fx * 0.4, y: player.y + player.fy * 0.4,
        vx: player.fx * weapon.speed, vy: player.fy * weapon.speed, life: weapon.range / weapon.speed
      });
      burst(player.x + player.fx * 0.5, player.y + player.fy * 0.5, 30, '#7fe3ff', 5, 1.5);
    } else {
      // Snap to the closest foe in reach so clicking / mashing feels good
      let best = target, bestD = weapon.reach + 0.6;
      if (!best) {
        enemies.forEach(e => {
          if (!hittable(e)) return;
          const d = Math.hypot(e.x - player.x, e.y - player.y) - e.r + 0.26;
          if (d < bestD) { best = e; bestD = d; }
        });
      }
      if (best) face(best.x, best.y);
      player.swing = weapon.swing;
      enemies.slice().forEach(e => {
        if (!hittable(e)) return;
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < weapon.reach + e.r && (d < 0.6 + e.r || (dx * player.fx + dy * player.fy) / d > weapon.arc)) {
          hitFoe(e, dx / d, dy / d, weapon.push);
        }
      });
    }

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
      if (shrine.kind === 'chest') chest.open = Math.max(chest.open, 0.001);
      openLore(shrine);
    }
  }

  const isIntact = r => r.kind === 'chest' ? chest.open === 0 : r.kind === 'shrine' && !r.broken;

  function shrineInReach() {
    if (mode !== 'story') return null;
    return rooms.find(r => isIntact(r) && Math.hypot(player.x - (r.cx + 0.5), player.y - (r.cy + 0.5)) < 1.75);
  }

  function hitFoe(e, nx, ny, force = 6) {
    e.hp--;
    e.flash = 0.14;
    const push = e.def.boss ? force / 3 : force;
    e.kx = nx * push; e.ky = ny * push;
    shake = Math.max(shake, 0.08);
    burst(e.x, e.y, 26, '#ffffff', 6, 2.5);
    if (e.hp > 0) return;

    // Zombie processes need killing twice
    if (e.type === 'zombie' && !e.revived) {
      e.down = 2.5;
      e.revived = true;
      floaters.push({ x: e.x, y: e.y, z: 70, text: 'kill -9 required...', color: '#b8b2c9', life: 1.6, max: 1.6 });
      return;
    }

    const color = e.def.color || rgb(rooms[e.home] ? rooms[e.home].rgb : [155, 227, 90]);
    burst(e.x, e.y, 20, color, 18, 3.5);
    burst(e.x, e.y, 20, '#9be35a', 8, 2.5);
    floaters.push({ x: e.x, y: e.y, z: 70, text: `${e.name} squashed!`, color: '#9be35a', life: 1.4, max: 1.4 });
    enemies = enemies.filter(o => o !== e);

    if (e.type === 'leak') {
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        const spot = { x: e.x + Math.cos(a) * 0.3, y: e.y + Math.sin(a) * 0.3 };
        if (!blocked(spot.x, spot.y, 0.2)) enemies.push(makeFoe('leaklet', rooms[e.home], { at: spot }));
      }
    }
    if (e.def.boss) {
      bossAlive = false;
      shake = 0.6;
      burst(e.x, e.y, 30, '#a77bff', 60, 5);
      pickups.push({ x: e.x, y: e.y, kind: 'heart', seed: 1 }, { x: e.x + 0.4, y: e.y + 0.3, kind: 'heart', seed: 2 });
      wingsSay(pick(LINES.bossDown), 3);
    } else if (mode === 'endless' && Math.random() < 0.12) {
      pickups.push({ x: e.x, y: e.y, kind: 'heart', seed: Math.random() * 6 });
    }

    if (mode === 'story') {
      kills++;
      save.kills = kills;
      if (rooms[e.home]) rooms[e.home].respawn = 35;
    } else {
      runKills++;
      save.deepKills++;
    }
    persist();

    recentKills = recentKills.filter(t => time - t < 6);
    recentKills.push(time);
    if (recentKills.length >= 3) {
      recentKills = [];
      wingsSay(pick(LINES.streak), 1);
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
    if (player.hp <= 0) {
      player.dead = 2.6;
    } else if (player.hp === 1) {
      wingsSay(pick(LINES.lowHp), 2);
    } else if (Math.random() < 0.35) {
      wingsSay(pick(LINES.hurt), 1);
    }
  }

  function respawn() {
    if (mode === 'endless') { leaveEndless(true); return; }
    const r = rooms[0];
    placePlayer(r.x + 1.5, r.y + r.h - 1.5);
    player.hp = MAX_HP; player.inv = 1.5;
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
    if (portalOpen() && Math.random() < dt * 8) {
      particles.push({
        x: portal.x + (Math.random() - 0.5) * 0.8, y: portal.y + (Math.random() - 0.5) * 0.8, z: 2,
        vx: 0, vy: 0, vz: 40 + Math.random() * 40, g: -20, life: 1, max: 1, color: '#c4a7ff', size: 2
      });
    }
  }

  // ---------- Lore panel & codex ----------

  function openLore(r) {
    r.read = true;
    if (!save.read.includes(r.id)) save.read.push(r.id);
    let body = r.info.replace('{{age}}', typeof currentAge === 'function' ? currentAge() : '');
    if (r.id === 'thanks') {
      const shrines = storyData.filter(o => o.id !== 'thanks');
      const read = shrines.filter(o => save.read.includes(o.id)).length;
      body += `<br><br><b>Your run:</b> ${read}/${shrines.length} shrines read · ${kills} bug${kills === 1 ? '' : 's'} squashed.`;
      body += save.key
        ? '<br><br>The <b>Key of Infinite Recursion</b> 🗝️ is still in your pocket. The portal to the Endless Depths is in this room.'
        : '<br><br><b>Inside the chest:</b> the <b>Key of Infinite Recursion</b> 🗝️. Something has just opened in this room...';
      if (!save.chest) { save.chest = true; }
    }
    persist();
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
    if (mode === 'story' && r.kind === 'shrine' && !r.broken && rooms.includes(r)) breakShrine(r);
    if (r.id === 'thanks' && !save.key) grantKey();
    canvas.focus({ preventScroll: true });
  }

  function breakShrine(r, quiet) {
    r.broken = true;
    tiles[idx(r.cx, r.cy)] = FLOOR;
    r.rubble = Array.from({ length: 6 }, () => ({
      x: r.cx + 0.5 + (Math.random() - 0.5) * 0.9,
      y: r.cy + 0.5 + (Math.random() - 0.5) * 0.9,
      s: 0.06 + Math.random() * 0.08,
      h: 6 + Math.random() * 10
    }));
    if (quiet) return;
    if (!save.broken.includes(r.id)) save.broken.push(r.id);
    persist();
    shake = 0.4;
    burst(r.cx + 0.5, r.cy + 0.5, 30, '#6b6682', 30, 4);
    burst(r.cx + 0.5, r.cy + 0.5, 66, r.color, 40, 4.5);
    floaters.push({ x: r.cx + 0.5, y: r.cy + 0.5, z: 90, text: 'Chapter unlocked!', color: r.color, life: 1.8, max: 1.8 });
  }

  function grantKey() {
    save.key = true;
    persist();
    shake = 0.5;
    burst(portal.x, portal.y, 10, '#a77bff', 60, 4);
    burst(chest.x, chest.y, 40, '#ffd166', 30, 3);
    floaters.push({ x: chest.x, y: chest.y, z: 100, text: 'KEY OF INFINITE RECURSION OBTAINED', color: '#ffd166', life: 2.6, max: 2.6 });
    banner = { title: 'A portal opens', sub: 'The Endless Depths await', color: '#c4a7ff', life: 3 };
    renderCodex();
    ensureNews();
    wingsSay(LINES.intro, 3);
    wardrobeDue = time + 3.5;
  }

  function renderCodex() {
    codexList.innerHTML = '';
    const items = storyData.map(d => ({ d, room: mode === 'story' ? rooms.find(r => r.id === d.id) : null }));
    items.forEach(({ d, room }) => {
      const read = save.read.includes(d.id);
      const visited = room ? room.visited : read;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'codex-item' + (read ? ' read' : '');
      btn.style.setProperty('--accent', d.color);
      btn.innerHTML = `<span class="codex-gem"></span><span class="codex-name">${d.label}</span>` +
        `<span class="codex-state">${read ? 'read' : visited ? 'found' : '???'}</span>`;
      btn.title = read ? `Read ${d.label} again` : `Walk to ${d.subtitle}`;
      btn.addEventListener('click', () => {
        if (paused || player.dead) return;
        if (!room) {
          if (read) openLore(storyData.find(o => o.id === d.id));
          else wingsSay('Nice try. Chapters are read on the surface, shrine by shrine.', 2);
          return;
        }
        if (!isIntact(room)) { openLore(room); return; }
        walkTo(room.cx, room.cy, false);
        strikeOnArrive = room;
        canvas.focus({ preventScroll: true });
      });
      li.appendChild(btn);
      codexList.appendChild(li);
    });

    if (save.key) {
      const li = document.createElement('li');
      li.className = 'codex-wide';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'codex-item read endless';
      btn.style.setProperty('--accent', '#c4a7ff');
      btn.innerHTML = `<span class="codex-gem"></span><span class="codex-name">Endless Depths</span>` +
        `<span class="codex-state">${mode === 'endless' ? `depth ${depth}` : `best ${save.best}`}</span>`;
      btn.title = mode === 'endless' ? 'You are here' : 'Walk to the portal';
      btn.addEventListener('click', () => {
        if (paused || player.dead || mode !== 'story') return;
        walkTo(portal.x, portal.y, true);
        canvas.focus({ preventScroll: true });
      });
      li.appendChild(btn);
      codexList.appendChild(li);
    }

    settings.hidden = !save.key && !save.read.length;
    wingsToggle.closest('label').hidden = !save.key;
    teleportButton.hidden = replayButton.hidden = wardrobeButton.hidden = !save.key;
    wingsToggle.checked = !save.wingsMuted;
  }

  // Explored tiles of the story map, run-length encoded for storage
  function packExplored() {
    const out = [];
    let cur = 0, run = 0;
    explored.forEach(v => {
      if (v === cur) run++;
      else { out.push(run); cur = v; run = 1; }
    });
    out.push(run);
    return out.join('.');
  }

  function unpackExplored(s) {
    if (!s) return;
    const runs = s.split('.').map(Number);
    if (runs.reduce((a, b) => a + b, 0) !== explored.length) return;
    let i = 0, cur = 0;
    runs.forEach(n => { explored.fill(cur, i, i + n); i += n; cur ^= 1; });
  }

  // ---------- Wings, the bat ----------

  const LINES = {
    intro: "Oh. You opened the chest. Great. I'm Wings, I live here. That key opens the Endless Depths. I'll be... supervising.",
    enter: [
      'Welcome to the Endless Depths. Population: bugs. And now you.',
      "Down we go. Don't worry, I've read the docs. Nobody else has.",
      'Infinite floors, finite hearts. Pace yourself.'
    ],
    depth: [
      'Depth {d}. Smells like legacy code.',
      'Depth {d}. The documentation stopped a few floors ago.',
      'Depth {d}: here be dragons. Well, bugs. Mostly bugs.',
      'Depth {d}. Your best is {best}. No pressure. Some pressure.',
      'Further down. I hope you committed your changes.'
    ],
    boss: [
      "That's an Infinite Loop. Whatever you do, don't— oh, you're already in it.",
      'Boss floor. The stairs stay locked until that thing stops iterating.'
    ],
    bossDown: ['Loop terminated. Somebody add that to the release notes.', 'You broke the Infinite Loop. Finally, a base case.'],
    surface: ['Back on the surface. Fresh air. Well, dungeon air.', 'Climbing out already? Fair. The depths will still be broken tomorrow.'],
    paused: ['Surface break. Your floors are cached, the portal will drop you back in.', 'Popping up for air? The depths are still in memory. For now.'],
    up: ['Back up to depth {d}. Exactly as you left it. Cached, not fresh.', 'Depth {d} again. Nostalgic already?'],
    back: ['Depth {d}, straight from the cache.', 'Oh, depth {d}. We have been here. I remember the smell.'],
    gc: ['Memory pressure! The garbage collector just evicted depth {d}. Hope you did not leave anything there.', 'GC pause. Depth {d} is gone. It will come back, but it will not remember you.'],
    outfit: [
      'New look. Bold. I would not have chosen it, but I am a bat.',
      'Ooh, fancy. The bugs will be very impressed. They will still bite you.',
      'Nice outfit. Shame about the swordsmanship.',
      'Dressed for success. Or at least for depth 3.'
    ],
    weapon: {
      sword: ['The Sword. Classic. Reliable. A bit 2019.'],
      cleaver: ['The Cleaver. Wide arc, slow swing. Refactoring by force.'],
      blaster: ['The Packet Blaster. Fire and forget. Like most deploys.']
    },
    death: [
      'And that is why we have backups.',
      'Rolled back to the surface. Classic.',
      'Your run ended at depth {d}. I will write you a lovely incident report.',
      "Depth {d}. Not bad. Not good either. It's a number."
    ],
    hurt: ['Ouch. Logging that as a P1.', 'Have you tried not getting hit?', 'That looked expensive.', "I'll put that in the post-mortem."],
    lowHp: ['One heart left. Maybe a good time to read the docs.', "You're running on one heart and pure stubbornness."],
    streak: ['Three in a row! Look at you, closing tickets.', "Don't let it go to your head. They'll be back after the next deploy."],
    heart: ['A heart! Finally some good news.', 'Patched. For now.'],
    stairs: ['Stairs! Down is the only direction that counts down here.'],
    locked: ['Locked. Deal with the Infinite Loop first. Yes, the big angry one.'],
    idle: ['Are you AFK or just admiring the brickwork?', "I'll wait. I'm a bat. Hanging around is literally my thing."],
    sass: [
      'Swinging a sword at bugs. Very "move fast and break things" of you.',
      "You know you can just walk around them, right? No? Okay, carry on.",
      'Another room, another bug. Like being on call, but with more stone.',
      'Fun fact: bats are the only flying mammals. You are the only... whatever this is.',
      "I'd help, but I'm more of a consultant."
    ],
    jokes: [
      'Why do programmers prefer dark mode? Because light attracts bugs. So do you, apparently.',
      'A SQL query walks into a bar, sees two tables and asks: "Can I join you?"',
      "I'd tell you a UDP joke, but you might not get it.",
      "I'd tell you a TCP joke, but I'd have to keep repeating it until you acknowledged it.",
      "How many programmers does it take to change a light bulb? None. That's a hardware problem.",
      'Knock knock. Race condition. Who\'s there?',
      'To understand recursion, see: this dungeon.',
      'It works on my machine. Ship the machine.',
      'terraform plan: 2 to add, 0 to change, 1 bat to destroy. Rude.',
      'Why did the developer go broke? Used up all their cache.',
      'There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
      'I put a bat in the CI pipeline. Now it is echolocation-driven development.'
    ],
    news: [
      'Top of Hacker News right now: "{t}". Bold of them.',
      '"{t}" is trending on Hacker News. {s} points. I have seen better ideas in a cave.',
      'Breaking, via Hacker News: "{t}". Wake me when it is on its third rewrite.',
      'Hacker News is talking about "{t}". Have they tried turning it off and on again?',
      'Saw "{t}" on Hacker News. In my day we just had bats and caves.'
    ],
    offline: ["I'd tell you the tech news, but the Wi-Fi down here is terrible."]
  };

  const fill = (s, d = depth) => s.replace('{d}', d).replace('{best}', save.best);

  const wings = {
    state: 'away', x: 0, y: 0, z: 200, t: 0, stay: 0, flap: 0, faceRight: true,
    msg: null, msgLife: 0, msgMax: 0, priority: 0, cooldown: 0, next: 20
  };
  const wingsOn = () => save.key && !save.wingsMuted;

  // item: an optional Hacker News story the line is about; makes the bubble clickable
  function wingsSay(text, priority = 1, item = null) {
    if (!wingsOn() || !text) return;
    if (wings.msg && wings.priority > priority) return;
    if (priority < 2 && wings.cooldown > 0) return;
    wings.msg = text;
    wings.item = item;
    // Linked lines stay up a little longer so there is time to click them
    wings.msgLife = wings.msgMax = 2.8 + text.length * 0.05 + (item ? 4 : 0);
    wings.priority = priority;
    wings.cooldown = 6;
    wings.stay = Math.max(wings.stay, wings.msgLife + 3);
    if (wings.state === 'away' || wings.state === 'out') {
      if (wings.state === 'away') {
        wings.x = player.x - 7; wings.y = player.y - 7; wings.z = 220;
      }
      wings.state = 'in';
    }
    if (wingsLog) wingsLog.textContent = `Wings: ${text}`;
  }

  // Latest Hacker News headlines, cached for a couple of hours
  let news = loadJSON(NEWS_KEY);
  let newsLoading = false;
  let newsSeen = 0;

  function ensureNews() {
    if (newsLoading || (news && Date.now() - news.at < 2 * 3600e3 && news.items.length)) return;
    newsLoading = true;
    const api = 'https://hacker-news.firebaseio.com/v0';
    fetch(`${api}/topstories.json`)
      .then(r => r.json())
      .then(ids => Promise.all(ids.slice(0, 15).map(id => fetch(`${api}/item/${id}.json`).then(r => r.json()).catch(() => null))))
      .then(items => {
        const list = items.filter(i => i && i.title && i.type === 'story').map(i => ({
          id: i.id,
          title: i.title,
          score: i.score || 0,
          by: i.by || '',
          comments: i.descendants || 0,
          time: i.time || 0,
          url: /^https?:\/\//.test(i.url || '') ? i.url : '',
          text: i.text || ''
        }));
        if (list.length) {
          news = { at: Date.now(), items: list };
          storeJSON(NEWS_KEY, news);
        }
      })
      .catch(() => {})
      .finally(() => { newsLoading = false; });
  }

  function sayNews() {
    if (!news || !news.items.length) { wingsSay(pick(LINES.offline), 0); return; }
    const item = news.items[newsSeen++ % news.items.length];
    const title = item.title.length > 80 ? `${item.title.slice(0, 77)}...` : item.title;
    wingsSay(pick(LINES.news).replace('{t}', title).replace('{s}', item.score), 0, item);
  }

  function sayAmbient() {
    const r = Math.random();
    if (r < 0.38) wingsSay(pick(LINES.jokes), 0);
    else if (r < 0.7) sayNews();
    else wingsSay(mode === 'endless' && Math.random() < 0.5 ? fill(pick(LINES.depth)) : pick(LINES.sass), 0);
  }

  // ---------- The news card Wings links to ----------

  const ago = secs => {
    const m = Math.max(1, Math.round((Date.now() / 1000 - secs) / 60));
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.round(h / 24)} days ago`;
  };

  // HN post text arrives as HTML; reduce it to plain text for the card
  function plainText(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    doc.querySelectorAll('p').forEach(p => p.prepend(' '));
    const text = doc.body.textContent.replace(/\s+/g, ' ').trim();
    return text.length > 320 ? `${text.slice(0, 317)}...` : text;
  }

  function showNewsCard(item) {
    const discuss = `https://news.ycombinator.com/item?id=${encodeURIComponent(item.id)}`;
    let site = 'news.ycombinator.com';
    try { if (item.url) site = new URL(item.url).hostname.replace(/^www\./, ''); } catch (e) { /* keep default */ }
    newsCard.querySelector('.news-site').textContent = site;
    newsCard.querySelector('.news-title').textContent = item.title;
    newsCard.querySelector('.news-meta').textContent =
      `${item.score} points · ${item.comments} comments · by ${item.by || 'someone'} · ${item.time ? ago(item.time) : 'recently'}`;
    const blurb = newsCard.querySelector('.news-blurb');
    blurb.textContent = item.text ? plainText(item.text) : `Wings has opinions. The article itself lives on ${site}.`;
    const read = newsCard.querySelector('.news-read');
    read.href = item.url || discuss;
    read.textContent = item.url ? 'Read the article' : 'Read the post';
    newsCard.querySelector('.news-discuss').href = discuss;
    newsCard.hidden = false;
    newsCard.classList.remove('show');
    void newsCard.offsetWidth;
    newsCard.classList.add('show');
  }

  function hideNewsCard() {
    newsCard.classList.remove('show');
    setTimeout(() => { if (!newsCard.classList.contains('show')) newsCard.hidden = true; }, 300);
  }

  function updateWings(dt) {
    wings.flap += dt * 16;
    wings.cooldown -= dt;
    if (!wingsOn()) { wings.state = 'away'; wings.msg = null; return; }

    wings.next -= dt;
    if (wings.next <= 0 && !player.dead) {
      sayAmbient();
      wings.next = mode === 'endless' ? 30 + Math.random() * 25 : 55 + Math.random() * 35;
    }
    if (time - lastInput > 25 && !player.dead) {
      lastInput = time;
      wingsSay(pick(LINES.idle), 1);
    }

    if (wings.msg && (wings.msgLife -= dt) <= 0) wings.msg = null;

    let tx, ty, tz;
    if (wings.state === 'out') {
      tx = player.x + 6; ty = player.y - 6; tz = 240;
    } else {
      // Hover just behind the hero's shoulder
      tx = player.x - 0.7 + Math.sin(time * 0.7) * 0.4;
      ty = player.y - 1.0;
      tz = 78 + Math.sin(time * 2.6) * 6;
    }
    const k = 1 - Math.exp(-dt * (wings.state === 'in' ? 2.6 : 3.5));
    const ox = wings.x;
    wings.x += (tx - wings.x) * k;
    wings.y += (ty - wings.y) * k;
    wings.z += (tz - wings.z) * k;
    if (Math.abs(wings.x - ox) > 0.002) wings.faceRight = wings.x - ox > 0;

    if (wings.state === 'in' && Math.hypot(tx - wings.x, ty - wings.y) < 0.4) wings.state = 'hover';
    if (wings.state === 'hover' && !wings.msg && (wings.stay -= dt) <= 0) { wings.state = 'out'; wings.t = 0; }
    if (wings.state === 'out' && (wings.t += dt) > 1.8) wings.state = 'away';
  }

  // ---------- Wardrobe ----------

  const preview = document.getElementById('wardrobePreview');
  const previewHero = document.createElement('canvas');
  let draftLook = null;
  let previewStart = 0;

  function openWardrobe(first) {
    if (paused || wardrobeOpen) return;
    wardrobeOpen = true;
    draftLook = look();
    document.getElementById('wardrobeSub').textContent = first
      ? 'The story is done. Before you descend, make the hero yours.'
      : 'Change your look. Wings will judge you either way.';
    renderWardrobe();
    wardrobe.hidden = false;
    Object.keys(keys).forEach(k => { keys[k] = false; });
    previewStart = performance.now();
    requestAnimationFrame(drawPreview);
    document.getElementById('wardrobeDone').focus({ preventScroll: true });
  }

  function closeWardrobe() {
    if (!wardrobeOpen) return;
    wardrobeOpen = false;
    wardrobe.hidden = true;
    const changed = JSON.stringify(draftLook) !== JSON.stringify(look());
    save.look = draftLook;
    persist();
    buildHero();
    if (changed) {
      burst(player.x, player.y, 30, '#ffd166', 24, 3);
      wingsSay(pick(LINES.outfit), 2);
    }
    canvas.focus({ preventScroll: true });
  }

  function renderWardrobe() {
    const box = document.getElementById('wardrobeOptions');
    box.innerHTML = '';
    const group = (label, items, key, swatch) => {
      const wrap = document.createElement('div');
      wrap.className = 'wardrobe-group';
      wrap.innerHTML = `<h4>${label}</h4>`;
      const row = document.createElement('div');
      row.className = 'wardrobe-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', label);
      items.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = swatch ? 'wardrobe-swatch' : 'wardrobe-chip';
        b.setAttribute('aria-pressed', draftLook[key] === o.id);
        b.setAttribute('aria-label', `${label}: ${o.name}`);
        b.title = o.name;
        if (swatch) b.style.setProperty('--swatch', o.c[0]);
        else b.textContent = o.name;
        b.addEventListener('click', () => {
          draftLook = { ...draftLook, [key]: o.id };
          renderWardrobe();
          previewStart = performance.now();
          box.querySelector(`[aria-label="${label}: ${o.name}"]`).focus();
        });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      box.appendChild(wrap);
    };
    Object.entries(LOOKS).forEach(([key, g]) => group(g.label, g.options, key, true));
    group('Headwear', HATS, 'hat', false);
    buildHero(previewHero, draftLook);
  }

  // Idle, then a little walk, so the whole outfit can be seen moving
  function drawPreview(now) {
    if (!wardrobeOpen) return;
    const c = preview.getContext('2d');
    c.clearRect(0, 0, preview.width, preview.height);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(2, preview.height - 2, 11, 1);
    const t = (now - previewStart) / 1000;
    const walking = t % 4 > 2.6;
    const frame = walking ? Math.floor(t * 9) % 3 : 3;
    const hop = t < 0.3 ? Math.round(2 * Math.sin(Math.PI * t / 0.3)) : 0;
    const flip = walking && Math.floor(t / 4) % 2 === 1;
    c.save();
    if (flip) { c.translate(preview.width, 0); c.scale(-1, 1); }
    c.drawImage(previewHero, frame * HERO_W, 0, HERO_W, HERO_H, 1, preview.height - HERO_H - 1 - hop, HERO_W, HERO_H);
    c.restore();
    requestAnimationFrame(drawPreview);
  }

  function randomLook() {
    const r = list => list[Math.floor(Math.random() * list.length)].id;
    draftLook = {
      hair: r(LOOKS.hair.options), skin: r(LOOKS.skin.options), shirt: r(LOOKS.shirt.options),
      pants: r(LOOKS.pants.options), hat: r(HATS)
    };
    renderWardrobe();
    previewStart = performance.now();
  }

  // ---------- Update ----------

  const held = (...ks) => ks.some(k => keys[k]);

  function update(dt) {
    time += dt;
    player.atkCd -= dt; player.swing -= dt; player.inv -= dt;
    shake = Math.max(0, shake - dt);
    fade = Math.max(0, fade - dt * 1.8);

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
          if (mode === 'story') {
            banner = { title: r.subtitle, sub: r.label, color: r.color, life: 3 };
            renderCodex();
          } else if (here === rooms.length - 1) {
            wingsSay(pick(bossAlive ? LINES.locked : LINES.stairs), 1);
          }
        }
      }
    }
    if (mode === 'story' && (saveTimer -= dt) <= 0) {
      saveTimer = 4;
      save.explored = packExplored();
      persist();
    }

    // Auto-walks from the codex finish with a strike
    if (strikeOnArrive && !path && repath <= 0 && !player.dead) {
      if (shrineInReach() === strikeOnArrive) attack();
      strikeOnArrive = null;
    }
    if (wardrobeDue && time > wardrobeDue && !paused && !player.dead) {
      wardrobeDue = 0;
      openWardrobe(true);
    }
    if (chest && chest.open > 0 && chest.open < 1) {
      chest.open = Math.min(1, chest.open + dt * 2.5);
      if (Math.random() < 0.6) burst(chest.x, chest.y, 30, '#ffd166', 1, 2);
    }

    updateEnemies(dt);
    updateProjectiles(dt);
    updateShots(dt);
    updatePickups();
    checkExits(dt);

    // Restock story rooms the player isn't standing in
    if (mode === 'story') {
      rooms.forEach(r => {
        if (r.respawn > 0) {
          r.respawn -= dt;
          if (r.respawn <= 0 && currentRoom !== r.n) {
            const alive = enemies.filter(e => e.home === r.n).map(e => e.name);
            const missing = r.foes.find(n => !alive.includes(n));
            if (missing) {
              enemies.push(makeFoe('bug', r, { name: missing }));
              if (alive.length + 1 < r.foes.length) r.respawn = 20;
            }
          } else if (r.respawn <= 0) {
            r.respawn = 5;
          }
        }
      });
    }

    updateWings(dt);
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

  function checkExits(dt) {
    exitCooldown -= dt;
    if (player.dead || fade > 0.5 || exitCooldown > 0) return;
    const on = p => p && Math.hypot(player.x - p.x, player.y - p.y) < 0.45;
    if (portalOpen() && on(portal)) {
      // Resumes the current run at depth 1 if there is one
      enterEndless(1);
    } else if (mode === 'endless' && on(stairsDown)) {
      if (bossAlive) {
        if (!stairsDown.warned) { stairsDown.warned = true; wingsSay(pick(LINES.locked), 2); }
      } else {
        enterEndless(depth + 1, 'above');
      }
    } else if (mode === 'endless' && on(stairsUp)) {
      if (depth > 1) enterEndless(depth - 1, 'below');
      else leaveEndless(false);
    }
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
      lastInput = time;
    } else if (path) {
      lastInput = time;
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

  function shoot(e, ang, speed) {
    projectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 3, color: e.def.color });
  }

  function updateEnemies(dt) {
    enemies.forEach(e => {
      const def = e.def;
      e.flash -= dt;
      e.rest -= dt;
      e.anim += dt * 4;

      if (e.down > 0) {
        e.down -= dt;
        if (e.down <= 0) {
          e.hp = Math.ceil(e.maxHp / 2);
          burst(e.x, e.y, 20, '#b8b2c9', 14, 2.5);
          floaters.push({ x: e.x, y: e.y, z: 70, text: 'respawned', color: '#b8b2c9', life: 1.2, max: 1.2 });
        }
        return;
      }

      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const aggro = !player.dead && (def.boss || d < 2.5 || (d < 7 && currentRoom === e.home));
      let mx = 0, my = 0, speed = e.speed;

      if (def.boss && aggro) {
        // Circles the player, then either charges or sprays a ring of bolts
        e.ang += dt * 1.1;
        e.cd -= dt;
        if (e.charge > 0) {
          e.charge -= dt;
          mx = e.vx; my = e.vy; speed = 5.5;
        } else {
          const tx = player.x + Math.cos(e.ang) * 2.6 - e.x, ty = player.y + Math.sin(e.ang) * 2.6 - e.y;
          const td = Math.hypot(tx, ty) || 1;
          if (td > 0.1) { mx = tx / td; my = ty / td; }
          speed = def.speed;
          if (e.cd <= 0) {
            e.cd = 3;
            if (Math.random() < 0.5) {
              e.charge = 0.55; e.vx = dx / d; e.vy = dy / d;
            } else {
              for (let k = 0; k < 10; k++) shoot(e, k / 10 * Math.PI * 2 + e.ang, 3.2);
            }
          }
        }
      } else if (aggro && e.rest > 0) {
        // Back off for a moment after landing a hit
        mx = -dx / d; my = -dy / d;
        speed = 1.2;
      } else if (aggro && e.type === 'race') {
        // Darts in short, fast bursts
        e.dash -= dt;
        if (e.dash <= 0) {
          e.dashing = !e.dashing;
          e.dash = e.dashing ? 0.35 : 0.5 + Math.random() * 0.6;
          const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
          e.vx = Math.cos(a); e.vy = Math.sin(a);
        }
        if (e.dashing) { mx = e.vx; my = e.vy; speed = def.speed; }
      } else if (aggro && def.ranged) {
        // Keeps its distance and lobs bolts
        if (d < 3) { mx = -dx / d; my = -dy / d; } else if (d > 4.5) { mx = dx / d; my = dy / d; }
        speed = def.speed;
        e.cd -= dt;
        if (e.cd <= 0 && d < 7) {
          e.cd = 2.2;
          shoot(e, Math.atan2(dy, dx), 4);
        }
      } else if (aggro) {
        if (d > 0.45) { mx = dx / d; my = dy / d; }
        speed = def.speed;
      } else {
        e.wait -= dt;
        if (!e.goal || e.wait <= 0 || Math.hypot(e.goal.x - e.x, e.goal.y - e.y) < 0.15) {
          if (e.wait <= 0 && rooms[e.home]) { e.goal = randomRoomSpot(rooms[e.home]); e.wait = 2 + rand() * 3; }
        }
        if (e.goal) {
          const gx = e.goal.x - e.x, gy = e.goal.y - e.y, gd = Math.hypot(gx, gy);
          if (gd > 0.15) { mx = gx / gd; my = gy / gd; }
        }
      }

      // Keep foes from stacking on top of each other
      enemies.forEach(o => {
        if (o === e || o.down > 0) return;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
        if (od < e.r + o.r && od > 0.001) { mx += ox / od * 0.8; my += oy / od * 0.8; }
      });

      const decay = Math.exp(-dt * 8);
      e.kx *= decay; e.ky *= decay;
      if (e.flash > 0) { mx = 0; my = 0; }
      move(e, (mx * speed + e.kx) * dt, (my * speed + e.ky) * dt);
      if (Math.abs(mx - my) > 0.05) e.faceRight = mx - my > 0;

      if (d < e.r + 0.35 && e.flash <= 0 && e.rest <= 0 && player.inv <= 0 && !player.dead) {
        hurtPlayer(e.x, e.y);
        e.rest = def.boss ? 0.8 : 1.4;
        e.charge = 0;
      }
    });
  }

  // The hero's own projectiles
  function updateShots(dt) {
    shots.forEach(s => {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.life -= dt;
      if (tileAt(Math.floor(s.x), Math.floor(s.y)) !== FLOOR) {
        s.life = 0;
        burst(s.x - s.vx * 0.02, s.y - s.vy * 0.02, 24, '#7fe3ff', 6, 1.5);
        return;
      }
      const hit = s.life > 0 && enemies.find(e => hittable(e) && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 0.2);
      if (hit) {
        s.life = 0;
        const d = Math.hypot(s.vx, s.vy) || 1;
        hitFoe(hit, s.vx / d, s.vy / d, 3);
      }
    });
    shots = shots.filter(s => s.life > 0);
  }

  function updateProjectiles(dt) {
    projectiles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (tileAt(Math.floor(p.x), Math.floor(p.y)) !== FLOOR) p.life = 0;
      if (p.life > 0 && !player.dead && Math.hypot(p.x - player.x, p.y - player.y) < 0.35) {
        p.life = 0;
        hurtPlayer(p.x - p.vx, p.y - p.vy);
      }
    });
    projectiles = projectiles.filter(p => p.life > 0);
  }

  function updatePickups() {
    pickups = pickups.filter(p => {
      if (player.dead || Math.hypot(p.x - player.x, p.y - player.y) > 0.6) return true;
      if (player.hp >= MAX_HP) return true;
      player.hp++;
      burst(p.x, p.y, 20, '#ff4d6d', 12, 2);
      floaters.push({ x: p.x, y: p.y, z: 60, text: '+1 heart', color: '#ff9aa8', life: 1.2, max: 1.2 });
      if (Math.random() < 0.5) wingsSay(pick(LINES.heart), 0);
      return false;
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

  function diamond(x, y, s, fill, stroke) {
    const pts = [iso(x, y - s), iso(x + s, y), iso(x, y + s), iso(x - s, y)];
    poly(pts, fill);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
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
      if (r.kind === 'plain' || !explored[idx(r.cx, r.cy)] || r.broken) return;
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

    if (portalOpen() && explored[idx(Math.floor(portal.x), Math.floor(portal.y))]) drawPortal();
    if (stairsDown && explored[idx(Math.floor(stairsDown.x), Math.floor(stairsDown.y))]) drawStairs(stairsDown, true);
    if (stairsUp && explored[idx(Math.floor(stairsUp.x), Math.floor(stairsUp.y))]) drawStairs(stairsUp, false);
  }

  function drawPortal() {
    const [sx, sy] = iso(portal.x, portal.y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    g.addColorStop(0, 'rgba(20,10,40,1)');
    g.addColorStop(0.7, 'rgba(120,80,220,0.7)');
    g.addColorStop(1, 'rgba(120,80,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c4a7ff';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = time * 40;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
    ctx.lineDashOffset = -time * 60;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawStairs(s, down) {
    const x = s.x, y = s.y;
    if (down) {
      diamond(x, y, 0.48, '#05040a', 'rgba(255,209,102,0.6)');
      for (let k = 1; k <= 3; k++) diamond(x, y + k * 0.06, 0.48 - k * 0.11, `rgba(60,55,80,${0.9 - k * 0.2})`);
      if (bossAlive) {
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 3;
        const a = iso(x - 0.35, y), b = iso(x + 0.35, y), c = iso(x, y - 0.35), d = iso(x, y + 0.35);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.moveTo(...c); ctx.lineTo(...d); ctx.stroke();
      }
    } else {
      diamond(x, y, 0.46, 'rgba(120,230,160,0.18)', 'rgba(120,230,160,0.6)');
      for (let k = 1; k <= 3; k++) diamond(x, y - k * 0.05, 0.4 - k * 0.1, `rgba(140,240,180,${0.15 + k * 0.1})`);
    }
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

  function drawShadow(x, y, rx, a = 0.45) {
    const [sx, sy] = iso(x, y);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawSprite(sheet, frame, fw, fh, scale, x, y, flip, filter) {
    if (sheet instanceof HTMLImageElement && (!sheet.complete || !sheet.naturalWidth)) return;
    const [sx, sy] = iso(x, y);
    const w = fw * scale, h = fh * scale;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    if (flip) ctx.scale(-1, 1);
    if (filter) ctx.filter = filter;
    ctx.drawImage(sheet, frame * fw, 0, fw, fh, -w / 2, -h + 4, w, h);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.dead) return;
    if (player.inv > 0 && Math.floor(player.inv * 12) % 2) return;
    drawShadow(player.x, player.y, 15);
    const frame = player.moving ? Math.floor(player.anim) % 3 : 3;
    drawSprite(heroCanvas, frame, HERO_W, HERO_H, 2.7, player.x, player.y, !player.faceRight);

    if (player.swing > 0) {
      const [sx, sy] = iso(player.x, player.y, 26);
      const ang = Math.atan2((player.fx + player.fy) * TH / 2, (player.fx - player.fy) * TW / 2);
      const w = weapon.ranged ? WEAPONS[0] : weapon;
      const p = 1 - player.swing / w.swing;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.6);
      ctx.strokeStyle = w.id === 'cleaver' ? `rgba(255,190,120,${0.9 * (1 - p)})` : `rgba(255,248,220,${0.9 * (1 - p)})`;
      ctx.lineWidth = w.id === 'cleaver' ? 11 : 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, w.radius, ang + w.sweep[0] + p * 0.6, ang + w.sweep[1] + p * 0.9);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFoe(e) {
    const def = e.def;
    const flash = e.flash > 0;
    const look = def.look;
    if (look === 'sprite') {
      drawShadow(e.x, e.y, 14);
      if (e.down > 0) {
        drawSprite(foeSheet, 0, 13, 24, 2.4, e.x, e.y, e.faceRight, 'grayscale(1) brightness(0.5) opacity(0.6)');
        return;
      }
      const bob = Math.abs(Math.sin(e.anim * 2)) * 3;
      const frame = Math.floor(e.anim) % 2;
      const filter = flash ? 'brightness(3.5)' : def.grey ? 'grayscale(0.9) brightness(0.85) hue-rotate(180deg)' : null;
      ctx.save();
      ctx.translate(0, -bob);
      drawSprite(foeSheet, frame, 13, 24, 2.4, e.x, e.y, e.faceRight, filter);
      ctx.restore();
      return;
    }

    const [sx, sy] = iso(e.x, e.y);
    const col = flash ? '#ffffff' : def.color;
    if (look === 'slime') {
      const size = def.small ? 0.6 : 1;
      drawShadow(e.x, e.y, 16 * size);
      const squash = 1 + Math.sin(e.anim * 3) * 0.12;
      const rx = 17 * size * squash, ry = 14 * size / squash;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(sx, sy - ry, rx, ry, 0, Math.PI, 0); ctx.lineTo(sx + rx, sy - 2); ctx.lineTo(sx - rx, sy - 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(sx - rx * 0.4, sy - ry * 1.4, rx * 0.2, ry * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10140f';
      const look = e.faceRight ? 3 : -3;
      ctx.fillRect(sx - 6 * size + look, sy - ry - 2, 3, 4);
      ctx.fillRect(sx + 3 * size + look, sy - ry - 2, 3, 4);
    } else if (look === 'dart') {
      drawShadow(e.x, e.y, 10);
      const ang = Math.atan2((e.vx + e.vy) * TH / 2, (e.vx - e.vy) * TW / 2);
      for (let k = e.dashing ? 3 : 0; k >= 0; k--) {
        ctx.save();
        ctx.translate(sx - Math.cos(ang) * k * 9, sy - 18 - Math.sin(ang) * k * 9);
        ctx.rotate(ang);
        ctx.globalAlpha = k ? 0.25 : 1;
        poly([[12, 0], [0, -7], [-9, 0], [0, 7]], col);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 20, 3, 3);
    } else if (look === 'orb') {
      const z = 26 + Math.sin(e.anim * 2) * 4;
      drawShadow(e.x, e.y, 10, 0.35);
      const g = ctx.createRadialGradient(sx, sy - z, 2, sx, sy - z, 18);
      g.addColorStop(0, flash ? '#ffffff' : '#fff1c1');
      g.addColorStop(0.45, col);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy - z, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,180,0.8)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const a = e.anim * 3 + k * 2.1;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 8, sy - z + Math.sin(a) * 8);
        ctx.lineTo(sx + Math.cos(a + 0.3) * 16, sy - z + Math.sin(a + 0.3) * 16);
        ctx.stroke();
      }
    } else if (look === 'ring') {
      const z = 34 + Math.sin(e.anim) * 4;
      drawShadow(e.x, e.y, 30, 0.5);
      ctx.save();
      ctx.translate(sx, sy - z);
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2 + e.anim * 1.5;
        ctx.fillStyle = k % 2 ? col : (flash ? '#ffffff' : '#e0d0ff');
        ctx.beginPath(); ctx.arc(Math.cos(a) * 30, Math.sin(a) * 15, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      text('∞', sx, sy - z + 9, 30, flash ? '#ffffff' : '#c4a7ff');
    }
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

  function drawPickup(p) {
    const [sx, sy] = iso(p.x, p.y, 18 + Math.sin(time * 3 + p.seed) * 4);
    drawShadow(p.x, p.y, 8, 0.3);
    drawHeart(sx - 7, sy - 6, true, 2);
  }

  function drawProjectile(p) {
    const [sx, sy] = iso(p.x, p.y, 24);
    const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, 9);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, p.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - 9, sy - 9, 18, 18);
  }

  function drawShot(s) {
    const [sx, sy] = iso(s.x, s.y, 26);
    const [tx, ty] = iso(s.x - s.vx * 0.04, s.y - s.vy * 0.04, 26);
    ctx.strokeStyle = 'rgba(127,227,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.fillStyle = '#e6fbff';
    ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 3, 6, 6);
    ctx.fillStyle = '#7fe3ff';
    ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);
  }

  function drawWorld() {
    const pDepth = player.x + player.y;
    const pDiag = player.x - player.y;
    const list = [];
    const seen = (x, y) => explored[idx(Math.floor(x), Math.floor(y))];

    for (let j = 0; j < MAP_H; j++) {
      for (let i = 0; i < MAP_W; i++) {
        const k = idx(i, j);
        if (tiles[k] !== WALL || !explored[k]) continue;
        const [sx, sy] = iso(i, j);
        if (sx < -TW || sx > W + TW || sy < -TH || sy > H + TH + WALL_H) continue;
        const d = i + j + 1;
        // Fade walls standing between the camera and the player
        const front = d > pDepth && d - pDepth < 3.2 && Math.abs(i - j - pDiag) < 1.6;
        list.push({ d, draw: () => drawWall(i, j, front ? 0.3 : 1) });
      }
    }
    torches.forEach(t => {
      if (explored[idx(t.wx, t.wy)]) list.push({ d: t.wx + t.wy + 1.01, draw: () => drawTorch(t) });
    });
    props.forEach(p => {
      if (seen(p.x, p.y)) list.push({ d: p.x + p.y, draw: () => drawProp(p) });
    });
    rooms.forEach(r => {
      if (r.kind === 'plain' || !explored[idx(r.cx, r.cy)]) return;
      if (r.kind === 'chest') list.push({ d: chest.x + chest.y, draw: drawChest });
      else if (r.broken) list.push({ d: r.cx + r.cy, draw: () => drawShrine(r) });
      else list.push({ d: r.cx + r.cy + 1, draw: () => drawShrine(r) });
    });
    pickups.forEach(p => { if (seen(p.x, p.y)) list.push({ d: p.x + p.y, draw: () => drawPickup(p) }); });
    enemies.forEach(e => { if (seen(e.x, e.y)) list.push({ d: e.x + e.y, draw: () => drawFoe(e) }); });
    projectiles.forEach(p => list.push({ d: p.x + p.y, draw: () => drawProjectile(p) }));
    shots.forEach(s => list.push({ d: s.x + s.y, draw: () => drawShot(s) }));
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
    fctx.fillStyle = mode === 'endless' ? 'rgba(3,2,8,0.84)' : 'rgba(4,3,10,0.76)';
    fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = 'destination-out';

    const [px, py] = iso(player.x, player.y, 30);
    light(fctx, px, py, 320 + Math.sin(time * 9) * 6, 1);
    torches.forEach(t => {
      if (!explored[idx(t.wx, t.wy)]) return;
      const [sx, sy] = iso(t.x, t.y, WALL_H * 0.5);
      light(fctx, sx, sy, 170 + Math.sin(time * 13 + t.seed) * 8, 0.85);
    });
    const glows = [];
    rooms.forEach(r => {
      if (r.kind === 'plain' || !explored[idx(r.cx, r.cy)]) return;
      const [sx, sy] = iso(r.cx + 0.5, r.cy + 0.5, 40);
      light(fctx, sx, sy, r.broken ? 90 : 150, r.broken ? 0.4 : 0.75);
      glows.push([sx, sy - 10, 120, rgb(r.rgb, 0.12)]);
    });
    [portalOpen() && portal, stairsDown, stairsUp].forEach(s => {
      if (!s || !explored[idx(Math.floor(s.x), Math.floor(s.y))]) return;
      const [sx, sy] = iso(s.x, s.y, 20);
      light(fctx, sx, sy, 140, 0.7);
      glows.push([sx, sy, 110, s === stairsUp ? 'rgba(120,230,160,0.12)' : s === stairsDown ? 'rgba(255,209,102,0.12)' : 'rgba(160,110,255,0.2)']);
    });
    projectiles.concat(shots).forEach(p => {
      const [sx, sy] = iso(p.x, p.y, 24);
      light(fctx, sx, sy, 50, 0.6);
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
    glows.forEach(g => glow(...g));
    ctx.globalCompositeOperation = 'source-over';

    // Vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function text(str, x, y, size, color, align = 'center', font = 'Silkscreen') {
    ctx.font = `${size}px '${font}', monospace`;
    ctx.textAlign = align;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function prompt(s, label) {
    const [sx, sy] = iso(s.x, s.y, 70);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 6);
    text(label, sx, sy, 12, '#ffffff');
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    rooms.forEach(r => {
      if (r.kind === 'plain' || !explored[idx(r.cx, r.cy)]) return;
      const [sx, sy] = iso(r.cx + 0.5, r.cy + 0.5, 110 + Math.sin(time * 2 + r.n) * 3);
      text(r.label.toUpperCase(), sx, sy, 15, r.color);
    });
    const near = !player.dead && !paused && shrineInReach();
    if (near) {
      const [sx, sy] = iso(near.cx + 0.5, near.cy + 0.5, 135);
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 6);
      text(near.kind === 'chest' ? 'SPACE - OPEN THE CHEST' : 'SPACE - STRIKE THE SHRINE', sx, sy, 12, '#ffffff');
      ctx.globalAlpha = 1;
    }
    const close = s => s && explored[idx(Math.floor(s.x), Math.floor(s.y))] && Math.hypot(s.x - player.x, s.y - player.y) < 3;
    if (portalOpen() && close(portal)) prompt(portal, runActive ? 'RESUME THE DEPTHS' : 'THE ENDLESS DEPTHS');
    if (close(stairsDown)) prompt(stairsDown, bossAlive ? 'LOCKED - DEFEAT THE LOOP' : 'STAIRS DOWN');
    if (close(stairsUp)) prompt(stairsUp, depth > 1 ? `UP TO DEPTH ${depth - 1}` : 'BACK TO THE SURFACE');

    enemies.forEach(e => {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (e.def.boss || d > 4.5 || e.down > 0 || !explored[idx(Math.floor(e.x), Math.floor(e.y))]) return;
      const lift = e.def.look === 'orb' ? 96 : 70;
      const [sx, sy] = iso(e.x, e.y, lift);
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
    drawWings();
  }

  // Wings: a little pixel bat, drawn above the lighting so it is always visible
  function drawWings() {
    if (wings.state === 'away') return;
    const [gx, gy] = iso(wings.x, wings.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(gx, gy, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

    const [sx, sy] = iso(wings.x, wings.y, wings.z);
    const f = Math.sin(wings.flap);
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    if (!wings.faceRight) ctx.scale(-1, 1);
    ctx.fillStyle = '#2b1d3a';
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(side * 4, -3);
      ctx.lineTo(side * 14, -11 - f * 7);
      ctx.lineTo(side * 22, -5 - f * 9);
      ctx.lineTo(side * 18, 1 - f * 4);
      ctx.lineTo(side * 13, -1 - f * 2);
      ctx.lineTo(side * 9, 3);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = '#3b2a52';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a4378';
    ctx.beginPath(); ctx.ellipse(1, 2, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    poly([[-6, -5], [-4, -13], [-1, -6]], '#3b2a52');
    poly([[1, -6], [4, -13], [6, -5]], '#3b2a52');
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-4, -3, 2, 2);
    ctx.fillRect(2, -3, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 2, 1, 2);
    ctx.restore();

    if (wings.msg) drawBubble(sx, sy - 16, wings.msg, Math.min(1, wings.msgLife * 3, (wings.msgMax - wings.msgLife) * 6), wings.item);
    else bubbleBox = null;
  }

  function wrap(str, maxW) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else { line = test; }
    });
    if (line) lines.push(line);
    return lines;
  }

  // Where the current bubble is on screen, so a linked one can be clicked
  let bubbleBox = null;
  let bubbleHover = false;

  function drawBubble(x, y, msg, alpha, item) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = "13px 'Kode', monospace";
    const lines = wrap(msg, 270);
    const lh = 17;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width), item ? 150 : 0) + 22;
    const h = lines.length * lh + 30 + (item ? 18 : 0);
    let bx = Math.max(10, Math.min(W - w - 10, x - w / 2));
    const by = Math.max(10, y - h - 10);
    ctx.fillStyle = item && bubbleHover ? '#fffaf0' : '#f4efe2';
    ctx.strokeStyle = item && bubbleHover ? '#7b4fc4' : '#2b1d3a';
    ctx.lineWidth = item && bubbleHover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, w, h, 8) : ctx.rect(bx, by, w, h);
    ctx.fill();
    ctx.stroke();
    const tx = Math.max(bx + 12, Math.min(bx + w - 12, x));
    if (by + h < y) {
      ctx.beginPath();
      ctx.moveTo(tx - 6, by + h - 1); ctx.lineTo(tx, by + h + 8); ctx.lineTo(tx + 6, by + h - 1);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7b4fc4';
    ctx.font = "10px 'Silkscreen', monospace";
    ctx.fillText('WINGS', bx + 11, by + 15);
    ctx.fillStyle = '#1a1520';
    ctx.font = "13px 'Kode', monospace";
    lines.forEach((l, k) => ctx.fillText(l, bx + 11, by + 32 + k * lh));
    if (item) {
      ctx.fillStyle = '#7b4fc4';
      ctx.font = "10px 'Silkscreen', monospace";
      ctx.fillText('> CLICK TO READ', bx + 11, by + h - 9);
    }
    const m = ctx.getTransform();
    bubbleBox = item ? { x: bx + m.e / dpr, y: by + m.f / dpr, w, h, item } : null;
    ctx.restore();
  }

  const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  function drawHeart(x, y, full, s = 3) {
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
    const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * s - 1, oy + y * s - 1, s + 2, s + 2); };
    rooms.forEach(r => {
      if (r.kind === 'plain' || !explored[idx(r.cx, r.cy)]) return;
      dot(r.cx, r.cy, r.read ? r.color : '#ffffff');
    });
    [[portalOpen() && portal, '#c4a7ff'], [stairsDown, '#ffd166'], [stairsUp, '#7ee6a0']].forEach(([p, c]) => {
      if (p && explored[idx(Math.floor(p.x), Math.floor(p.y))]) dot(Math.floor(p.x), Math.floor(p.y), c);
    });
    if (Math.floor(time * 3) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox + player.x * s, oy + player.y * s, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // How much of the (pretend) heap the cached floors are using
  function drawMemoryGauge(x, y) {
    const used = heapUsed();
    const frac = Math.min(1, used / HEAP_LIMIT);
    const w = 150;
    text('HEAP', x, y + 9, 11, '#b8b2c9', 'left');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x + 40, y, w, 11);
    ctx.fillStyle = frac > 0.85 ? '#ff4d6d' : frac > 0.6 ? '#ffb347' : '#7ee6a0';
    ctx.fillRect(x + 42, y + 2, (w - 4) * frac, 7);
    // One tick per cached floor
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    let acc = 0;
    floors.forEach(snap => {
      acc += floorBytes(snap);
      const tx = x + 42 + (w - 4) * Math.min(1, acc / HEAP_LIMIT);
      ctx.fillRect(Math.round(tx), y + 2, 1, 7);
    });
    text(`${Math.round(used / 1024)} / ${HEAP_LIMIT / 1024} KB  -  ${floors.size} FLOOR${floors.size === 1 ? '' : 'S'} CACHED`, x, y + 26, 10, '#8f8aa3', 'left');
  }

  function drawWeaponBar() {
    const size = 34, gap = 6;
    const x0 = 18, y0 = H - size - 18;
    WEAPONS.forEach((w, i) => {
      const x = x0 + i * (size + gap);
      const on = w === weapon;
      ctx.fillStyle = on ? 'rgba(255,209,102,0.18)' : 'rgba(8,7,14,0.7)';
      ctx.fillRect(x, y0, size, size);
      ctx.strokeStyle = on ? '#ffd166' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y0 + 1, size - 2, size - 2);
      const cx = x + size / 2, cy = y0 + size / 2;
      ctx.strokeStyle = on ? '#fff3cf' : '#b8b2c9';
      ctx.fillStyle = on ? '#fff3cf' : '#b8b2c9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (w.id === 'sword') {
        ctx.moveTo(cx - 8, cy + 8); ctx.lineTo(cx + 8, cy - 8);
        ctx.moveTo(cx - 9, cy + 3); ctx.lineTo(cx - 3, cy + 9);
        ctx.stroke();
      } else if (w.id === 'cleaver') {
        ctx.arc(cx, cy + 6, 11, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.fillRect(cx - 1, cy - 2, 3, 11);
      } else {
        ctx.fillRect(cx - 9, cy - 4, 14, 6);
        ctx.fillRect(cx - 7, cy + 2, 4, 6);
        ctx.fillStyle = '#7fe3ff';
        ctx.fillRect(cx + 6, cy - 3, 4, 4);
      }
      text(String(i + 1), x + 6, y0 + 12, 10, on ? '#ffd166' : '#8f8aa3', 'left');
    });
    text(weapon.name.toUpperCase(), x0 + WEAPONS.length * (size + gap) + 4, y0 + size / 2 + 5, 12, '#ffd166', 'left');
  }

  function drawHud() {
    drawWeaponBar();
    for (let i = 0; i < MAX_HP; i++) drawHeart(18 + i * 26, 18, i < player.hp);
    if (mode === 'story') {
      const read = rooms.filter(r => r.read && r.kind === 'shrine').length;
      text(`LORE ${read}/${rooms.length - 1}`, 18, 58, 14, '#f2e6d0', 'left');
      text(`BUGS SQUASHED ${kills}`, 18, 78, 14, '#9be35a', 'left');
    } else {
      text(`DEPTH ${depth}`, 18, 60, 18, '#c4a7ff', 'left');
      text(`BEST ${save.best}`, 18, 80, 13, '#f2e6d0', 'left');
      text(`BUGS THIS RUN ${runKills}`, 18, 99, 13, '#9be35a', 'left');
      drawMemoryGauge(18, 112);
      const boss = enemies.find(e => e.def.boss);
      if (boss) {
        const bw = Math.min(360, W * 0.4);
        text(boss.name.toUpperCase(), W / 2, 30, 14, '#c4a7ff');
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(W / 2 - bw / 2, 38, bw, 10);
        ctx.fillStyle = '#a77bff';
        ctx.fillRect(W / 2 - bw / 2 + 2, 40, (bw - 4) * Math.max(0, boss.hp) / boss.maxHp, 6);
      }
    }
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
      text('WASD / ARROWS TO MOVE  -  SPACE TO ATTACK  -  1-3 / Q TO SWITCH WEAPON  -  CLICK TO WALK', W / 2, H - 70, 13, '#d8cfb8');
      ctx.globalAlpha = 1;
    }

    if (player.dead) {
      const a = Math.min(1, (2.6 - player.dead) * 1.5);
      ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a;
      text('YOU DIED', W / 2, H / 2, 54, '#b3122e');
      text(mode === 'endless' ? `Reached depth ${depth}. Back to the surface...` : 'Respawning at the Entrance Hall...', W / 2, H / 2 + 36, 14, '#d8cfb8');
      ctx.globalAlpha = 1;
    }

    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
      ctx.fillRect(0, 0, W, H);
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
      if (!paused && !wardrobeOpen) update(dt);
      render();
    }
    requestAnimationFrame(frame);
  }

  const GAME_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'j', '1', '2', '3', 'q'];
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  document.addEventListener('keydown', e => {
    if (typing(e) || !canvas.clientWidth) return;
    const k = e.key.toLowerCase();
    if (wardrobeOpen) {
      if (k === 'escape') { e.preventDefault(); closeWardrobe(); }
      return;
    }
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
    if (['1', '2', '3'].includes(k)) setWeapon(Number(k) - 1);
    if (k === 'q' && !e.repeat) setWeapon(WEAPONS.indexOf(weapon) + 1);
  });
  document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach(k => { keys[k] = false; }); });

  const overBubble = e => {
    if (!bubbleBox) return false;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    return x >= bubbleBox.x && x <= bubbleBox.x + bubbleBox.w && y >= bubbleBox.y && y <= bubbleBox.y + bubbleBox.h;
  };

  canvas.addEventListener('pointermove', e => {
    bubbleHover = overBubble(e);
    canvas.style.cursor = bubbleHover ? 'pointer' : '';
  });

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    if (overBubble(e)) { showNewsCard(bubbleBox.item); return; }
    if (player.dead || paused) return;
    lastInput = time;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left + cam.x - W / 2;
    const my = e.clientY - rect.top + cam.y - H / 2;
    const a = mx / (TW / 2), b = my / (TH / 2);
    const wx = (a + b) / 2, wy = (b - a) / 2;

    // Clicking a foe swings at it when it is in reach, or shoots it with the blaster
    const foe = enemies.find(o => hittable(o) && Math.hypot(o.x - wx, o.y - wy) < 0.9 + o.r);
    const foeDist = foe ? Math.hypot(foe.x - player.x, foe.y - player.y) : Infinity;
    if (foe && (weapon.ranged ? foeDist < weapon.range : foeDist < weapon.reach + 0.3 + foe.r)) { attack(foe); return; }

    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (!inBounds(tx, ty) || !explored[idx(tx, ty)]) return;
    const t = tiles[idx(tx, ty)];
    const shrine = mode === 'story' && rooms.find(r => r.cx === tx && r.cy === ty && isIntact(r));
    if (shrine) {
      if (shrineInReach() === shrine) attack();
      else { walkTo(tx, ty, false); strikeOnArrive = shrine; }
    } else if (t === FLOOR) walkTo(tx, ty, true);
    else if (t === PROP) walkTo(tx, ty, false);
  });

  overlayClose.addEventListener('click', closeLore);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closeLore(); });

  wingsToggle.addEventListener('change', () => {
    save.wingsMuted = !wingsToggle.checked;
    persist();
    if (!save.wingsMuted) wingsSay('Oh, I see how it is. You missed me.', 3);
    canvas.focus({ preventScroll: true });
  });
  // Once the key is found, skip straight to the portal or play the story again
  teleportButton.addEventListener('click', () => {
    if (paused || player.dead) return;
    if (mode === 'endless') {
      leaveEndless(false);
    } else {
      placePlayer(portal.x + 1, portal.y);
      path = null; repath = 0; strikeOnArrive = null;
      fade = 1;
      wingsSay('Shortcut taken. The portal is right there. Try not to fall in. Actually, do.', 2);
    }
    canvas.focus({ preventScroll: true });
  });

  replayButton.addEventListener('click', () => {
    if (paused || player.dead) return;
    if (!window.confirm('Play the story again from the Entrance Hall? Your key, best depth and Wings stay.')) return;
    Object.assign(save, { read: [], broken: [], chest: false, explored: '', kills: 0 });
    kills = 0;
    persist();
    buildStory();
    player.hp = MAX_HP;
    fade = 1;
    time = 0;
    renderCodex();
    wingsSay('From the top? Bold. I will pretend I have not seen this bit before.', 3);
    canvas.focus({ preventScroll: true });
  });

  wardrobeButton.addEventListener('click', () => openWardrobe(false));
  document.getElementById('wardrobeDone').addEventListener('click', closeWardrobe);
  document.getElementById('wardrobeRandom').addEventListener('click', randomLook);
  document.getElementById('wardrobeReset').addEventListener('click', () => {
    draftLook = { ...DEFAULT_LOOK };
    renderWardrobe();
    previewStart = performance.now();
  });
  wardrobe.addEventListener('pointerdown', e => { if (e.target === wardrobe) closeWardrobe(); });

  newsCard.querySelector('.news-close').addEventListener('click', () => {
    hideNewsCard();
    canvas.focus({ preventScroll: true });
  });

  resetButton.addEventListener('click', () => {
    if (!window.confirm('Reset your TechJourney progress? This clears read chapters, the key and your best depth.')) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
    window.location.reload();
  });

  // Phones, tablets and touch screens get the text version instead (see style.css)
  const textOnly = window.matchMedia('(max-width: 1032px), (hover: none) and (pointer: coarse)');
  let started = false;
  function start() {
    if (started || textOnly.matches) return;
    started = true;
    fetch('rooms.json')
      .then(r => r.json())
      .then(data => {
        storyData = data;
        buildStory();
        renderCodex();
        resize();
        if (save.key) {
          ensureNews();
          wings.next = 6;
        }
        requestAnimationFrame(frame);
      });
  }
  textOnly.addEventListener('change', start);
  start();
})();
