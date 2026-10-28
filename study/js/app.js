// Leerhulp: router and views.
// Routes:
//   #/                               home
//   #/vak/<subject>                  chapters of a subject
//   #/h/<subject>/<chapter>          sections of a chapter
//   #/p/<subject>/<chapter>/<sec>    one section (paragraaf)
//   #/uitleg/<subject>/<chapter>/<sec>[/<card>]   read the explanation
//   #/oefen/<subject>/<chapter>/<sec|alles>       practise questions
//   #/kaarten/<subject>/<chapter>/<sec|alles>     practise terms
//   #/voortgang, #/instellingen

import { settings, progress, saveSettings, saveProgress, record, pick, mastery, exportData, importData, resetProgress, dayKey } from './store.js';
import { loadCatalog, getSubject, loadChapter, loadSubjectChapters, allKeys, resolveItem } from './content.js';
import { renderQuestion } from './questions.js';
import { say, sayOne, esc, shuffle } from './text.js';
import * as speech from './speech.js';

const view = document.getElementById('view');
const backLink = document.getElementById('back');
const barTitle = document.getElementById('bar-title');
const readButton = document.getElementById('read');

let readTargets = () => [view];
let installPrompt = null;

// ---------- Look and feel ----------

function applySettings() {
  const root = document.documentElement;
  root.dataset.font = settings.font;
  root.dataset.size = settings.size;
  root.dataset.theme = settings.theme;
  root.dataset.spacing = settings.spacing;
  document.getElementById('ruler').hidden = !settings.ruler;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bar').trim() || '#1f6f78';
}

function setBar(title, back) {
  barTitle.textContent = title;
  document.title = title ? title + ' · Leerhulp' : 'Leerhulp';
  backLink.hidden = !back;
  if (back) backLink.href = back;
}

function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function bar(percent, label) {
  return '<div class="meter" role="img" aria-label="' + esc(label || percent + '%') + '"><span style="width:' + percent + '%"></span></div>';
}

function remember(hash, label) {
  progress.last = { hash, label, at: Date.now() };
  saveProgress();
}

// ---------- Read aloud button ----------

if (!speech.canSpeak) readButton.hidden = true;

readButton.addEventListener('click', () => {
  if (speech.isSpeaking()) speech.stop();
  else speech.readAloud(...readTargets());
});

speech.onSpeakingChange(speaking => {
  readButton.classList.toggle('speaking', speaking);
  readButton.querySelector('.label').textContent = speaking ? 'Stop' : 'Lees voor';
  readButton.querySelector('.icon').textContent = speaking ? '⏹' : '🔊';
});

// Tap any sentence to hear just that sentence
view.addEventListener('dblclick', event => {
  const span = event.target.closest('.say');
  if (span) speech.readText(span.textContent);
});

// ---------- Reading ruler ----------

const ruler = document.getElementById('ruler');
function moveRuler(y) {
  ruler.style.transform = 'translateY(' + (y - ruler.offsetHeight / 2) + 'px)';
}
window.addEventListener('pointermove', event => { if (settings.ruler) moveRuler(event.clientY); }, { passive: true });
window.addEventListener('touchmove', event => { if (settings.ruler) moveRuler(event.touches[0].clientY); }, { passive: true });
window.addEventListener('touchstart', event => { if (settings.ruler) moveRuler(event.touches[0].clientY); }, { passive: true });

// ---------- Views ----------

async function home() {
  setBar('Leerhulp', null);
  const catalog = await loadCatalog();
  const today = progress.days[dayKey()] || 0;
  const streak = progress.streak.day === dayKey() || progress.streak.day === dayKey(Date.now() - 864e5) ? progress.streak.count : 0;

  let resume = '';
  const session = progress.session;
  if (session && !session.done) {
    resume = '<a class="card resume" href="' + esc(session.hash) + '">' +
      '<span class="big-icon" aria-hidden="true">▶️</span>' +
      '<span><strong>' + sayOne('Ga verder waar je was') + '</strong><br>' +
      '<span class="muted">' + sayOne(session.title + ': ' + Math.min(session.i + 1, session.queue.length) + ' van ' + session.queue.length) + '</span></span></a>';
  } else if (progress.last) {
    resume = '<a class="card resume" href="' + esc(progress.last.hash) + '">' +
      '<span class="big-icon" aria-hidden="true">▶️</span>' +
      '<span><strong>' + sayOne('Ga verder') + '</strong><br><span class="muted">' + sayOne(progress.last.label) + '</span></span></a>';
  }

  view.innerHTML =
    '<section class="hello">' +
      '<h2>' + sayOne('Hoi! 👋') + '</h2>' +
      '<p class="stats">' +
        (streak ? '<span class="pill">🔥 ' + streak + (streak === 1 ? ' dag' : ' dagen') + ' op rij</span>' : '') +
        '<span class="pill">✅ Vandaag ' + today + (today === 1 ? ' vraag' : ' vragen') + '</span>' +
      '</p>' +
    '</section>' +
    resume +
    '<h2 class="section-title">' + sayOne('Kies een vak') + '</h2>' +
    '<div class="grid">' +
      catalog.subjects.map(s =>
        '<a class="card subject" href="#/vak/' + esc(s.id) + '" style="--subject:' + esc(s.color || 'var(--accent)') + '">' +
          '<span class="big-icon" aria-hidden="true">' + esc(s.icon || '📘') + '</span>' +
          '<span class="card-title">' + sayOne(s.title) + '</span>' +
        '</a>'
      ).join('') +
    '</div>' +
    '<p class="center"><a class="btn ghost" href="#/voortgang">📊 Mijn voortgang</a></p>';
}

async function subjectView(subjectId) {
  const subject = await getSubject(subjectId);
  setBar(subject.title, '#/');
  const chapters = await loadSubjectChapters(subjectId);

  view.innerHTML =
    '<h2 class="page-title">' + sayOne(subject.icon + ' ' + subject.title) + '</h2>' +
    (subject.book ? '<p class="muted">' + sayOne('Boek: ' + subject.book) + '</p>' : '') +
    '<div class="list">' +
      chapters.map(ch => {
        const m = mastery([...allKeys(ch, 'question'), ...allKeys(ch, 'term')]);
        return '<a class="card row-card" href="#/h/' + esc(subjectId) + '/' + esc(ch.id) + '">' +
          '<span class="num">' + esc(ch.number) + '</span>' +
          '<span class="grow"><span class="card-title">' + sayOne('Hoofdstuk ' + ch.number + ': ' + ch.title) + '</span>' +
          bar(m.percent, m.percent + '% gekend') +
          '<span class="muted small">' + m.percent + '% gekend' + (m.due ? ' · ' + m.due + ' om te herhalen' : '') + '</span></span>' +
        '</a>';
      }).join('') +
    '</div>';
}

async function chapterView(subjectId, chapterId) {
  const chapter = await loadChapter(subjectId, chapterId);
  setBar('Hoofdstuk ' + chapter.number, '#/vak/' + subjectId);
  const base = subjectId + '/' + chapterId;
  const questions = mastery(allKeys(chapter, 'question'));

  view.innerHTML =
    '<h2 class="page-title">' + sayOne('Hoofdstuk ' + chapter.number + ': ' + chapter.title) + '</h2>' +
    '<div class="list">' +
      chapter.sections.map(sec => {
        const m = mastery([...sec.questionKeys, ...sec.termKeys]);
        return '<a class="card row-card" href="#/p/' + base + '/' + esc(sec.id) + '">' +
          '<span class="num">' + esc(sec.id) + '</span>' +
          '<span class="grow"><span class="card-title">' + sayOne(sec.title) + '</span>' +
          bar(m.percent, m.percent + '% gekend') +
          '<span class="muted small">' + m.percent + '% gekend' + (m.due ? ' · ' + m.due + ' om te herhalen' : '') + '</span></span>' +
        '</a>';
      }).join('') +
    '</div>' +
    '<h2 class="section-title">' + sayOne('Het hele hoofdstuk') + '</h2>' +
    '<div class="actions-list">' +
      '<a class="btn big" href="#/oefen/' + base + '/alles">✏️ ' + sayOne('Oefen alles door elkaar') +
        (questions.due ? '<span class="pill small">' + questions.due + ' herhalen</span>' : '') + '</a>' +
      '<a class="btn big" href="#/kaarten/' + base + '/alles">🃏 ' + sayOne('Alle begrippen') + '</a>' +
    '</div>';
}

async function sectionView(subjectId, chapterId, sectionId) {
  const chapter = await loadChapter(subjectId, chapterId);
  const sec = chapter.sections.find(s => s.id === sectionId);
  if (!sec) throw new Error('Paragraaf niet gevonden');
  const base = subjectId + '/' + chapterId + '/' + sectionId;
  setBar(sec.id + ' ' + sec.title, '#/h/' + subjectId + '/' + chapterId);
  remember('#/p/' + base, sec.id + ' ' + sec.title);

  const learned = progress.learn[sec.key] || { max: -1 };
  const read = Math.min(learned.max + 1, sec.learn.length);
  const q = mastery(sec.questionKeys);
  const t = mastery(sec.termKeys);
  const goals = progress.goals[sec.key] || [];

  view.innerHTML =
    '<h2 class="page-title">' + sayOne(sec.id + ' ' + sec.title) + '</h2>' +
    (sec.intro ? '<p class="intro">' + say(sec.intro) + '</p>' : '') +
    '<div class="steps-list">' +
      stepCard('#/uitleg/' + base, '📖', '1. Lees de uitleg', read + ' van ' + sec.learn.length + ' kaartjes gelezen', Math.round((read / sec.learn.length) * 100)) +
      stepCard('#/kaarten/' + base, '🃏', '2. Leer de begrippen', t.known + ' van ' + t.total + ' gekend' + (t.due ? ' · ' + t.due + ' herhalen' : ''), t.percent) +
      stepCard('#/oefen/' + base, '✏️', '3. Oefen met vragen', q.known + ' van ' + q.total + ' gekend' + (q.due ? ' · ' + q.due + ' herhalen' : ''), q.percent) +
    '</div>' +
    '<h2 class="section-title">' + sayOne('Ik kan nu…') + '</h2>' +
    '<p class="muted small">' + sayOne('Vink aan wat je al kunt.') + '</p>' +
    '<ul class="goals">' +
      sec.goals.map((g, i) =>
        '<li><label><input type="checkbox" data-goal="' + i + '"' + (goals.includes(i) ? ' checked' : '') + '> ' + sayOne(g) + '</label></li>'
      ).join('') +
    '</ul>';

  view.querySelectorAll('[data-goal]').forEach(box => box.addEventListener('change', () => {
    const set = new Set(progress.goals[sec.key] || []);
    if (box.checked) set.add(Number(box.dataset.goal));
    else set.delete(Number(box.dataset.goal));
    progress.goals[sec.key] = [...set];
    saveProgress();
  }));
}

function stepCard(href, icon, title, detail, percent) {
  return '<a class="card step-card" href="' + href + '">' +
    '<span class="big-icon" aria-hidden="true">' + icon + '</span>' +
    '<span class="grow"><span class="card-title">' + sayOne(title) + '</span>' +
    bar(percent, detail) +
    '<span class="muted small">' + esc(detail) + '</span></span>' +
    '<span class="chev" aria-hidden="true">›</span></a>';
}

// ---------- Uitleg (explanation cards) ----------

async function learnView(subjectId, chapterId, sectionId, cardParam) {
  const chapter = await loadChapter(subjectId, chapterId);
  const sec = chapter.sections.find(s => s.id === sectionId);
  if (!sec) throw new Error('Paragraaf niet gevonden');
  const base = subjectId + '/' + chapterId + '/' + sectionId;
  const state = progress.learn[sec.key] || { pos: 0, max: -1 };
  const total = sec.learn.length;
  let index = cardParam === undefined ? state.pos : Number(cardParam);
  if (!(index >= 0 && index <= total)) index = 0;

  setBar('Uitleg ' + sec.id, '#/p/' + base);

  if (index === total) {
    remember('#/p/' + base, sec.id + ' ' + sec.title);
    view.innerHTML =
      '<section class="card done">' +
        '<div class="celebrate" aria-hidden="true">🎉</div>' +
        '<h2>' + sayOne('Je hebt alles gelezen!') + '</h2>' +
        '<p>' + say('Goed gedaan. Nu ga je oefenen. Zo onthoud je het beter.') + '</p>' +
        '<div class="actions-list">' +
          '<a class="btn primary big" href="#/kaarten/' + base + '">🃏 ' + sayOne('Leer de begrippen') + '</a>' +
          '<a class="btn big" href="#/oefen/' + base + '">✏️ ' + sayOne('Oefen met vragen') + '</a>' +
          '<a class="btn ghost" href="#/uitleg/' + base + '/0">↺ ' + sayOne('Nog een keer lezen') + '</a>' +
        '</div>' +
      '</section>';
    progress.learn[sec.key] = { pos: 0, max: Math.max(state.max, total - 1) };
    saveProgress();
    return;
  }

  const card = sec.learn[index];
  progress.learn[sec.key] = { pos: index, max: Math.max(state.max, index) };
  remember('#/uitleg/' + base + '/' + index, 'Uitleg ' + sec.id + ': ' + card.title);

  view.innerHTML =
    '<div class="dots" aria-label="Kaartje ' + (index + 1) + ' van ' + total + '">' +
      sec.learn.map((_, i) => '<span class="' + (i === index ? 'on' : i < index ? 'past' : '') + '"></span>').join('') +
    '</div>' +
    '<article class="card learn-card">' +
      '<div class="learn-icon" aria-hidden="true">' + esc(card.icon || '📘') + '</div>' +
      '<h2>' + sayOne(card.title) + '</h2>' +
      (card.text || []).map(p => '<p>' + say(p) + '</p>').join('') +
      (card.list ? '<ul class="learn-list">' + card.list.map(li => '<li>' + say(li) + '</li>').join('') + '</ul>' : '') +
      (card.example ? '<div class="example"><span class="example-label">' + sayOne('Voorbeeld') + '</span><p>' + say(card.example) + '</p></div>' : '') +
    '</article>' +
    '<div class="check-slot"></div>' +
    '<nav class="pager">' +
      (index > 0 ? '<a class="btn" href="#/uitleg/' + base + '/' + (index - 1) + '">← Vorige</a>' : '<span></span>') +
      '<a class="btn primary" href="#/uitleg/' + base + '/' + (index + 1) + '">' + (index === total - 1 ? 'Klaar ✓' : 'Volgende →') + '</a>' +
    '</nav>';

  if (card.check) {
    const slot = view.querySelector('.check-slot');
    const box = el('<section class="card quick-check"><p class="eyebrow">' + sayOne('Even checken') + '</p></section>');
    const feedback = el('<div class="feedback" hidden></div>');
    box.append(renderQuestion(card.check, (correct, reveal) => {
      showFeedback(feedback, correct, card.check.explain, reveal);
    }), feedback);
    slot.append(box);
  }

  readTargets = () => [view.querySelector('.learn-card'), view.querySelector('.quick-check')];
  if (settings.autoRead) speech.readAloud(view.querySelector('.learn-card'));
}

// ---------- Practice sessions ----------

const PRAISE = ['Goed zo!', 'Top!', 'Helemaal goed!', 'Lekker bezig!', 'Knap gedaan!', 'Yes, goed!'];
const COMFORT = ['Bijna!', 'Niet erg, zo leer je het.', 'Oké, kijk even mee.', 'Geeft niks!'];
const pickOne = list => list[Math.floor(Math.random() * list.length)];

function showFeedback(box, correct, explain, reveal) {
  box.hidden = false;
  box.className = 'feedback ' + (correct ? 'good' : 'oops');
  box.innerHTML =
    '<p class="feedback-title">' + (correct ? '✅ ' : '💡 ') + sayOne(correct ? pickOne(PRAISE) : pickOne(COMFORT)) + '</p>' +
    (reveal ? '<div>' + reveal + '</div>' : '') +
    (explain ? '<p>' + say(explain) + '</p>' : '');
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function sessionView(kind, subjectId, chapterId, sectionId) {
  const chapter = await loadChapter(subjectId, chapterId);
  const whole = sectionId === 'alles';
  const sec = whole ? null : chapter.sections.find(s => s.id === sectionId);
  if (!whole && !sec) throw new Error('Paragraaf niet gevonden');

  const hash = '#/' + kind + '/' + subjectId + '/' + chapterId + '/' + sectionId;
  const backHash = whole ? '#/h/' + subjectId + '/' + chapterId : '#/p/' + subjectId + '/' + chapterId + '/' + sectionId;
  const what = kind === 'kaarten' ? 'Begrippen' : 'Oefenen';
  const title = what + ' ' + (whole ? 'hoofdstuk ' + chapter.number : sec.id);
  setBar(title, backHash);

  let session = progress.session;
  if (!session || session.hash !== hash || session.done) {
    const keys = kind === 'kaarten'
      ? (whole ? allKeys(chapter, 'term') : sec.termKeys)
      : (whole ? allKeys(chapter, 'question') : sec.questionKeys);
    const size = kind === 'kaarten' ? Math.max(settings.sessionSize, 8) : settings.sessionSize;
    let queue = pick(keys, size);
    if (whole) queue = shuffle(queue);
    session = { hash, back: backHash, kind, title, queue, i: 0, first: {}, retried: [], right: 0, wrong: 0, done: false, started: Date.now() };
    progress.session = session;
    saveProgress();
  }

  renderStep(session);
}

async function renderStep(session) {
  speech.stop();
  if (session.i >= session.queue.length) return renderSummary(session);

  const key = session.queue[session.i];
  const item = await resolveItem(key);
  if (!item) {
    // Content changed since this session started: skip the missing item
    session.i++;
    saveProgress();
    return renderStep(session);
  }

  const doneCount = Math.min(session.i, session.queue.length);
  const isRetry = session.first[key] !== undefined;

  view.innerHTML =
    '<div class="session-top">' +
      bar(Math.round((doneCount / session.queue.length) * 100), 'Voortgang') +
      '<span class="muted small">' + (session.i + 1) + ' / ' + session.queue.length + '</span>' +
    '</div>' +
    (isRetry ? '<p class="retry-note">🔁 ' + sayOne('Deze kwam je net al tegen. Probeer het nog een keer!') + '</p>' : '') +
    '<section class="card qcard"></section>';
  const card = view.querySelector('.qcard');
  const feedback = el('<div class="feedback" hidden></div>');
  const next = el('<button type="button" class="btn primary big next" hidden>Volgende →</button>');

  const answered = (correct, explain, reveal) => {
    if (session.first[key] === undefined) {
      session.first[key] = correct;
      record(key, correct);
      if (correct) session.right++;
      else session.wrong++;
    }
    if (!correct && !session.retried.includes(key)) {
      session.queue.push(key);
      session.retried.push(key);
    }
    session.i++;
    saveProgress();
    showFeedback(feedback, correct, explain, reveal);
    next.hidden = false;
    next.focus({ preventScroll: true });
    setTimeout(() => next.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
    if (settings.autoRead) speech.readAloud(feedback);
  };

  if (item.kind === 'question') {
    card.append(renderQuestion(item.data, (correct, reveal) => answered(correct, item.data.explain, reveal), { autofocus: true }));
  } else {
    card.append(flashcard(item.data, correct => answered(correct, '', '')));
  }
  card.append(feedback, next);
  next.addEventListener('click', () => renderStep(session));

  readTargets = () => [card];
  if (settings.autoRead) speech.readAloud(card.querySelector('.prompt-wrap') || card);
}

function flashcard(term, done) {
  const box = el(
    '<div class="flash">' +
      '<p class="eyebrow">' + sayOne('Weet je wat dit betekent?') + '</p>' +
      '<div class="prompt-wrap"><h2 class="term">' + sayOne(term.term) + '</h2></div>' +
      '<button type="button" class="btn primary big flip">🔄 Draai om</button>' +
      '<div class="back" hidden>' +
        '<p class="def">' + say(term.def) + '</p>' +
        (term.example ? '<div class="example"><span class="example-label">' + sayOne('Voorbeeld') + '</span><p>' + say(term.example) + '</p></div>' : '') +
        '<p class="eyebrow">' + sayOne('Wist je het?') + '</p>' +
        '<div class="options rate">' +
          '<button type="button" class="option" data-ok="1"><span class="letter" aria-hidden="true">👍</span><span class="option-text">' + sayOne('Ja, wist ik') + '</span></button>' +
          '<button type="button" class="option" data-ok="0"><span class="letter" aria-hidden="true">🔁</span><span class="option-text">' + sayOne('Nog niet') + '</span></button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
  const flip = box.querySelector('.flip');
  flip.addEventListener('click', () => {
    flip.hidden = true;
    box.querySelector('.back').hidden = false;
    if (settings.autoRead) speech.readAloud(box.querySelector('.back .def'), box.querySelector('.back .example'));
  });
  box.querySelectorAll('.rate .option').forEach(button => button.addEventListener('click', () => {
    box.querySelectorAll('.rate .option').forEach(b => { b.disabled = true; });
    button.classList.add('picked');
    done(button.dataset.ok === '1');
  }));
  return box;
}

function renderSummary(session) {
  if (!session.done) {
    session.done = true;
    saveProgress();
  }
  const total = session.right + session.wrong;
  const score = total ? session.right / total : 0;
  const stars = score >= 0.9 ? 3 : score >= 0.6 ? 2 : 1;
  const message = stars === 3 ? 'Super! Je kent dit al heel goed.' :
    stars === 2 ? 'Goed bezig! Nog een paar keer oefenen en je kent het.' :
    'Je hebt hard gewerkt. De lastige vragen komen vanzelf terug, zo leer je ze.';
  const minutes = Math.round((Date.now() - session.started) / 60000);

  view.innerHTML =
    '<section class="card done">' +
      '<div class="celebrate" aria-hidden="true">' + '⭐'.repeat(stars) + '<span class="dim">' + '⭐'.repeat(3 - stars) + '</span></div>' +
      '<h2>' + sayOne('Rondje klaar!') + '</h2>' +
      '<p class="score">' + sayOne(session.right + ' van de ' + total + ' in één keer goed.') + '</p>' +
      '<p>' + say(message) + '</p>' +
      (minutes >= 15 ? '<p class="muted">' + say('Je bent al ' + minutes + ' minuten bezig. Neem gerust even pauze!') + '</p>' : '') +
      '<p class="muted small">' + sayOne('Je voortgang is bewaard. Je kunt altijd stoppen en later verder gaan.') + '</p>' +
      '<div class="actions-list">' +
        '<button type="button" class="btn primary big again">🔁 ' + sayOne('Nog een rondje') + '</button>' +
        '<a class="btn big" href="' + esc(session.back) + '">' + sayOne('Terug') + '</a>' +
      '</div>' +
    '</section>';

  view.querySelector('.again').addEventListener('click', () => {
    progress.session = null;
    saveProgress();
    route();
  });
  readTargets = () => [view];
}

// ---------- Voortgang (progress overview) ----------

async function progressView() {
  setBar('Mijn voortgang', '#/');
  const catalog = await loadCatalog();
  let html = '<h2 class="page-title">' + sayOne('Mijn voortgang') + '</h2>';

  // Last 14 days of activity
  const days = [];
  for (let n = 13; n >= 0; n--) {
    const key = dayKey(Date.now() - n * 864e5);
    days.push({ key, count: progress.days[key] || 0, label: new Date(Date.now() - n * 864e5).toLocaleDateString('nl-NL', { weekday: 'narrow' }) });
  }
  const top = Math.max(10, ...days.map(d => d.count));
  html += '<section class="card"><h3>' + sayOne('Vragen per dag') + '</h3><div class="days">' +
    days.map(d => '<div class="day" title="' + d.key + ': ' + d.count + '"><span class="day-bar" style="height:' + Math.round((d.count / top) * 100) + '%"></span><span class="day-num">' + (d.count || '') + '</span><span class="day-label">' + esc(d.label) + '</span></div>').join('') +
    '</div></section>';

  const hard = [];
  for (const subject of catalog.subjects) {
    const chapters = await loadSubjectChapters(subject.id);
    html += '<h3 class="section-title">' + esc(subject.icon + ' ' + subject.title) + '</h3>';
    for (const ch of chapters) {
      html += '<section class="card"><h3>' + sayOne('Hoofdstuk ' + ch.number + ': ' + ch.title) + '</h3><table class="progress-table"><thead><tr><th></th><th>Uitleg</th><th>Begrippen</th><th>Vragen</th></tr></thead><tbody>';
      for (const sec of ch.sections) {
        const learned = progress.learn[sec.key] || { max: -1 };
        const read = Math.round(((learned.max + 1) / sec.learn.length) * 100);
        const t = mastery(sec.termKeys);
        const q = mastery(sec.questionKeys);
        html += '<tr><th><a href="#/p/' + esc(subject.id + '/' + ch.id + '/' + sec.id) + '">' + esc(sec.id) + '</a></th>' +
          '<td>' + bar(read) + read + '%</td><td>' + bar(t.percent) + t.percent + '%</td><td>' + bar(q.percent) + q.percent + '%</td></tr>';
      }
      html += '</tbody></table></section>';
      for (const [key, item] of ch.items) {
        const state = progress.items[key];
        if (state && state.wrong > 0 && state.b < 3) hard.push({ key, item, state });
      }
    }
  }

  hard.sort((a, b) => (b.state.wrong - b.state.right) - (a.state.wrong - a.state.right));
  html += '<section class="card"><h3>' + sayOne('Nog lastig') + '</h3>' +
    (hard.length
      ? '<ul class="hard">' + hard.slice(0, 10).map(({ item, state }) =>
          '<li><span class="pill small">' + esc(item.section.id) + '</span> ' +
          sayOne(item.kind === 'term' ? 'Begrip: ' + item.data.term : item.data.prompt) +
          ' <span class="muted small">(' + state.wrong + '× fout)</span></li>').join('') + '</ul>'
      : '<p>' + sayOne('Nog niks lastigs. Lekker bezig!') + '</p>') +
    '</section>' +
    '<p class="muted small">Gekend = minstens 3 keer goed, verspreid over meerdere dagen. Wat fout gaat, komt vanzelf vaker terug.</p>';

  view.innerHTML = html;
}

// ---------- Instellingen (settings) ----------

function optionRow(name, label, choices) {
  return '<fieldset class="setting"><legend>' + sayOne(label) + '</legend><div class="seg wide">' +
    choices.map(([value, text, extra]) =>
      '<label class="seg-option"><input type="radio" name="' + name + '" value="' + esc(value) + '"' +
      (String(settings[name]) === String(value) ? ' checked' : '') + '><span' + (extra || '') + '>' + esc(text) + '</span></label>'
    ).join('') +
    '</div></fieldset>';
}

function settingsView() {
  setBar('Instellingen', '#/');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  view.innerHTML =
    '<h2 class="page-title">' + sayOne('Instellingen') + '</h2>' +
    '<form class="settings" onsubmit="return false">' +
      optionRow('font', 'Lettertype', [['lexend', 'Lexend', ' style="font-family:Lexend"'], ['dyslexic', 'OpenDyslexic', ' style="font-family:OpenDyslexic"'], ['verdana', 'Verdana', ' style="font-family:Verdana"']]) +
      optionRow('size', 'Grootte van de letters', [['s', 'Klein'], ['m', 'Normaal'], ['l', 'Groot'], ['xl', 'Extra groot']]) +
      optionRow('spacing', 'Ruimte tussen de regels', [['normaal', 'Normaal'], ['ruim', 'Ruim'], ['extra', 'Extra ruim']]) +
      optionRow('theme', 'Achtergrondkleur', [['creme', 'Crème', ' class="swatch creme"'], ['blauw', 'Blauw', ' class="swatch blauw"'], ['groen', 'Groen', ' class="swatch groen"'], ['perzik', 'Perzik', ' class="swatch perzik"'], ['donker', 'Donker', ' class="swatch donker"']]) +
      optionRow('sessionSize', 'Vragen per rondje', [['5', '5'], ['8', '8'], ['12', '12']]) +
      '<fieldset class="setting"><legend>' + sayOne('Voorlezen') + '</legend>' +
        (speech.canSpeak ? '' : '<p class="muted">Voorlezen werkt niet in deze browser.</p>') +
        '<label class="switch"><input type="checkbox" name="autoRead"' + (settings.autoRead ? ' checked' : '') + '> ' + sayOne('Lees vragen en uitleg vanzelf voor') + '</label>' +
        '<label class="range">' + sayOne('Snelheid') + ' <input type="range" name="rate" min="0.6" max="1.3" step="0.05" value="' + settings.rate + '"> <output>' + settings.rate + '×</output></label>' +
        '<button type="button" class="btn ghost test-voice">🔊 Test de stem</button>' +
        (speech.canSpeak && !speech.hasDutchVoice() ? '<p class="muted small">Geen Nederlandse stem gevonden. Op iPhone: Instellingen → Toegankelijkheid → Gesproken materiaal → Stemmen → Nederlands.</p>' : '') +
      '</fieldset>' +
      '<fieldset class="setting"><legend>' + sayOne('Leesliniaal') + '</legend>' +
        '<label class="switch"><input type="checkbox" name="ruler"' + (settings.ruler ? ' checked' : '') + '> ' + sayOne('Laat een lees-strook zien die je vinger of muis volgt') + '</label>' +
      '</fieldset>' +
    '</form>' +

    '<section class="card"><h3>' + sayOne('Op je beginscherm zetten') + '</h3>' +
      (standalone ? '<p>' + sayOne('De app staat al op je beginscherm. 👍') + '</p>' :
        ios ? '<p>' + say('Tik in Safari op de deel-knop. Kies daarna: Zet op beginscherm.') + '</p>' :
        '<p>' + say('Zet Leerhulp op je beginscherm. Dan werkt het ook zonder internet.') + '</p><button type="button" class="btn primary install"' + (installPrompt ? '' : ' hidden') + '>📲 Installeren</button>' +
        (installPrompt ? '' : '<p class="muted small">Gebruik het menu van je browser: App installeren / Toevoegen aan startscherm.</p>')) +
    '</section>' +

    '<section class="card"><h3>' + sayOne('Back-up van je voortgang') + '</h3>' +
      '<p class="muted small">Je voortgang staat alleen op dit apparaat. Maak een back-up om hem mee te nemen naar een ander apparaat.</p>' +
      '<div class="actions-list">' +
        '<button type="button" class="btn export">💾 Back-up downloaden</button>' +
        '<label class="btn import">📂 Back-up terugzetten<input type="file" accept="application/json,.json" hidden></label>' +
        '<button type="button" class="btn ghost danger reset">🗑️ Alle voortgang wissen</button>' +
      '</div>' +
    '</section>' +

    '<section class="card about"><h3>Over deze app</h3>' +
      '<p class="small">Gemaakt voor leerlingen met dyslexie: korte stukjes tekst, alles kan worden voorgelezen, weinig typen, rustige kleuren en een lettertype naar keuze. ' +
      'Herhaling gaat slim: wat je goed weet zie je minder vaak, wat lastig is komt vaker terug.</p>' +
    '</section>';

  const form = view.querySelector('.settings');
  form.addEventListener('change', event => {
    const input = event.target;
    if (!input.name) return;
    if (input.type === 'checkbox') settings[input.name] = input.checked;
    else if (input.name === 'sessionSize' || input.name === 'rate') settings[input.name] = Number(input.value);
    else settings[input.name] = input.value;
    saveSettings();
    applySettings();
  });
  form.querySelector('[name="rate"]').addEventListener('input', event => {
    form.querySelector('output').textContent = event.target.value + '×';
    settings.rate = Number(event.target.value);
    saveSettings();
  });
  view.querySelector('.test-voice').addEventListener('click', () => speech.readText('Hoi! Zo klink ik. Economie gaat over keuzes maken.'));

  const install = view.querySelector('.install');
  if (install) install.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    install.hidden = true;
  });

  view.querySelector('.export').addEventListener('click', () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'leerhulp-backup-' + dayKey() + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  view.querySelector('.import input').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      importData(await file.text());
      applySettings();
      alert('Je voortgang is teruggezet.');
      location.hash = '#/';
    } catch (error) {
      alert(error.message || 'Dat bestand kon niet worden gelezen.');
    }
  });

  view.querySelector('.reset').addEventListener('click', () => {
    if (confirm('Weet je het zeker? Al je voortgang wordt gewist.') && confirm('Echt alles wissen?')) {
      resetProgress();
      location.hash = '#/';
    }
  });
}

// ---------- Router ----------

async function route() {
  speech.stop();
  readTargets = () => [view];
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [name, ...args] = parts;
  window.scrollTo(0, 0);

  try {
    if (!name) await home();
    else if (name === 'vak') await subjectView(args[0]);
    else if (name === 'h') await chapterView(args[0], args[1]);
    else if (name === 'p') await sectionView(args[0], args[1], args[2]);
    else if (name === 'uitleg') await learnView(args[0], args[1], args[2], args[3]);
    else if (name === 'oefen' || name === 'kaarten') await sessionView(name, args[0], args[1], args[2]);
    else if (name === 'voortgang') await progressView();
    else if (name === 'instellingen') settingsView();
    else location.hash = '#/';
  } catch (error) {
    console.error(error);
    setBar('Oeps', '#/');
    view.innerHTML = '<section class="card"><h2>' + sayOne('Oeps, dat ging mis.') + '</h2><p>' + esc(error.message) + '</p>' +
      '<p class="muted small">Heb je geen internet? Open de app een keer met internet, dan werkt hij daarna ook offline.</p>' +
      '<a class="btn primary" href="#/">Naar het begin</a></section>';
  }
  view.focus({ preventScroll: true });
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});

applySettings();
route();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker:', error));
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

