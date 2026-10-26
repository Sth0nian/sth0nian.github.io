// Bio page character sheet: an idling pixel hero plus a level / XP bar
// where the level is my age and XP fills up towards the next birthday.
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

  // ---------- Idle animation ----------
  const canvas = document.getElementById('heroIdle');
  const button = document.getElementById('heroButton');
  const bubble = document.getElementById('heroBubble');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sheet = new Image();
  sheet.src = 'img/player.png';

  // The idle pose is the 4th 13x22 frame; the visible eye sits at (8, 9)
  const FX = 39, FW = 13, FH = 22, NECK = 13;
  const EYE = { x: 8, y: 9 };
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lines = [
    'Coffee first. ☕',
    'terraform plan: no changes.',
    'Pipeline is green!',
    'Fancy a dungeon? Try TechJourney.',
    'Two cats, zero bugs. Mostly.',
    'dbt run... done!',
    'Hallo! Hi! 👋'
  ];

  let skin = '#f0c8a0';
  let nextBlink = 1500, blinkUntil = 0;
  let nextGlance = 5000, glanceUntil = 0;
  let bubbleTimer = 0, lineIndex = 0;
  const rand = (a, b) => a + Math.random() * (b - a);

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const moving = !still.matches;

    if (moving && t > nextBlink) {
      blinkUntil = t + 140;
      // Sometimes a quick double blink
      nextBlink = t + (Math.random() < 0.25 ? 320 : rand(2200, 5200));
    }
    if (moving && t > nextGlance) {
      glanceUntil = t + rand(900, 1600);
      nextGlance = t + rand(6000, 12000);
    }

    // Breathing: the head and torso sink a pixel every other beat
    const breath = moving ? Math.floor(t / 650) % 2 : 0;

    ctx.save();
    if (t < glanceUntil) {
      ctx.translate(FW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sheet, FX, NECK, FW, FH - NECK, 0, NECK + 1, FW, FH - NECK);
    ctx.drawImage(sheet, FX, 0, FW, NECK, 0, 1 + breath, FW, NECK);
    if (t < blinkUntil) {
      ctx.fillStyle = skin;
      ctx.fillRect(EYE.x, EYE.y + 1 + breath, 1, 1);
    }
    ctx.restore();

    requestAnimationFrame(draw);
  }

  function say() {
    bubble.textContent = lines[lineIndex++ % lines.length];
    bubble.classList.add('show');
    button.classList.remove('hop');
    void button.offsetWidth;
    button.classList.add('hop');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2600);
  }

  sheet.addEventListener('load', () => {
    // Sample the skin tone next to the eye so the blink matches the sprite
    try {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const p = probe.getContext('2d');
      p.drawImage(sheet, FX + EYE.x + 1, EYE.y, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = p.getImageData(0, 0, 1, 1).data;
      skin = `rgb(${r},${g},${b})`;
    } catch (e) {
      // Keep the fallback colour
    }
    requestAnimationFrame(draw);
  });

  button.addEventListener('click', say);
})();
