// Me page: the profile circle is a tiny pixel world where the TechJourney hero
// goes about his day (coffee, coding, gaming, football, basketball), standing up
// and walking into the next room between activities. Also fills in the level /
// XP bar, where the level is my age and XP fills up towards the next birthday.
(() => {
  'use strict';

  // ---------- Level & XP ----------
  const xpFill = document.getElementById('xpFill');
  const xpBar = document.getElementById('xpBar');
  const xpLabel = document.getElementById('xpLabel');
  if (xpFill && typeof currentAge === 'function') {
    const now = new Date();
    const age = currentAge(now);
    const last = birthdayIn(1986 + age);
    const next = birthdayIn(1986 + age + 1);
    const pct = Math.round((now - last) / (next - last) * 100);
    const days = Math.ceil((next - now) / 86400000);
    xpFill.style.width = `${pct}%`;
    xpBar.setAttribute('aria-valuenow', pct);
    xpLabel.textContent = `${days} day${days === 1 ? '' : 's'} to LVL ${age + 1}`;
  }

  const canvas = document.getElementById('heroIdle');
  const button = document.getElementById('heroButton');
  const bubble = document.getElementById('heroBubble');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Each room is 48x36 pixels; the circle shows a 52x52 window onto it
  const W = 48, FLOOR = 33;
  const VIEW = 52, OFF_X = 2, OFF_Y = 10;

  // ---------- Pixel helpers ----------

  // Palette taken from img/player.png (the TechJourney hero)
  const PAL = {
    A: '#432e27', B: '#6a4834', C: '#171717', D: '#bfa787', E: '#e8d4b2',
    F: '#c43c3c', G: '#882e2e', H: '#f8f8f8', I: '#65659b', J: '#5586b9'
  };

  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = PAL[c] || c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const px = (x, y, c) => rect(x, y, 1, 1, c);

  function line(x0, y0, x1, y1, f) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    const n = Math.max(dx, -dy);
    let err = dx + dy, i = 0;
    for (;;) {
      f(x0, y0, i++, n);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Tiny 3x5 glyphs for floating text
  const GLYPHS = {
    '+': ['...', '.#.', '###', '.#.', '...'],
    '2': ['##.', '..#', '.#.', '#..', '###'],
    '!': ['.#.', '.#.', '.#.', '...', '.#.']
  };
  function glyphs(str, x, y, c) {
    [...str].forEach((ch, k) => {
      GLYPHS[ch].forEach((row, r) => {
        [...row].forEach((v, col) => { if (v === '#') px(x + k * 4 + col, y + r, c); });
      });
    });
  }

  // ---------- The hero ----------

  // Idle frame of img/player.png, split into parts so poses can be rebuilt.
  // Rows 0-12 head, 13-17 torso (arm removed), 18-20 legs.
  const HEAD = [
    '.............', '.........A...', '....AAAAABC..', '..AABBBBBCC..', '.ABBBBBBBBBC.',
    '.ABBBBBBAAAC.', 'ABBBBBAADDDAC', 'ABBBBADDEEEDC', 'ABBBAAEEEEEEC', 'CABBADEECEEEC',
    '.CAAADEECEEC.', '.CDAADEEEEEC.', '..CDDDDEEEC..'
  ];
  const TORSO = ['...CCGFDCC...', '...CGFFFC....', '..CCFFFFC....', '..CCAAAACC...', '...CGGGGCC...'];
  const HANGING_ARM = [[8, 14, 'D'], [9, 14, 'E'], [10, 14, 'C'], [8, 15, 'E'], [9, 15, 'E'], [10, 15, 'C']];
  const LEGS = ['..CAIICCAAC..', '..CAACCCAAC..', '...CC...CC...'];
  const SHOULDER = [8, 14];

  function rows(list, x, y, keep = () => true) {
    list.forEach((row, r) => {
      [...row].forEach((c, col) => { if (c !== '.' && keep(col)) px(x + col, y + r, c); });
    });
  }

  function armOutline(x, y, from, to) {
    line(x + from[0], y + from[1], x + to[0], y + to[1], (a, b) => rect(a - 1, b - 1, 3, 3, 'C'));
    rect(x + to[0] - 1, y + to[1] - 1, 4, 4, 'C');
  }

  function armFill(x, y, from, to, skin) {
    line(x + from[0], y + from[1], x + to[0], y + to[1], (a, b, i, n) => px(a, b, i < Math.max(1, n * 0.35) ? 'F' : skin));
    rect(x + to[0], y + to[1], 2, 2, skin);
  }

  function sittingLegs(x, y, footY) {
    rect(x + 2, y + 17, 10, 4, 'C');
    rect(x + 3, y + 18, 8, 2, 'I');
    rect(x + 8, y + 20, 4, footY - y - 19, 'C');
    rect(x + 9, y + 20, 2, footY - y - 20, 'I');
    rect(x + 8, footY - 1, 6, 2, 'C');
    rect(x + 9, footY - 1, 4, 1, 'A');
  }

  // x, y: top-left of the 13x21 sprite. hand / back: arm targets in sprite space.
  // legs: stand | sit | kick | walk0 | walk1
  function hero(o) {
    const { x, y, bob = 0, eyes = 'open', flip = false, legs = 'stand', hand = null, back = null, footY = 32 } = o;
    ctx.save();
    if (flip) { ctx.translate(x * 2 + 13, 0); ctx.scale(-1, 1); }

    if (back) {
      armOutline(x, y, [7, 14], back);
      armFill(x, y, [7, 14], back, 'D');
    }
    if (hand) armOutline(x, y, SHOULDER, hand);

    if (legs === 'sit') {
      sittingLegs(x, y, footY);
    } else {
      const kick = legs === 'kick', w0 = legs === 'walk0', w1 = legs === 'walk1';
      rows(LEGS, x - (w0 ? 1 : 0), y + 18 - (w1 ? 1 : 0), col => col <= 6);
      rows(LEGS, x + (kick || w0 ? 1 : 0), y + 18 - (kick ? 2 : w0 ? 1 : 0), col => col >= 7);
    }
    rows(TORSO, x, y + 13);
    if (!hand) HANGING_ARM.forEach(([ax, ay, c]) => px(x + ax, y + ay, c));
    rows(HEAD, x, y + bob);
    if (eyes === 'closed' || eyes === 'blink') px(x + 8, y + 9 + bob, 'E');
    if (hand) armFill(x, y, SHOULDER, hand, 'E');

    ctx.restore();
  }

  function shadow(x, w) {
    rect(x, FLOOR, w, 1, 'rgba(0,0,0,0.35)');
  }

  // Rooms paint a little past their 48px so the circle never shows a gap
  function room(wall, floor, floorHi) {
    rect(-2, -OFF_Y - 2, W + 4, FLOOR + OFF_Y + 2, wall);
    rect(-2, FLOOR, W + 4, 24, floor);
    rect(-2, FLOOR, W + 4, 1, floorHi);
  }

  // ---------- Props ----------

  function mug(x, y, full, steamT) {
    rect(x - 1, y - 1, 5, 5, 'C');
    px(x + 4, y + 1, 'C');
    rect(x, y, 3, 3, 'H');
    px(x + 3, y + 1, 'H');
    if (full) rect(x, y, 3, 1, 'A');
    if (steamT !== undefined) {
      for (let k = 0; k < 2; k++) {
        const rise = (steamT * 3 + k * 1.7) % 4;
        const sx = x + 1 + k + Math.round(Math.sin(steamT * 4 + k * 2));
        px(sx, y - 2 - rise, `rgba(255,255,255,${0.55 - rise * 0.12})`);
      }
    }
  }

  function plant(x, sway) {
    const leaves = '#4f9e4f', dark = '#2f6b34';
    rect(x + sway, 20, 1, 8, dark);
    rect(x - 3 + sway, 21, 3, 2, leaves);
    rect(x + 1 + sway, 19, 3, 2, leaves);
    rect(x - 2, 24, 2, 2, leaves);
    rect(x + 1, 23, 3, 2, dark);
    rect(x - 3, 27, 7, 1, '#7a3b1f');
    rect(x - 2, 28, 5, 5, '#a0522d');
  }

  function ball(x, y, spin, color, seam) {
    rect(x, y + 1, 4, 2, color);
    rect(x + 1, y, 2, 4, color);
    const f = Math.floor(spin) % 2;
    px(x + 1 + f, y + 1, seam);
    px(x + 2 - f, y + 2, seam);
  }

  // Door frame between two rooms, seen while walking through
  function doorway(x) {
    rect(x - 2, -OFF_Y - 2, 4, FLOOR + OFF_Y + 2, '#0e0f13');
    rect(x - 1, -OFF_Y - 2, 2, FLOOR + OFF_Y + 2, '#2a2b35');
  }

  // ---------- Scenes ----------
  // Each scene has a background (bg) and the hero doing his thing (act).
  // x is where he stands when he walks in or out.

  const scenes = [
    {
      id: 'idle', x: 17,
      lines: ['Hallo! Hi! 👋', 'Fancy a dungeon? Try TechJourney.', 'Two cats, zero bugs. Mostly.'],
      bg(t) {
        room('#1c1f26', '#2a2d36', '#3a3e4a');
        rect(6, 8, 9, 7, '#2b303b');
        rect(7, 9, 7, 5, '#3b4a63');
        px(9, 10, '#ffd166');
        plant(40, Math.floor(t * 0.8) % 2);
      },
      act(t, s) {
        shadow(19, 9);
        const glance = (t % 9) > 6.5 && (t % 9) < 7.8;
        hero({ x: 17, y: 12 + s.hop, bob: Math.floor(t / 0.65) % 2, eyes: s.eyes, flip: glance });
      }
    },
    {
      id: 'coffee', x: 13,
      lines: ['Coffee first. ☕', 'Perfect shot. 9 bar, ~28 seconds.', 'Ahh. Now we can talk.'],
      bg(t) {
        room('#231d1b', '#3a2c24', '#4a3a30');
        rect(31, 23, 17, 10, '#5a3d2b');
        rect(31, 23, 17, 1, PAL.D);
        rect(34, 11, 11, 12, '#8c939c');
        rect(34, 11, 11, 2, '#5d636b');
        rect(36, 17, 6, 1, '#2a2b35');
        rect(38, 18, 2, 1, '#2a2b35');
        px(42, 14, Math.floor(t * 2) % 2 ? '#ff4d4d' : '#6b1f1f');
        rect(35, 22, 9, 1, '#5d636b');
        if ((t % 2.4) < 1.2) px(39, 19 + Math.floor((t % 1.2) * 2.5), '#6b4226');
      },
      act(t, s) {
        const T = 4.6, p = t % T;
        const rest = [11, 16], sip = [9, 11];
        let k = 0;
        if (p > 2.2 && p < 2.6) k = (p - 2.2) / 0.4;
        else if (p >= 2.6 && p < 3.6) k = 1;
        else if (p >= 3.6 && p < 4.0) k = 1 - (p - 3.6) / 0.4;
        const hand = [Math.round(rest[0] + (sip[0] - rest[0]) * k), Math.round(rest[1] + (sip[1] - rest[1]) * k)];
        const x = 13, y = 12 + s.hop;
        shadow(15, 9);
        hero({ x, y, bob: k ? 0 : Math.floor(t / 0.65) % 2, eyes: k === 1 ? 'closed' : s.eyes, hand });
        mug(x + hand[0] + 1, y + hand[1] - 2, true, k ? undefined : t);
      }
    },
    {
      id: 'coding', x: 10,
      lines: ['terraform plan: no changes.', 'Pipeline is green!', 'dbt run... done!'],
      init(st) { st.code = [{ len: 0, max: 6, indent: 0, color: '#c792ea' }]; st.acc = 0; },
      bg(t, st) {
        room('#161b22', '#4a3527', '#5c4433');
        rect(30, 5, 16, 13, '#0b0b0f');
        rect(31, 6, 14, 11, '#0d1a12');
        rect(37, 18, 2, 3, '#3a3d46');
        rect(35, 20, 6, 1, '#3a3d46');
        rect(22, 21, 26, 2, '#7a5236');
        rect(22, 21, 26, 1, '#9a6a46');
        rect(24, 23, 2, 10, '#5a3d2b');
        rect(45, 23, 2, 10, '#5a3d2b');
        rect(23, 20, 7, 1, '#3a3d46');
        mug(42, 18, true, t);
        st.code.forEach((l, i) => rect(32 + l.indent, 7 + i * 2, l.len, 1, l.color));
        if (Math.floor(t * 3) % 2) {
          const l = st.code[st.code.length - 1];
          px(32 + l.indent + l.len, 7 + (st.code.length - 1) * 2, '#ffffff');
        }
        // Office chair
        rect(7, 13, 2, 14, '#2a2b35');
        rect(9, 26, 11, 2, '#2a2b35');
        rect(13, 28, 2, 4, '#5d636b');
        rect(10, 32, 8, 1, '#5d636b');
        px(10, 32, PAL.C); px(17, 32, PAL.C);
      },
      act(t, s, st, dt) {
        const typing = (t % 3.8) < 2.6;
        if (typing) {
          st.acc += dt;
          while (st.acc > 0.11) {
            st.acc -= 0.11;
            const cur = st.code[st.code.length - 1];
            if (++cur.len >= cur.max) {
              const colors = ['#c792ea', '#82aaff', '#ffcb6b', '#7fd1b9', '#f07178'];
              st.code.push({
                len: 0, max: 3 + Math.floor(Math.random() * 7),
                indent: Math.floor(Math.random() * 3), color: colors[Math.floor(Math.random() * colors.length)]
              });
              if (st.code.length > 5) st.code.shift();
            }
          }
        }
        const tap = typing ? Math.floor(t * 9) % 2 : 0;
        hero({
          x: 10, y: 7 + s.hop, legs: 'sit', footY: 32,
          bob: typing ? 0 : Math.floor(t / 0.65) % 2, eyes: s.eyes,
          hand: [15, 12 - tap], back: [13, 12 - (typing ? 1 - tap : 0)]
        });
        rect(-2, -OFF_Y - 2, W + 4, 60, `rgba(120,200,160,${0.03 + 0.02 * Math.sin(t * 7)})`);
      }
    },
    {
      id: 'gaming', x: 6,
      lines: ['One more level.', 'Who paused it?!', 'Fancy a dungeon? Try TechJourney.'],
      bg(t) {
        room('#1a1626', '#3b2f4a', '#4a3c5c');
        rect(32, 27, 15, 6, '#5a3d2b');
        rect(32, 27, 15, 1, '#7a5236');
        rect(31, 12, 16, 14, '#0b0b0f');
        rect(32, 13, 14, 12, '#10203a');
        [[34, 15], [40, 14], [44, 17], [37, 18]].forEach(([sx, sy]) => px(sx, sy, '#3b5a8a'));
        rect(32, 23, 14, 2, '#2f6b34');
        const P = 1.6, f = (t % P) / P;
        const obX = Math.round(45 - f * 13);
        if (obX >= 32) rect(obX, 21, 2, 2, '#f07178');
        const js = Math.min(1, Math.max(0, (f - 0.62) / 0.3));
        rect(35, 21 - Math.round(4 * Math.sin(Math.PI * js)), 2, 2, '#ffd166');
        if (Math.floor(t / P) % 4 === 3 && f > 0.85) rect(32, 13, 14, 12, 'rgba(255,209,102,0.25)');
        // Couch
        rect(1, 13, 5, 17, '#6b3b5a');
        rect(1, 13, 5, 1, '#8e5279');
        rect(3, 27, 19, 4, '#7c4669');
        rect(3, 27, 19, 1, '#8e5279');
        rect(19, 23, 4, 8, '#6b3b5a');
        rect(19, 23, 4, 1, '#8e5279');
        rect(2, 31, 21, 1, '#4a2840');
        px(3, 32, PAL.C); px(21, 32, PAL.C);
      },
      act(t, s) {
        const P = 1.6, f = (t % P) / P;
        const press = f > 0.6 && f < 0.7;
        const win = Math.floor(t / P) % 4 === 3 && f > 0.85;
        const x = 5, y = 7 + s.hop + (win ? -1 : 0);
        const hand = [11, 14 + (press ? 1 : 0)];
        hero({ x, y, legs: 'sit', footY: 32, bob: Math.floor(t / 0.65) % 2, eyes: s.eyes, hand, back: [10, 15] });
        const cx = x + hand[0] - 1, cy = y + hand[1] - 1;
        rect(cx - 1, cy - 1, 6, 4, PAL.C);
        rect(cx, cy, 4, 2, '#3a3d46');
        px(cx + 3, cy, press ? '#7fd1b9' : '#2f6b34');
        px(cx + 2, cy + 1, '#a33');
        if (win) glyphs('!', x + 5, y - 6, '#ffd166');
        rect(-2, -OFF_Y - 2, W + 4, 60, `rgba(90,140,255,${0.04 + 0.03 * Math.sin(t * 13)})`);
      }
    },
    {
      id: 'football', x: 12,
      lines: ['Keep it up!', 'Sunday league legs.', 'Top bins! ⚽'],
      bg(t) {
        room('#0f1a2e', '#2f6b34', '#3f8a45');
        [[4, -4], [11, 9], [20, -6], [29, 7], [43, 4], [36, -2], [16, 2]].forEach(([sx, sy], k) => {
          if (Math.floor(t * 1.5 + k) % 5) px(sx, sy, '#c8d3e8');
        });
        for (let gx = -2; gx < W + 2; gx += 8) rect(gx, FLOOR + 1, 4, 2, '#357a3b');
        for (let ny = 22; ny < 33; ny += 2) for (let nx = 39; nx < 46; nx += 2) px(nx, ny, '#7d8799');
        rect(38, 20, 9, 1, 'H');
        rect(38, 20, 1, 13, 'H');
        rect(46, 20, 1, 13, 'H');
      },
      act(t, s) {
        const P = 0.8, n = Math.floor(t / P), u = (t % P) / P;
        const high = n % 5 === 4;
        const top = 26 - (high ? 20 : 10) * 4 * u * (1 - u);
        const kick = u < 0.14 || u > 0.86;
        shadow(14, 9);
        rect(23, FLOOR, 4 - Math.round((26 - top) / 10), 1, 'rgba(0,0,0,0.3)');
        hero({ x: 12, y: 12 + s.hop, legs: kick ? 'kick' : 'stand', bob: high && u > 0.3 && u < 0.7 ? -1 : 0, eyes: s.eyes });
        ball(23, top, t * 8, 'H', 'C');
      }
    },
    {
      id: 'basketball', x: 8,
      lines: ['Swish!', 'Nothing but net.', 'Ball is life. 🏀'],
      bg() {
        room('#1d1f2a', '#9a6a38', '#b98248');
        rect(-2, FLOOR + 1, W + 4, 1, '#8a5c2e');
        rect(45, 9, 2, 24, '#5d636b');
        rect(42, 3, 3, 12, 'C');
        rect(43, 4, 1, 10, 'H');
        rect(37, 11, 6, 1, '#e0662c');
      },
      act(t, s) {
        const T = 4.2, p = t % T;
        let bx, by, hand, jump = 0, net = 0;
        const x = 8;
        if (p < 2.0) {
          const u = (p % 0.5) / 0.5;
          hand = [13, 12 + Math.round(2 * Math.sin(Math.PI * u))];
          bx = 21; by = 25 + 4 * Math.sin(Math.PI * u);
        } else if (p < 2.3) {
          jump = Math.round(2 * Math.sin(Math.PI * (p - 2.0) / 0.5));
          hand = [11, 5]; bx = x + 11; by = 12 - jump + 5 - 4;
        } else if (p < 2.9) {
          const k = (p - 2.3) / 0.6;
          hand = [12, 4];
          jump = p < 2.5 ? Math.round(2 * Math.sin(Math.PI * (p - 2.0) / 0.5)) : 0;
          bx = 19 + (38 - 19) * k; by = 13 + (8 - 13) * k - 7 * 4 * k * (1 - k);
        } else if (p < 3.3) {
          hand = [13, 12];
          bx = 38; by = 9 + (p - 2.9) / 0.4 * 20;
          net = 1;
        } else {
          hand = [13, 12];
          const k = (p - 3.3) / 0.9;
          bx = 38 + (21 - 38) * k; by = 29;
        }
        shadow(10, 9);
        const wig = net ? Math.floor(t * 12) % 2 : 0;
        for (let k = 0; k < 4; k++) {
          px(38 + wig + (k % 2), 12 + k, 'H');
          px(41 - wig - (k % 2), 12 + k, 'H');
        }
        hero({ x, y: 12 + s.hop - jump, hand, eyes: s.eyes });
        ball(Math.round(bx), Math.round(by), t * 6, '#e0662c', 'C');
        if (p > 2.9 && p < 3.9) glyphs('+2', 33, 2 - Math.round((p - 2.9) * 2), '#ffd166');
      }
    }
  ];

  // ---------- Loop: act, stand up, walk into the next room ----------

  const ACT_TIME = 9000, STAND = 350, WALK = 2400;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { hop: 0, eyes: 'open' };
  const sceneState = scenes.map(() => ({}));
  const blink = { until: 0, next: 1500 };
  let scene = Math.floor(Math.random() * scenes.length);
  let phase = 'act', phaseStart = performance.now(), last = phaseStart;
  let hopStart = -1, bubbleTimer = 0;
  const lineIndex = {};

  const startScene = i => { if (scenes[i].init) scenes[i].init(sceneState[i]); };
  scenes.forEach((sc, i) => startScene(i));

  function drawRoom(i, t, dx) {
    ctx.save();
    ctx.translate(dx, 0);
    scenes[i].bg(t, sceneState[i]);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    const moving = !still.matches;

    if (moving && now > blink.next) {
      blink.until = now + 140;
      blink.next = now + (Math.random() < 0.25 ? 320 : 2200 + Math.random() * 3000);
    }
    state.eyes = now < blink.until ? 'blink' : 'open';
    state.hop = hopStart >= 0 && now - hopStart < 400 ? -Math.round(3 * Math.sin(Math.PI * (now - hopStart) / 400)) : 0;

    const elapsed = now - phaseStart;
    if (moving && phase === 'act' && elapsed > ACT_TIME) { phase = 'walk'; phaseStart = now; }
    if (phase === 'walk' && now - phaseStart > STAND + WALK) {
      scene = (scene + 1) % scenes.length;
      startScene(scene);
      phase = 'act';
      phaseStart = now;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.translate(OFF_X, OFF_Y);
    const cur = scenes[scene];
    const t = moving ? (now - phaseStart) / 1000 : 1;

    if (phase === 'act') {
      drawRoom(scene, t, 0);
      cur.act(t, state, sceneState[scene], moving ? dt : 0);
    } else {
      const u = now - phaseStart;
      const nextIdx = (scene + 1) % scenes.length;
      const next = scenes[nextIdx];
      if (u < STAND) {
        // Get up from whatever he was doing
        drawRoom(scene, 0, 0);
        shadow(cur.x + 2, 9);
        hero({ x: cur.x, y: 12 - Math.round(2 * Math.sin(Math.PI * u / STAND)), eyes: state.eyes });
      } else {
        const k = (u - STAND) / WALK;
        const pan = Math.round(W * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2));
        drawRoom(scene, 0, -pan);
        drawRoom(nextIdx, 0, W - pan);
        doorway(W - pan);
        const hx = Math.round(cur.x + (W + next.x - cur.x) * k) - pan;
        const step = Math.floor(u / 140) % 2;
        shadow(hx + 2, 9);
        hero({ x: hx, y: 12 - step, legs: step ? 'walk1' : 'walk0', eyes: state.eyes });
      }
    }

    requestAnimationFrame(frame);
  }

  function say() {
    const sc = scenes[scene];
    const i = lineIndex[sc.id] = ((lineIndex[sc.id] ?? -1) + 1) % sc.lines.length;
    bubble.textContent = phase === 'walk' ? 'On my way!' : sc.lines[i];
    bubble.classList.add('show');
    hopStart = performance.now();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2600);
  }

  button.addEventListener('click', say);
  requestAnimationFrame(frame);
})();
