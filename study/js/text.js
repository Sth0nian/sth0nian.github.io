// Text helpers: escaping, a tiny **bold** markup, and splitting text into
// sentences so read-aloud can highlight one sentence at a time.

export function esc(text) {
  return String(text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

export function bold(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Splits on sentence ends, keeping numbers like "€ 2,50." together
function splitSentences(text) {
  const parts = String(text).match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
  return (parts || [text]).map(part => part.trim()).filter(Boolean);
}

// Each sentence becomes a <span class="say"> that the reader walks through
export function say(text) {
  return splitSentences(text).map(sentence => '<span class="say">' + bold(sentence) + '</span>').join(' ');
}

// A single span that is read as one piece (options, terms, buttons)
export function sayOne(text) {
  return '<span class="say">' + bold(text) + '</span>';
}

export function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function formatNumber(value, decimals, unit) {
  const text = Number(value).toLocaleString('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  if (unit === '€') return '€ ' + text;
  if (unit === '%') return text + '%';
  return text;
}

// Reads what a kid types: "3,65", "3.65", "€ 1.065,47", "22303.18", "19%".
// Returns every sensible reading so "1.065" can mean 1065 or 1,065.
export function parseNumber(input) {
  let text = String(input).replace(/[€%\s]/g, '').replace(/,-$/, '');
  if (!text) return [];
  const readings = new Set();
  if (text.includes(',')) {
    readings.add(Number(text.replace(/\./g, '').replace(',', '.')));
  } else if (text.includes('.')) {
    readings.add(Number(text));
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) readings.add(Number(text.replace(/\./g, '')));
  } else {
    readings.add(Number(text));
  }
  return [...readings].filter(n => Number.isFinite(n));
}
