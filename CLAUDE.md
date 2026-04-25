# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite, port 5173)
npm run build      # tsc -b then vite build
npm run typecheck  # type-check only, no emit
```

There are no tests — `typecheck` is the only automated check.

## What this app is

A navigation-only encounter resolver for custom *Book of Tales* supplements for the board game *Tales of the Arthurian Knights*. Users paste a GitHub repo URL; the app fetches that repo's `book.json` manifest and lets them read passages and follow choices. No state tracking, no official content — the app ships empty.

## Architecture

**Single-page app**: Vite + React 18 + TypeScript. No backend. All book data is fetched at runtime from GitHub via `raw.githubusercontent.com`.

**Three-mode shell** (`App.tsx`): `home` → `picker` → `reader`. `App` owns the loaded `Book` and navigates between modes. `library.ts` persists recently-loaded books to `localStorage`.

**Loader** (`loader.ts`): parses GitHub URLs/shorthand into a `BookSource`, fetches `book.json`, resolves a separate entries file if needed, fetches and validates the components file if declared, then runs validation across entries and components. Validation errors are surfaced as thrown `Error` messages shown in the UI.

**Encounter picker** (`EncounterPicker.tsx`): When the book declares a `components` file, guides the player through selecting an age, encounter type (character, location, milieu, quest), and sub-selectors that compute a passage id. Without components, shows a bare passage-number input.

**Reader** (`Reader.tsx`): Renders an `Entry`. Supports three passage patterns from the physical book:
- *Response passage* — `entry.responses[]`: italic narrative choices, each a button linking to another entry.
- *Resolution passage* — `entry.resolutions[]`: skill-check cards with a commit-then-reveal flow (commit → see target difficulty → reveal success or failure outcome separately).
- *Result/terminal passage* — `entry.rewards` and/or `entry.goto`.

Maintains a `history` stack for the ← Back button. Jump-to-entry via a `<datalist>` input.

## Schema (`src/types.ts`)

`types.ts` is the single source of truth for the `book-of-infinite-tales/v1` format. Key design points:

- `ResolutionTarget`: either a plain number (fixed difficulty) or `{ base: number, addLocationNumber: true }` (difficulty = base + the space's Location # on the board).
- `RenownType`: `'Divinity' | 'Romance' | 'Villainy' | 'Any'`. Use `'Any'` when the book prints "1 Rank of Renown" with no track specified (player chooses). Rendered as "Gain N Ranks of Renown (your choice)".
- `Reward.destiny`: accepts `"location_number"` when the destiny gained equals the space's Location #.
- Entries may mix `responses`, `resolutions`, `rewards`, and `goto` for non-standard passage flows.

When adding a new field to a type, also update the validation in `loader.ts` (especially the renown type allowlist at the `validateReward` function) and the renderer in `Reader.tsx`.

## Book format notes (for authoring guidance)

A book repo contains two files:
- **`book.json`** — the book itself: schema, title, author, version, description, `components` filename reference, and the entries (inline array or a filename reference).
- **`components.json`** (or any name) — the board game components: ages, terrains, features, characters, locations, milieus, quests. Multiple books can share one components file.

The README in `book-of-tales-example` documents the format from a book-author perspective. The schema in `types.ts` is more expressive than the README's simplified example — the README may lag the schema. The `examples/sample-book/` directory has a working minimal book.
