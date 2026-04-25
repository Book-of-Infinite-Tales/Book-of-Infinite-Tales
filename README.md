# Book of Infinite Tales

A community reader for custom encounter books inspired by the board game *Tales of the Arthurian Knights*.

This app is a navigation-only encounter resolver. You paste a GitHub repo URL and it fetches a **Book of Tales** manifest from that repo, then lets you read entries and follow choices.

- No state tracking. The app does not track knight stats, virtue/sin, items, or quest flags — it only resolves paragraphs and choices.
- No official content. This project ships empty. The official *Book of Tales* is copyrighted by WizKids and is **not** included or endorsed. Only user-authored books are loaded at runtime. Book authors are responsible for the content they publish.

## Run locally

```
npm install
npm run dev
```

Build: `npm run build`. Typecheck: `npm run typecheck`.

## Book format (`book-of-infinite-tales/v1`)

A book is a public GitHub repo containing a `book.json` manifest at the root (or at a subdirectory — see "Loading" below).

### `book.json`

```json
{
  "schema": "book-of-infinite-tales/v1",
  "title": "The Hermit's Clearing",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "Optional short blurb",
  "entries": "entries.json"
}
```

- `schema` — must be exactly `"book-of-infinite-tales/v1"`.
- `entries` — either the filename of a JSON file containing your entries, **or** an inline object keyed by entry id.

### Entries file

An array of entry objects (or an object keyed by id):

```json
[
  {
    "id": "1",
    "title": "A Clearing in the Wood",
    "body": "You come upon a mossy clearing...\n\nDouble newlines start a new paragraph.",
    "choices": [
      { "label": "Sit and share his meal.", "goto": "2" },
      { "label": "Ask his name.", "goto": "3" }
    ]
  }
]
```

- `id` — any string; numeric ids sort naturally in the entry picker.
- `title` — optional.
- `body` — prose. Split paragraphs with blank lines (`\n\n`).
- `choices` — optional array. `goto` must reference another entry's id. Entries without choices are terminal.

See [`examples/sample-book`](examples/sample-book) for a working example.

## Loading

Enter any of these formats in the loader:

- `owner/repo`
- `owner/repo@branch-or-tag`
- `owner/repo@ref/path/to/book-dir`
- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/branch/path/to/book-dir`

The repo must be public. Files are fetched via `raw.githubusercontent.com` — no GitHub auth is used.

## Publishing a book

1. Create a public GitHub repo.
2. Add a `book.json` at the root (or in a subdirectory).
3. Add your entries as a separate JSON file referenced by the manifest, or inline in the manifest.
4. Share the repo with players — they paste `owner/repo` into the app.

## License

MIT for the app code. Book content loaded at runtime is the property of its author(s).
