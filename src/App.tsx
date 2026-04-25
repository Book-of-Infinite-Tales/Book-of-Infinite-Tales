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
          saveToLibrary({ source, title: result.book.manifest.title, addedAt: Date.now() }),
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
        saveToLibrary({ source, title: loaded.manifest.title, addedAt: Date.now() }),
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
                    <span className="library-title">{entry.title}</span>
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
          A community reader for custom encounter books inspired by <em>Tales of the Arthurian Knights</em>.
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
          <code>book.json</code> manifest (or <code>books.json</code> for a collection). See
          the README for the format.
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
          This app loads only user-supplied books. No official{' '}
          <em>Tales of the Arthurian Knights</em> content is included or endorsed. Book
          authors are responsible for the content they publish.
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
        <span className="library-title">{entry.title}</span>
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
