// Question types. Each renderer builds the answer area and calls
// done(correct, revealHtml) once, when the answer is final.
// Types: mc, tf, number, classify, match, fill, open.

import { say, sayOne, esc, shuffle, formatNumber, parseNumber } from './text.js';

const LETTERS = 'ABCDEFGH';

function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function checkButton(label = 'Controleer') {
  return el('<button type="button" class="btn primary check" disabled>' + label + '</button>');
}

function mc(q, done) {
  const order = q.keepOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i));
  const box = el('<div class="options" role="group"></div>');
  order.forEach((optionIndex, position) => {
    const button = el(
      '<button type="button" class="option">' +
        '<span class="letter" aria-hidden="true">' + LETTERS[position] + '</span>' +
        '<span class="option-text">' + sayOne(q.options[optionIndex]) + '</span>' +
      '</button>'
    );
    button.addEventListener('click', () => {
      box.querySelectorAll('.option').forEach(b => { b.disabled = true; });
      const correct = optionIndex === q.answer;
      button.classList.add(correct ? 'right' : 'wrong');
      box.children[order.indexOf(q.answer)].classList.add('right');
      done(correct, correct ? '' : '<p>' + sayOne('Het goede antwoord is: **' + q.options[q.answer] + '**') + '</p>');
    });
    box.append(button);
  });
  return box;
}

function tf(q, done) {
  const box = el(
    '<div class="options tf" role="group">' +
      '<button type="button" class="option" data-value="true"><span class="letter" aria-hidden="true">✓</span><span class="option-text">' + sayOne('Juist') + '</span></button>' +
      '<button type="button" class="option" data-value="false"><span class="letter" aria-hidden="true">✗</span><span class="option-text">' + sayOne('Onjuist') + '</span></button>' +
    '</div>'
  );
  box.querySelectorAll('.option').forEach(button => {
    button.addEventListener('click', () => {
      box.querySelectorAll('.option').forEach(b => { b.disabled = true; });
      const value = button.dataset.value === 'true';
      const correct = value === q.answer;
      button.classList.add(correct ? 'right' : 'wrong');
      box.querySelector('[data-value="' + q.answer + '"]').classList.add('right');
      done(correct, correct ? '' : '<p>' + sayOne('Het goede antwoord is: **' + (q.answer ? 'juist' : 'onjuist') + '**') + '</p>');
    });
  });
  return box;
}

function number(q, done, options) {
  const decimals = q.decimals ?? 2;
  const box = el(
    '<div class="number-q">' +
      '<label class="number-field">' +
        (q.unit === '€' ? '<span class="unit">€</span>' : '') +
        '<input type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Jouw antwoord" placeholder="…">' +
        (q.unit === '%' ? '<span class="unit">%</span>' : '') +
      '</label>' +
      '<div class="row">' +
        (q.hint ? '<button type="button" class="btn ghost hint-btn">💡 Hint</button>' : '') +
      '</div>' +
      (q.hint ? '<p class="hint" hidden>' + say(q.hint) + '</p>' : '') +
    '</div>'
  );
  const input = box.querySelector('input');
  const check = checkButton();
  box.querySelector('.row').append(check);

  const hintButton = box.querySelector('.hint-btn');
  if (hintButton) {
    hintButton.addEventListener('click', () => {
      box.querySelector('.hint').hidden = false;
      hintButton.hidden = true;
    });
  }

  input.addEventListener('input', () => { check.disabled = !input.value.trim(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !check.disabled) check.click();
  });

  check.addEventListener('click', () => {
    const readings = parseNumber(input.value);
    if (!readings.length) {
      input.focus();
      return;
    }
    const correct = readings.some(n => Math.abs(n - q.answer) < 1e-9);
    input.disabled = true;
    check.hidden = true;
    if (hintButton) hintButton.hidden = true;
    box.querySelector('.number-field').classList.add(correct ? 'right' : 'wrong');

    let reveal = correct ? '' : '<p>' + sayOne('Het goede antwoord is: **' + formatNumber(q.answer, decimals, q.unit) + '**') + '</p>';
    if (q.steps) {
      reveal += '<p class="steps-title">' + sayOne('Zo reken je het uit:') + '</p><ol class="steps">' +
        q.steps.map(step => '<li>' + sayOne(step) + '</li>').join('') + '</ol>';
    }
    done(correct, reveal);
  });

  if (options.autofocus) setTimeout(() => input.focus({ preventScroll: true }), 50);
  return box;
}

function classify(q, done) {
  const items = shuffle(q.items);
  const choice = new Map();
  const box = el('<div class="classify"></div>');
  const list = el('<ul class="classify-list"></ul>');

  items.forEach(([label, bucket], rowIndex) => {
    const row = el(
      '<li class="classify-row">' +
        '<span class="classify-item">' + sayOne(label) + '</span>' +
        '<span class="seg" role="group">' +
          q.buckets.map((name, i) => '<button type="button" data-bucket="' + i + '">' + esc(name) + '</button>').join('') +
        '</span>' +
      '</li>'
    );
    row.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        row.querySelectorAll('button').forEach(b => b.classList.toggle('picked', b === button));
        choice.set(rowIndex, Number(button.dataset.bucket));
        check.disabled = choice.size < items.length;
      });
    });
    row.dataset.answer = bucket;
    list.append(row);
  });

  const check = checkButton();
  check.addEventListener('click', () => {
    let right = 0;
    list.querySelectorAll('.classify-row').forEach((row, rowIndex) => {
      const ok = choice.get(rowIndex) === Number(row.dataset.answer);
      if (ok) right++;
      row.classList.add(ok ? 'right' : 'wrong');
      row.querySelectorAll('button').forEach(b => {
        b.disabled = true;
        if (Number(b.dataset.bucket) === Number(row.dataset.answer)) b.classList.add('answer');
      });
    });
    check.hidden = true;
    const all = right === items.length;
    done(all, all ? '' : '<p>' + say('Je had er **' + right + ' van de ' + items.length + '** goed. De goede keuzes hebben een dikke rand.') + '</p>');
  });

  box.append(list, check);
  return box;
}

const PAIR_COLORS = 6;

function match(q, done) {
  const rightOrder = shuffle(q.pairs.map((_, i) => i));
  const pairs = new Map(); // left index -> right index
  let selectedLeft = null;

  const box = el(
    '<div class="match">' +
      '<p class="tip">' + sayOne('Tik links, en daarna rechts.') + '</p>' +
      '<div class="match-cols"><ul class="match-left"></ul><ul class="match-right"></ul></div>' +
    '</div>'
  );
  const leftList = box.querySelector('.match-left');
  const rightList = box.querySelector('.match-right');

  q.pairs.forEach(([left], i) => {
    const li = el('<li><button type="button" class="match-item" data-i="' + i + '">' + sayOne(left) + '</button></li>');
    leftList.append(li);
  });
  rightOrder.forEach(i => {
    const li = el('<li><button type="button" class="match-item" data-i="' + i + '">' + sayOne(q.pairs[i][1]) + '</button></li>');
    rightList.append(li);
  });

  const check = checkButton();

  function paint() {
    const colorOf = new Map();
    [...pairs.keys()].forEach((left, n) => colorOf.set(left, n));
    leftList.querySelectorAll('.match-item').forEach(b => {
      const i = Number(b.dataset.i);
      b.classList.toggle('selected', selectedLeft === i);
      b.dataset.pair = pairs.has(i) ? (colorOf.get(i) % PAIR_COLORS) + 1 : '';
      b.dataset.num = pairs.has(i) ? colorOf.get(i) + 1 : '';
    });
    rightList.querySelectorAll('.match-item').forEach(b => {
      const i = Number(b.dataset.i);
      const left = [...pairs.entries()].find(([, r]) => r === i);
      b.dataset.pair = left ? (colorOf.get(left[0]) % PAIR_COLORS) + 1 : '';
      b.dataset.num = left ? colorOf.get(left[0]) + 1 : '';
    });
    check.disabled = pairs.size < q.pairs.length;
  }

  leftList.addEventListener('click', event => {
    const button = event.target.closest('.match-item');
    if (!button || button.disabled) return;
    const i = Number(button.dataset.i);
    if (pairs.has(i)) pairs.delete(i);
    selectedLeft = i;
    paint();
  });

  rightList.addEventListener('click', event => {
    const button = event.target.closest('.match-item');
    if (!button || button.disabled) return;
    const i = Number(button.dataset.i);
    const existing = [...pairs.entries()].find(([, r]) => r === i);
    if (existing) pairs.delete(existing[0]);
    if (selectedLeft !== null) {
      pairs.set(selectedLeft, i);
      // Jump to the next left item that has no partner yet
      const nextFree = q.pairs.findIndex((_, n) => !pairs.has(n));
      selectedLeft = nextFree === -1 ? null : nextFree;
    }
    paint();
  });

  check.addEventListener('click', () => {
    let right = 0;
    leftList.querySelectorAll('.match-item').forEach(b => {
      const i = Number(b.dataset.i);
      const ok = pairs.get(i) === i;
      if (ok) right++;
      b.classList.add(ok ? 'right' : 'wrong');
      b.disabled = true;
    });
    rightList.querySelectorAll('.match-item').forEach(b => { b.disabled = true; });
    check.hidden = true;
    const all = right === q.pairs.length;
    const reveal = all ? '' :
      '<p>' + sayOne('Zo hoort het:') + '</p><ul class="pairs">' +
      q.pairs.map(([l, r]) => '<li>' + sayOne(l + ': ' + r) + '</li>').join('') + '</ul>';
    done(all, reveal);
  });

  selectedLeft = 0;
  paint();
  box.append(check);
  return box;
}

function fill(q, done) {
  const answers = [];
  const sentence = esc(q.text).replace(/\{([^}]+)\}/g, (_, word) => {
    answers.push(word);
    return '<button type="button" class="blank" data-i="' + (answers.length - 1) + '">…</button>';
  });
  const bank = q.bank || [...new Set(answers)];
  const filled = new Array(answers.length).fill(null);
  let active = 0;

  const box = el(
    '<div class="fill">' +
      '<p class="fill-text">' + sentence + '</p>' +
      '<p class="tip">' + sayOne('Tik op een woord om het in te vullen.') + '</p>' +
      '<div class="chips">' + shuffle(bank).map(w => '<button type="button" class="chip">' + esc(w) + '</button>').join('') + '</div>' +
    '</div>'
  );
  const blanks = [...box.querySelectorAll('.blank')];
  const check = checkButton();

  function paint() {
    blanks.forEach((b, i) => {
      b.textContent = filled[i] || '…';
      b.classList.toggle('active', i === active);
      b.classList.toggle('filled', !!filled[i]);
    });
    check.disabled = filled.some(v => !v);
  }

  blanks.forEach((b, i) => b.addEventListener('click', () => {
    if (filled[i] && active === i) filled[i] = null;
    active = i;
    paint();
  }));

  box.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    if (active === null || active === -1) return;
    filled[active] = chip.textContent;
    const nextEmpty = filled.findIndex(v => !v);
    active = nextEmpty === -1 ? active : nextEmpty;
    paint();
  }));

  check.addEventListener('click', () => {
    let right = 0;
    blanks.forEach((b, i) => {
      const ok = filled[i] === answers[i];
      if (ok) right++;
      b.classList.remove('active');
      b.classList.add(ok ? 'right' : 'wrong');
      b.disabled = true;
      if (!ok) b.innerHTML = '<s>' + esc(filled[i]) + '</s> ' + esc(answers[i]);
    });
    box.querySelectorAll('.chip').forEach(c => { c.disabled = true; });
    check.hidden = true;
    done(right === answers.length, '');
  });

  paint();
  box.append(check);
  return box;
}

function open(q, done) {
  const box = el(
    '<div class="open">' +
      '<p class="tip">' + say('Denk na, of zeg je antwoord hardop. Kijk daarna wat goed is.') + '</p>' +
      '<button type="button" class="btn primary">Laat het antwoord zien</button>' +
      '<div class="model" hidden>' +
        '<p class="model-title">' + sayOne('Een goed antwoord:') + '</p>' +
        '<p>' + say(q.model) + '</p>' +
        '<p class="model-title">' + sayOne('Had jij het ongeveer zo?') + '</p>' +
        '<div class="options rate">' +
          '<button type="button" class="option" data-ok="1"><span class="letter" aria-hidden="true">👍</span><span class="option-text">' + sayOne('Ja') + '</span></button>' +
          '<button type="button" class="option" data-ok="0"><span class="letter" aria-hidden="true">🤏</span><span class="option-text">' + sayOne('Een beetje / nog niet') + '</span></button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
  const reveal = box.querySelector('.btn');
  reveal.addEventListener('click', () => {
    reveal.hidden = true;
    box.querySelector('.model').hidden = false;
  });
  box.querySelectorAll('.rate .option').forEach(button => button.addEventListener('click', () => {
    box.querySelectorAll('.rate .option').forEach(b => { b.disabled = true; });
    button.classList.add('picked');
    done(button.dataset.ok === '1', '');
  }));
  return box;
}

const RENDERERS = { mc, tf, number, classify, match, fill, open };

const DEFAULT_PROMPTS = { tf: 'Klopt dit?' };

export function renderQuestion(q, done, options = {}) {
  const wrapper = el('<div class="question"></div>');
  let answered = false;
  const finish = (correct, reveal) => {
    if (answered) return;
    answered = true;
    done(correct, reveal);
  };

  const lead = q.type === 'tf' ? '<p class="lead">' + sayOne(DEFAULT_PROMPTS.tf) + '</p>' : '';
  const badge = q.rekenen ? '<span class="badge">🧮 Rekenen</span>' : '';
  wrapper.append(el('<div class="prompt-wrap">' + badge + lead + '<h2 class="prompt">' + say(q.prompt) + '</h2></div>'));
  const render = RENDERERS[q.type];
  wrapper.append(render ? render(q, finish, options) : el('<p>Onbekend vraagtype: ' + esc(q.type) + '</p>'));
  return wrapper;
}
