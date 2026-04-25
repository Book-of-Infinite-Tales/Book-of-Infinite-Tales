import { useState } from 'react';
import type { Book, BookComponents } from './types';
import { formatSource } from './loader';

type EncounterType = 'character' | 'location' | 'milieu' | 'quest';

export function EncounterPicker({
  book,
  onSelect,
  onClose,
}: {
  book: Book;
  onSelect: (entryId: string, encounterLabel?: string) => void;
  onClose: () => void;
}) {
  const structure = book.components;
  const [selectedAge, setSelectedAge] = useState<string | null>(
    structure?.ages[0]?.id ?? null,
  );
  const [encounterType, setEncounterType] = useState<EncounterType | null>(null);
  const [manualId, setManualId] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  function handleManual(ev: React.FormEvent) {
    ev.preventDefault();
    const id = manualId.trim();
    if (book.entries[id]) {
      onSelect(id);
    } else {
      setManualError(`No entry ${id} in this book.`);
    }
  }

  if (!structure) {
    return (
      <main className="picker">
        <PickerHeader book={book} onClose={onClose} />
        <section className="card">
          <h2>Jump to passage</h2>
          <form onSubmit={handleManual} className="loader-form">
            <input
              type="text"
              value={manualId}
              onChange={(e) => {
                setManualId(e.target.value);
                setManualError(null);
              }}
              placeholder="Passage number (e.g. 1234)"
              autoFocus
            />
            <button type="submit">Open</button>
          </form>
          {manualError && <p className="error">{manualError}</p>}
          <p className="hint">
            This book does not declare a game structure — you can look up any passage by id.
          </p>
        </section>
      </main>
    );
  }

  const currentAge = structure.ages.find((a) => a.id === selectedAge) ?? null;

  return (
    <main className="picker">
      <PickerHeader book={book} onClose={onClose} />

      {currentAge && (
        <section className="card picker-step">
          <h2>Encounter</h2>
          <div className="button-row">
            <TypeButton
              active={encounterType === 'character'}
              disabled={!structure.characters?.length}
              onClick={() => setEncounterType('character')}
              label="Character"
            />
            <TypeButton
              active={encounterType === 'location'}
              disabled={!structure.locations?.length}
              onClick={() => setEncounterType('location')}
              label="Location"
            />
            <TypeButton
              active={encounterType === 'milieu'}
              disabled={!structure.milieus?.length}
              onClick={() => setEncounterType('milieu')}
              label="Milieu"
            />
            <TypeButton
              active={encounterType === 'quest'}
              disabled={!structure.quests?.length}
              onClick={() => setEncounterType('quest')}
              label="Quest"
            />
          </div>
        </section>
      )}

      {currentAge && encounterType === 'character' && (
        <CharacterFlow
          structure={structure}
          entryIds={new Set(Object.keys(book.entries))}
          onSelect={onSelect}
        />
      )}

      {currentAge && encounterType === 'location' && (
        <LocationFlow
          age={selectedAge!}
          structure={structure}
          entryIds={new Set(Object.keys(book.entries))}
          onSelect={onSelect}
        />
      )}

      {currentAge && encounterType === 'milieu' && (
        <MilieuFlow
          age={selectedAge!}
          structure={structure}
          entryIds={new Set(Object.keys(book.entries))}
          onSelect={onSelect}
        />
      )}

      {currentAge && encounterType === 'quest' && (
        <QuestFlow
          structure={structure}
          entryIds={new Set(Object.keys(book.entries))}
          onSelect={onSelect}
        />
      )}

      <section className="card picker-step">
        <h2>Jump to any passage</h2>
        <form onSubmit={handleManual} className="loader-form">
          <input
            type="text"
            value={manualId}
            onChange={(e) => {
              setManualId(e.target.value);
              setManualError(null);
            }}
            placeholder="Passage number (e.g. 1234)"
          />
          <button type="submit">Open</button>
        </form>
        {manualError && <p className="error">{manualError}</p>}
      </section>

      <section className="card picker-step">
        <h2>Current age</h2>
        <div className="button-row">
          {structure.ages.map((age) => (
            <button
              key={age.id}
              className={age.id === selectedAge ? 'pill pill--active' : 'pill'}
              onClick={() => setSelectedAge(age.id)}
            >
              {age.name}
            </button>
          ))}
          {structure.epiloguePassage && (
            <button
              className="pill pill--epilogue"
              onClick={() => onSelect(structure.epiloguePassage!, 'Epilogue')}
            >
              Epilogue
            </button>
          )}
        </div>
        {currentAge?.startPassage && (
          <div className="picker-subaction">
            <button
              className="link-button"
              onClick={() => onSelect(currentAge.startPassage!, `Start of ${currentAge.name}`)}
            >
              Start the {currentAge.name} →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function PickerHeader({ book, onClose }: { book: Book; onClose: () => void }) {
  return (
    <header className="picker-header">
      <button className="link-button" onClick={onClose}>
        ← Library
      </button>
      <div className="picker-title">
        <h1>{book.manifest.title}</h1>
        <span className="picker-source">{formatSource(book.source)}</span>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Encounter-type button
// ---------------------------------------------------------------------------

function TypeButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className={active ? 'pill pill--active' : 'pill'}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `No ${label.toLowerCase()}s in this book` : undefined}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Character flow: pick character first, then feature → character.base + feature.offset
// ---------------------------------------------------------------------------

function CharacterFlow({
  structure,
  entryIds,
  onSelect,
}: {
  structure: BookComponents;
  entryIds: Set<string>;
  onSelect: (id: string, label: string) => void;
}) {
  const [characterId, setCharacterId] = useState<string | null>(null);

  const features = structure.features ?? [];
  const characters = structure.characters ?? [];

  const chosenChar = characters.find((c) => c.id === characterId) ?? null;

  return (
    <>
      <section className="card picker-step">
        <h2>Character</h2>
        <div className="button-grid">
          {characters.map((c) => (
            <button
              key={c.id}
              className={c.id === characterId ? 'pill pill--active' : 'pill'}
              onClick={() => setCharacterId(c.id)}
            >
              {c.name}
              <span className="pill-detail">{Math.floor(c.base / 100)}</span>
            </button>
          ))}
        </div>
      </section>

      {chosenChar && (
        <section className="card picker-step">
          <h2>Feature</h2>
          {features.length === 0 ? (
            <p className="hint">This book has no features declared.</p>
          ) : (
            <div className="button-grid">
              {features.map((f) => {
                const passage = String(chosenChar.base + f.offset);
                const exists = entryIds.has(passage);
                return (
                  <button
                    key={f.id}
                    className="pill"
                    disabled={!exists}
                    onClick={() => onSelect(passage, `${f.name} ${chosenChar.name}`)}
                    title={
                      exists
                        ? `${f.name} ${chosenChar.name} → ${passage}`
                        : `No entry ${passage} in this book`
                    }
                  >
                    {f.name}
                    <span className="pill-detail">{String(f.offset).padStart(2, '0')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Location flow: pick location → regular passage or visit-place-of-power
// ---------------------------------------------------------------------------

function LocationFlow({
  age,
  structure,
  entryIds,
  onSelect,
}: {
  age: string;
  structure: BookComponents;
  entryIds: Set<string>;
  onSelect: (id: string, label: string) => void;
}) {
  const [locationId, setLocationId] = useState<string | null>(null);
  const locations = structure.locations ?? [];
  const chosen = locations.find((l) => l.id === locationId) ?? null;
  const visitId = chosen?.visitPassages?.[age];
  const passageExists = chosen ? entryIds.has(chosen.passage) : false;
  const visitExists = visitId ? entryIds.has(visitId) : false;

  return (
    <>
      <section className="card picker-step">
        <h2>Location</h2>
        <div className="button-grid">
          {locations.map((l) => (
            <button
              key={l.id}
              className={l.id === locationId ? 'pill pill--active' : 'pill'}
              onClick={() => setLocationId(l.id)}
            >
              {l.name}
              <span className="pill-detail">{l.passage}</span>
            </button>
          ))}
        </div>
      </section>

      {chosen && (
        <section className="card picker-step">
          <h2>Read which passage?</h2>
          <div className="button-row">
            <button
              className="pill"
              disabled={!passageExists}
              onClick={() => passageExists && onSelect(chosen.passage, chosen.name)}
              title={passageExists ? undefined : `Passage ${chosen.passage} not in this book`}
            >
              Location passage
              <span className="pill-detail">{chosen.passage}</span>
            </button>
            <button
              className="pill"
              disabled={!visitExists}
              onClick={() => visitExists && visitId && onSelect(visitId, `Place of Power — ${chosen.name}`)}
              title={
                !visitId
                  ? 'No visit passage declared for this age'
                  : !visitExists
                    ? `Passage ${visitId} not in this book`
                    : `Visit the Place of Power (${visitId})`
              }
            >
              Visit the Place of Power
              {visitId && <span className="pill-detail">{visitId}</span>}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Milieu flow: pick milieu card → pick terrain → compute age.milieuBase + offset
// ---------------------------------------------------------------------------

function MilieuFlow({
  age: ageId,
  structure,
  entryIds,
  onSelect,
}: {
  age: string;
  structure: BookComponents;
  entryIds: Set<string>;
  onSelect: (id: string, label: string) => void;
}) {
  const [milieuId, setMilieuId] = useState<string | null>(null);
  const milieus = structure.milieus ?? [];
  const terrains = structure.terrains ?? [];
  const chosen = milieus.find((m) => m.id === milieuId) ?? null;
  const currentAge = structure.ages.find((a) => a.id === ageId) ?? null;

  if (!currentAge?.milieuBase) {
    return (
      <section className="card picker-step">
        <p className="hint">
          This age has no <code>milieuBase</code> declared — add it to the
          age in your components file to enable milieu encounters.
        </p>
      </section>
    );
  }

  const base = currentAge.milieuBase;

  return (
    <>
      <section className="card picker-step">
        <h2>Milieu</h2>
        <div className="button-grid">
          {milieus.map((m) => (
            <button
              key={m.id}
              className={m.id === milieuId ? 'pill pill--active' : 'pill'}
              onClick={() => setMilieuId(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </section>

      {chosen && (
        <section className="card picker-step">
          <h2>Current terrain</h2>
          <div className="button-grid">
            {terrains.map((t) => {
              const offset = chosen.terrainOffsets?.[t.id];
              const hasOffset = offset !== undefined;
              const passage = hasOffset ? String(base + offset) : null;
              const exists = passage !== null && entryIds.has(passage);
              return (
                <button
                  key={t.id}
                  className="pill"
                  disabled={!exists}
                  onClick={() => exists && passage && onSelect(passage, chosen.name)}
                  title={
                    !hasOffset
                      ? `No offset declared for ${t.name}`
                      : !exists && passage
                        ? `Passage ${passage} not in this book`
                        : `${chosen.name} × ${t.name} → ${passage}`
                  }
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Quest flow: pick quest → goto passage
// ---------------------------------------------------------------------------

function QuestFlow({
  structure,
  entryIds,
  onSelect,
}: {
  structure: BookComponents;
  entryIds: Set<string>;
  onSelect: (id: string, label: string) => void;
}) {
  const quests = structure.quests ?? [];

  return (
    <section className="card picker-step">
      <h2>Quest</h2>
      <div className="button-grid">
        {quests.map((q) => {
          const exists = entryIds.has(q.passage);
          return (
            <button
              key={q.id}
              className="pill"
              disabled={!exists}
              onClick={() => exists && onSelect(q.passage, q.name)}
              title={exists ? `${q.name} → ${q.passage}` : `Passage ${q.passage} not in this book`}
            >
              {q.name}
              <span className="pill-detail">{q.passage}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
