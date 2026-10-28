// Loads the catalog and chapter files, and gives every practice item a
// stable key: "<subject>/<chapter>/<question id>" or ".../t:<term>".

const BASE = new URL('../content/', import.meta.url);
let catalogPromise = null;
const chapterCache = new Map();

async function getJSON(path) {
  const response = await fetch(new URL(path, BASE));
  if (!response.ok) throw new Error('Kon ' + path + ' niet laden');
  return response.json();
}

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = getJSON('catalog.json').catch(error => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

export async function getSubject(subjectId) {
  const catalog = await loadCatalog();
  const subject = catalog.subjects.find(s => s.id === subjectId);
  if (!subject) throw new Error('Vak niet gevonden');
  return subject;
}

export async function loadChapter(subjectId, chapterId) {
  const id = subjectId + '/' + chapterId;
  if (chapterCache.has(id)) return chapterCache.get(id);

  const subject = await getSubject(subjectId);
  const meta = subject.chapters.find(c => c.id === chapterId);
  if (!meta) throw new Error('Hoofdstuk niet gevonden');

  const chapter = await getJSON(meta.file);
  chapter.key = id;
  chapter.subject = subject;
  chapter.items = new Map();

  for (const section of chapter.sections) {
    section.chapter = chapter;
    section.key = id + '/' + section.id;
    section.questionKeys = section.questions.map(q => {
      const key = id + '/' + q.id;
      chapter.items.set(key, { kind: 'question', section, data: q });
      return key;
    });
    section.termKeys = (section.terms || []).map(t => {
      const key = id + '/t:' + t.term;
      chapter.items.set(key, { kind: 'term', section, data: t });
      return key;
    });
  }

  chapterCache.set(id, chapter);
  return chapter;
}

export async function loadSubjectChapters(subjectId) {
  const subject = await getSubject(subjectId);
  return Promise.all(subject.chapters.map(c => loadChapter(subjectId, c.id)));
}

export function allKeys(chapter, kind) {
  return chapter.sections.flatMap(s => kind === 'term' ? s.termKeys : s.questionKeys);
}

// Finds an item from its key, loading its chapter if needed
export async function resolveItem(key) {
  const [subjectId, chapterId] = key.split('/');
  const chapter = await loadChapter(subjectId, chapterId);
  return chapter.items.get(key) || null;
}
