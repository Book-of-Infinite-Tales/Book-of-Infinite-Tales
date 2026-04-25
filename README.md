# Book of Infinite Tales

A community reader for custom Books of Tales inspired by the board game *Tales of the Arthurian Knights*.

Load a public GitHub repo — the app fetches its `book.json` and lets you read passages and follow choices through encounters. No state tracking, no official content — the app ships empty.

- **No state tracking.** The app resolves passages and choices only. Knight stats, virtue/sin, items, and quest flags are tracked by the players at the table.
- **No official content.** The official *Book of Tales* is © WizKids and is not included or endorsed. Only user-authored books are loaded at runtime.

## Run locally

```
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build
npm run typecheck # type-check only
npm test          # unit tests (Vitest)
```

## Book format

A Book of Tales is a public GitHub repo containing a `book.json` at the root (or in a subdirectory). See the [Book of Tales Template](https://github.com/RobMcA/Book-of-Tales-Template) to start your own, and the [book-of-tales-example](https://github.com/RobMcA/book-of-tales-example) for full format documentation.

### Quick reference

**`book.json`** — the book itself:
```json
{
  "schema": "book-of-infinite-tales/v1",
  "title": "My Book of Tales",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "One sentence.",
  "components": "tales-of-the-arthurian-knights-components.json",
  "entries": [
    { "id": "1000", "title": "Age 1 Begins", "body": "..." },
    { "id": "1234", "body": "...", "responses": [...] },
    { "id": "1235", "body": "...", "resolutions": [...] }
  ]
}
```

**`components.json`** (or any filename) — the game's physical components:
```json
{
  "ages": [...], "terrains": [...], "features": [...],
  "characters": [...], "locations": [...], "milieus": [...],
  "quests": [...], "skills": [...], "statuses": [...], "storyTokens": [...]
}
```

For a collection of multiple Books of Tales in one repo, use a `books.json` index at the root instead.

## Loading

Enter any of these in the loader:

```
owner/repo
owner/repo@branch
owner/repo@ref/path/to/book-dir
https://github.com/owner/repo
https://github.com/owner/repo/tree/branch/path
```

The repo must be public. Files are fetched via `raw.githubusercontent.com` — no GitHub auth required.

## Contributing a book

Submit your Book of Tales to the [Library of Infinite Tales](https://github.com/RobMcA/Library-of-Infinite-Tales) to have it appear in the community section of the reader.

## License

MIT — see [LICENSE.md](LICENSE.md). Book content loaded at runtime is the property of its respective author(s).
