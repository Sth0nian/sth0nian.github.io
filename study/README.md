# Leerhulp (`/study/`)

A study aid PWA for a dyslexic first-year mavo student. It lives at
`https://sth0nian.github.io/study/` and is deliberately **not linked** from any
other page. It also has `noindex` so search engines skip it.

It installs as its own app ("Leerhulp", scope `/study/`). Progress stays on
the device in `localStorage`. You can back it up and restore it under
Instellingen.

## How it helps with dyslexia

- Lexend font by default, plus OpenDyslexic or Verdana. Text size, line
  spacing and background tint can all be changed. Text is left-aligned with no
  italics, and lines are kept short.
- Every screen can be read aloud with a Dutch voice, one sentence at a time,
  with the current sentence highlighted. Auto-read is optional.
- There is little typing. Most answers are taps: multiple choice, true/false,
  sorting, matching and word banks. Number answers accept `3,65`, `3.65`,
  `€ 1.065,47` and so on.
- Text comes in small steps: short explanation cards, then flashcards for the
  terms, then questions. A wrong answer gives a calm hint and shows the worked
  steps, and that question comes back later in the same round.
- Spaced repetition (Leitner boxes) brings back weak items more often and
  known items less often. A round is 5, 8 or 12 questions and can be stopped
  at any time. "Ga verder" on the home screen resumes where he left off.
- There is an optional reading ruler and no timers.

## Adding content

Everything is data. You never need to touch the code.

1. Add a chapter file, e.g. `content/economie/h2.json`. Copy the structure of
   `content/economie/h1.json`.
2. List it in `content/catalog.json` under its subject. To add a new subject,
   add a new entry to `subjects` with an `id`, `title`, `icon` and `color`.

The service worker reads the catalog on install and caches every chapter it
lists, so new chapters also work offline.

### Chapter format

```jsonc
{
  "id": "h2", "number": 2, "title": "…",
  "sections": [{
    "id": "2.1", "title": "…", "intro": "…",
    "goals": ["Ik kan …"],
    "learn": [{ "icon": "🛒", "title": "…", "text": ["Short sentences. **Bold** = key term."],
                "list": ["…"], "example": "…", "check": { /* any question, not graded */ } }],
    "terms": [{ "term": "…", "def": "…", "example": "…" }],
    "questions": [ /* see below */ ]
  }]
}
```

Question `id`s must be **unique and never change**, because progress is
stored per id. Add new questions with new ids rather than renumbering.

| type | fields |
| --- | --- |
| `mc` | `prompt`, `options[]`, `answer` (index), `keepOrder?` |
| `tf` | `prompt` (the statement), `answer` (true/false) |
| `number` | `prompt`, `answer`, `decimals`, `unit?` (`€`/`%`), `hint?`, `steps[]?`, `rekenen?` |
| `classify` | `prompt`, `buckets[]`, `items[[label, bucketIndex]]` |
| `match` | `prompt`, `pairs[[left, right]]` |
| `fill` | `prompt`, `text` with `{answer}` blanks, `bank[]` (may include extra words) |
| `open` | `prompt`, `model` (the student marks their own answer) |

Every type also accepts `explain`, which is shown after the answer.

## Updating the app

Pages and content are served network-first, so changes show up on the next
online visit. If you change the list of files in `sw.js` (`SHELL`), bump
`VERSION` there.
