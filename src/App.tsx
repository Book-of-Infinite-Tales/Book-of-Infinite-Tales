import { useEffect, useMemo, useState } from 'react';
import type { Book, BookIndex, BookSource } from './types';
import { discover, formatSource, loadBook, parseGithubInput } from './loader';
import { type LibraryEntry, readLibrary, removeFromLibrary, saveToLibrary } from './library';
import { type RegistryBook, fetchRegistry, registryBookToSource } from './registry';
import { EncounterPicker } from './EncounterPicker';
import { Reader } from './Reader';

type AppMode = 'home' | 'collection' | 'picker' | 'reader';

export function App() {
  const [book, setBook] = useState<Book | null>(null);
  const [mode, setMode] = useState<AppMode>('home');
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [encounterLabel, setEncounterLabel] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => readLibrary());

  const [collection, setCollection] = useState<{ index: BookIndex; source: BookSource } | null>(null);
  const [collectionLoading, setCollectionLoading] = useState<string | null>(null);

  const [registry, setRegistry] = useState<RegistryBook[]>([]);
  const [registryLoading, setRegistryLoading] = useState(true);

  useEffect(() => {
    fetchRegistry().then((r) => {
      setRegistry(r.books);
      setRegistryLoading(false);
    });
  }, []);

  async function handleDiscover(source: BookSource) {
    setLoading(true);
    setError(null);
    try {
      const result = await discover(source);
      if (result.kind === 'book') {
        setBook(result.book);
        setLibrary(
          saveToLibrary({ source, title: result.book.manifest.title, addedAt: Date.now(), aiGenerated: result.book.manifest.aiGenerated }),
        );
        setMode('picker');
      } else {
        setCollection({ index: result.index, source: result.source });
        setMode('collection');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoad(source: BookSource) {
    setCollectionLoading(source.path ?? null);
    setError(null);
    try {
      const loaded = await loadBook(source);
      setBook(loaded);
      setLibrary(
        saveToLibrary({ source, title: loaded.manifest.title, addedAt: Date.now(), aiGenerated: loaded.manifest.aiGenerated }),
      );
      setMode('picker');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCollectionLoading(null);
    }
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const source = parseGithubInput(input);
    if (!source) {
      setError('Enter a GitHub repo as "owner/repo", "owner/repo@ref", or a github.com URL.');
      return;
    }
    handleDiscover(source);
  }

  function handleRemove(source: BookSource) {
    setLibrary(removeFromLibrary(source));
  }

  function openEntry(entryId: string, label?: string) {
    setOpenEntryId(entryId);
    setEncounterLabel(label);
    setMode('reader');
  }

  function backToPicker() {
    setOpenEntryId(null);
    setEncounterLabel(undefined);
    setMode('picker');
  }

  function backToHome() {
    setBook(null);
    setCollection(null);
    setOpenEntryId(null);
    setEncounterLabel(undefined);
    setMode('home');
    setInput('');
    setError(null);
  }

  function backToCollection() {
    setBook(null);
    setOpenEntryId(null);
    setEncounterLabel(undefined);
    setMode('collection');
    setError(null);
  }

  if (mode === 'reader' && book && openEntryId) {
    return (
      <Reader
        book={book}
        initialEntryId={openEntryId}
        encounterLabel={encounterLabel}
        onBackToPicker={backToPicker}
        onClose={backToHome}
      />
    );
  }

  if (mode === 'picker' && book) {
    return (
      <EncounterPicker
        book={book}
        onSelect={openEntry}
        onClose={collection ? backToCollection : backToHome}
      />
    );
  }

  if (mode === 'collection' && collection) {
    return (
      <main className="home">
        <header className="home-header">
          <h1>{collection.index.title}</h1>
          {collection.index.author && (
            <p className="tagline">by {collection.index.author}</p>
          )}
          {collection.index.description && (
            <p className="tagline">{collection.index.description}</p>
          )}
        </header>

        <section className="card">
          <h2>Choose a book</h2>
          {error && <p className="error">{error}</p>}
          <ul className="library">
            {collection.index.books.map((entry) => {
              const bookSource: BookSource = {
                ...collection.source,
                path: collection.source.path
                  ? `${collection.source.path}/${entry.path}`
                  : entry.path,
              };
              const isLoading = collectionLoading === bookSource.path;
              return (
                <li key={entry.path} className="library-row">
                  <button
                    className="library-open"
                    onClick={() => handleLoad(bookSource)}
                    disabled={collectionLoading !== null}
                  >
                    <span className="library-title">
                      {entry.title}
                      {entry.aiGenerated && <span className="ai-badge">AI Generated</span>}
                    </span>
                    {entry.description && (
                      <span className="library-source">{entry.description}</span>
                    )}
                    {isLoading && <span className="library-source">Loading…</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="home-footer">
          <button className="link-button" onClick={backToHome}>
            ← Back
          </button>
        </footer>
      </main>
    );
  }

  return (
    <main className="home">
      <header className="home-header">
        <h1>Book of Infinite Tales</h1>
        <p className="tagline">
          A community reader for custom Books of Tales inspired by <em>Tales of the Arthurian Knights</em>.
        </p>
      </header>

      <section className="card">
        <h2>Load a book from GitHub</h2>
        <form onSubmit={handleSubmit} className="loader-form">
          <input
            type="text"
            value={input}
            placeholder="owner/repo  or  https://github.com/owner/repo"
            onChange={(e) => setInput(e.target.value)}
            aria-label="GitHub repository"
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="hint">
          Example: <code>owner/my-tales-book</code> — the repo must contain a{' '}
          <code>book.json</code> (single Book of Tales) or <code>books.json</code> (collection).
        </p>
      </section>

      {library.length > 0 && (
        <section className="card">
          <h2>Your library</h2>
          <ul className="library">
            {library.map((entry) => (
              <LibraryRow
                key={formatSource(entry.source)}
                entry={entry}
                onOpen={() => handleLoad(entry.source)}
                onRemove={() => handleRemove(entry.source)}
              />
            ))}
          </ul>
        </section>
      )}

      {(registryLoading || registry.length > 0) && (
        <section className="card">
          <h2>Community books</h2>
          {registryLoading ? (
            <p className="hint">Loading…</p>
          ) : (
            <ul className="library">
              {registry.map((regBook) => (
                <RegistryRow
                  key={`${regBook.repo}${regBook.path ? `/${regBook.path}` : ''}`}
                  book={regBook}
                  onOpen={() => handleDiscover(registryBookToSource(regBook))}
                  loading={loading}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className="home-footer">
        <p>
          This app loads only user-supplied Books of Tales. No official{' '}
          <em>Tales of the Arthurian Knights</em> content is included or endorsed. Book
          authors are responsible for the content they publish.
        </p>
        <p className="footer-meta">
          <a
            href="https://github.com/RobMcA/Book-of-Infinite-Tales"
            target="_blank"
            rel="noreferrer"
            className="footer-github"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {' '}GitHub
          </a>
          {' · '}© 2026 Rob McArthur · MIT License
        </p>
      </footer>
    </main>
  );
}

function LibraryRow({
  entry,
  onOpen,
  onRemove,
}: {
  entry: LibraryEntry;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const label = useMemo(() => formatSource(entry.source), [entry.source]);
  return (
    <li className="library-row">
      <button className="library-open" onClick={onOpen}>
        <span className="library-title">
          {entry.title}
          {entry.aiGenerated && <span className="ai-badge">AI Generated</span>}
        </span>
        <span className="library-source">{label}</span>
      </button>
      <button className="library-remove" onClick={onRemove} aria-label={`Remove ${entry.title}`}>
        ×
      </button>
    </li>
  );
}

function RegistryRow({
  book,
  onOpen,
  loading,
}: {
  book: RegistryBook;
  onOpen: () => void;
  loading: boolean;
}) {
  return (
    <li className="library-row">
      <button className="library-open" onClick={onOpen} disabled={loading}>
        <span className="library-title">{book.title}</span>
        <span className="library-source">
          {book.author}
          {book.description ? ` — ${book.description}` : ''}
        </span>
      </button>
    </li>
  );
}
