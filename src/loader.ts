import type {
  Book,
  BookIndex,
  BookManifest,
  BookSource,
  Entry,
  ResolutionTarget,
} from './types';
import { INDEX_SCHEMA_VERSION } from './types';
import { validateEntries, validateManifest, validateStructure } from './validate';

const RAW_BASE = 'https://raw.githubusercontent.com';

// ---------------------------------------------------------------------------
// GitHub source parsing
// ---------------------------------------------------------------------------

export function parseGithubInput(input: string): BookSource | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s#?]+)(?:\/tree\/([^\/\s#?]+)(?:\/(.+?))?)?\/?$/,
  );
  if (urlMatch) {
    const [, owner, repo, ref, path] = urlMatch;
    return { kind: 'github', owner, repo: stripGit(repo), ref, path };
  }

  const shortMatch = trimmed.match(/^([^\/\s]+)\/([^\/\s@#]+)(?:@([^\/\s]+))?(?:\/(.+))?$/);
  if (shortMatch) {
    const [, owner, repo, ref, path] = shortMatch;
    return { kind: 'github', owner, repo: stripGit(repo), ref, path };
  }

  return null;
}

function stripGit(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo;
}

function rawUrl(source: BookSource, file: string): string {
  const ref = source.ref ?? 'main';
  const dir = source.path ? `${source.path.replace(/\/$/, '')}/` : '';
  return `${RAW_BASE}/${source.owner}/${source.repo}/${ref}/${dir}${file}`;
}

export function formatSource(source: BookSource): string {
  const base = `${source.owner}/${source.repo}`;
  const ref = source.ref ? `@${source.ref}` : '';
  const path = source.path ? `/${source.path}` : '';
  return `${base}${ref}${path}`;
}

// ---------------------------------------------------------------------------
// Discovery — tries book.json then books.json
// ---------------------------------------------------------------------------

export type DiscoverResult =
  | { kind: 'book'; book: Book }
  | { kind: 'index'; index: BookIndex; source: BookSource };

/**
 * Probes a source for either a single book (book.json) or a multi-book
 * collection (books.json). Returns whichever is found first.
 */
export async function discover(source: BookSource): Promise<DiscoverResult> {
  const bookUrl = rawUrl(source, 'book.json');
  const bookResp = await fetch(bookUrl);

  if (bookResp.ok) {
    const book = await finishLoadingBook(source, bookResp);
    return { kind: 'book', book };
  }

  if (bookResp.status !== 404) {
    throw new Error(
      `Could not fetch book.json from ${source.owner}/${source.repo}. ` +
        `HTTP ${bookResp.status}. Check the repo is public${source.path ? ` and the path /${source.path} is correct` : ''}.`,
    );
  }

  const indexUrl = rawUrl(source, 'books.json');
  const indexResp = await fetch(indexUrl);

  if (!indexResp.ok) {
    throw new Error(
      `No book.json or books.json found in ${source.owner}/${source.repo}` +
        (source.path ? `/${source.path}` : '') +
        `. Check the repo is public and contains one of these files at the root${source.path ? ` of /${source.path}` : ''}.`,
    );
  }

  let index: BookIndex;
  try {
    index = (await indexResp.json()) as BookIndex;
  } catch {
    throw new Error('books.json is not valid JSON.');
  }

  validateIndex(index);
  return { kind: 'index', index, source };
}

// ---------------------------------------------------------------------------
// Loading — fetches and validates a single book
// ---------------------------------------------------------------------------

export async function loadBook(source: BookSource): Promise<Book> {
  const manifestUrl = rawUrl(source, 'book.json');
  const manifestResp = await fetch(manifestUrl);
  if (!manifestResp.ok) {
    throw new Error(
      `Could not fetch book.json from ${source.owner}/${source.repo}. ` +
        `HTTP ${manifestResp.status}. Check the repo is public and contains book.json at the root${
          source.path ? ` of /${source.path}` : ''
        }.`,
    );
  }
  return finishLoadingBook(source, manifestResp);
}

async function finishLoadingBook(source: BookSource, manifestResp: Response): Promise<Book> {
  let manifest: BookManifest;
  try {
    manifest = (await manifestResp.json()) as BookManifest;
  } catch {
    throw new Error('book.json is not valid JSON.');
  }

  validateManifest(manifest);

  let entries: Record<string, Entry>;
  if (typeof manifest.entries === 'string') {
    const entriesResp = await fetch(rawUrl(source, manifest.entries));
    if (!entriesResp.ok) {
      throw new Error(
        `Could not fetch entries file "${manifest.entries}" (HTTP ${entriesResp.status}).`,
      );
    }
    const raw = (await entriesResp.json()) as Entry[] | Record<string, Entry>;
    entries = Array.isArray(raw) ? indexEntries(raw) : raw;
  } else {
    entries = manifest.entries;
  }

  validateEntries(entries);

  if (manifest.structure) {
    validateStructure(manifest.structure, new Set(Object.keys(entries)));
  }

  return { manifest, entries, source };
}

function indexEntries(list: Entry[]): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const e of list) {
    if (!e.id) throw new Error('Every entry must have an id.');
    out[e.id] = e;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Index validation
// ---------------------------------------------------------------------------

function validateIndex(index: BookIndex): void {
  if (index.schema !== INDEX_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported index schema: "${index.schema ?? '(missing)'}". Expected "${INDEX_SCHEMA_VERSION}".`,
    );
  }
  if (!index.title) throw new Error('books.json is missing a title.');
  if (!Array.isArray(index.books) || index.books.length === 0) {
    throw new Error('books.json must contain a non-empty "books" array.');
  }
  for (const entry of index.books) {
    if (!entry.path) throw new Error('Each entry in books.json must have a path.');
    if (!entry.title) throw new Error(`books.json entry "${entry.path}" is missing a title.`);
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export function formatTarget(target: ResolutionTarget): string {
  if (typeof target === 'number') return `≥ ${target}`;
  return `≥ ${target.base} + Location #`;
}
