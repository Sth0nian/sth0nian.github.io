// Read-aloud with a Dutch voice. Reads the .say spans inside an element one
// by one and highlights the sentence that is being spoken.

import { settings } from './store.js';

export const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voice = null;
let run = 0;
let current = null;
let speakingNow = false;
const listeners = new Set();

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const dutch = voices.filter(v => /^nl([-_]|$)/i.test(v.lang));
  voice =
    dutch.find(v => /nl[-_]NL/i.test(v.lang) && /siri|premium|enhanced|natural|google/i.test(v.name)) ||
    dutch.find(v => /nl[-_]NL/i.test(v.lang)) ||
    dutch[0] ||
    null;
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

export function hasDutchVoice() {
  return !!voice;
}

// Symbols a voice tends to skip or misread
function speakable(text) {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/÷/g, ' gedeeld door ')
    .replace(/×/g, ' keer ')
    .replace(/(\d)\s*[−-]\s*(\d)/g, '$1 min $2')
    .replace(/−/g, ' min ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' is ')
    .replace(/→/g, ' wordt ')
    .replace(/⅓/g, 'een derde')
    .replace(/t\/m/g, 'tot en met')
    .replace(/…/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function setActive(span) {
  if (current) current.classList.remove('reading');
  current = span;
  if (span) {
    span.classList.add('reading');
    span.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function notify(speaking) {
  speakingNow = speaking;
  listeners.forEach(fn => fn(speaking));
}

export function onSpeakingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSpeaking() {
  return speakingNow;
}

export function stop() {
  run++;
  if (canSpeak) speechSynthesis.cancel();
  setActive(null);
  notify(false);
}

function utter(text) {
  const utterance = new SpeechSynthesisUtterance(speakable(text));
  utterance.lang = voice ? voice.lang : 'nl-NL';
  if (voice) utterance.voice = voice;
  utterance.rate = Number(settings.rate) || 0.9;
  return utterance;
}

// Reads every .say span inside the given elements, in order
export function readAloud(...elements) {
  if (!canSpeak) return;
  stop();
  const spans = elements.filter(Boolean).flatMap(el => [...el.querySelectorAll('.say')])
    .filter(span => span.offsetParent !== null && span.textContent.trim());
  if (!spans.length) return;

  const thisRun = ++run;
  notify(true);
  let index = 0;

  const next = () => {
    if (thisRun !== run) return;
    if (index >= spans.length) {
      setActive(null);
      notify(false);
      return;
    }
    const span = spans[index++];
    setActive(span);
    const utterance = utter(span.textContent);
    utterance.onend = next;
    utterance.onerror = next;
    speechSynthesis.speak(utterance);
  };
  next();
}

export function readText(text) {
  if (!canSpeak) return;
  stop();
  const thisRun = ++run;
  const utterance = utter(text);
  utterance.onend = () => { if (thisRun === run) notify(false); };
  notify(true);
  speechSynthesis.speak(utterance);
}
