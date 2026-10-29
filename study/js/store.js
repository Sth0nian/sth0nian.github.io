// Settings and progress, kept in localStorage on this device.
// Progress uses Leitner boxes: a right answer moves an item up a box and
// pushes its next review further out; a wrong answer sends it back to box 1.

const SETTINGS_KEY = 'study.settings.v1';
const PROGRESS_KEY = 'study.progress.v1';
const DAY = 24 * 60 * 60 * 1000;

const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = INTERVAL_DAYS.length - 1;
export const KNOWN_BOX = 3;

export const DEFAULT_SETTINGS = {
  font: 'lexend',
  size: 'm',
  theme: 'creme',
  spacing: 'ruim',
  rate: 0.9,
  autoRead: false,
  sessionSize: 8,
  ruler: false
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage full or blocked: keep going in memory
  }
}

function emptyProgress() {
  return { items: {}, learn: {}, goals: {}, session: null, last: null, streak: { count: 0, day: null }, days: {} };
}

export const settings = { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY) };
export const progress = { ...emptyProgress(), ...read(PROGRESS_KEY) };

export function saveSettings() { write(SETTINGS_KEY, settings); }
export function saveProgress() { write(PROGRESS_KEY, progress); }

export function dayKey(time = Date.now()) {
  const d = new Date(time);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function startOfDay(time) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function countToday() {
  const today = dayKey();
  progress.days[today] = (progress.days[today] || 0) + 1;

  if (progress.streak.day !== today) {
    const yesterday = dayKey(Date.now() - DAY);
    progress.streak.count = progress.streak.day === yesterday ? progress.streak.count + 1 : 1;
    progress.streak.day = today;
  }
}

export function record(key, correct) {
  const item = progress.items[key] || { b: 0, seen: 0, right: 0, wrong: 0 };
  item.seen++;
  if (correct) {
    item.right++;
    item.b = Math.min(MAX_BOX, item.b + 1);
  } else {
    item.wrong++;
    item.b = 1;
  }
  item.last = Date.now();
  item.due = startOfDay(item.last) + INTERVAL_DAYS[item.b] * DAY;
  progress.items[key] = item;
  countToday();
  saveProgress();
}

export function isDue(key) {
  const item = progress.items[key];
  return !!item && item.due <= Date.now();
}

// What to practise next: due items (weakest first), then new ones in book
// order, then the rest from weakest to strongest.
export function pick(keys, count) {
  const due = [];
  const fresh = [];
  const rest = [];
  for (const key of keys) {
    const item = progress.items[key];
    if (!item) fresh.push(key);
    else if (item.due <= Date.now()) due.push(key);
    else rest.push(key);
  }
  const byStrength = (a, b) => progress.items[a].b - progress.items[b].b || progress.items[a].last - progress.items[b].last;
  due.sort(byStrength);
  rest.sort(byStrength);
  return [...due, ...fresh, ...rest].slice(0, count);
}

export function mastery(keys) {
  let known = 0;
  let seen = 0;
  let due = 0;
  let steps = 0;
  for (const key of keys) {
    const item = progress.items[key];
    if (!item) continue;
    seen++;
    steps += Math.min(item.b, KNOWN_BOX);
    if (item.b >= KNOWN_BOX) known++;
    if (item.due <= Date.now()) due++;
  }
  // Every right answer moves the bar; it is full once everything is known
  const percent = keys.length ? Math.round((steps / (keys.length * KNOWN_BOX)) * 100) : 0;
  return { total: keys.length, known, seen, due, percent };
}

export function exportData() {
  return JSON.stringify({ app: 'leerhulp', version: 1, exported: new Date().toISOString(), settings, progress }, null, 1);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'leerhulp' || !data.progress) throw new Error('Dit is geen back-up van Leerhulp.');
  Object.assign(settings, DEFAULT_SETTINGS, data.settings || {});
  for (const key of Object.keys(progress)) delete progress[key];
  Object.assign(progress, emptyProgress(), data.progress);
  saveSettings();
  saveProgress();
}

export function resetProgress() {
  for (const key of Object.keys(progress)) delete progress[key];
  Object.assign(progress, emptyProgress());
  saveProgress();
}
