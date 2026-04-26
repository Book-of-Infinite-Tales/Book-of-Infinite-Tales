import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Book,
  RenownDelta,
  ResolutionOption,
  ResolutionOutcome,
  ResponseOption,
  Reward,
  SkillReward,
  StatusEffect,
} from './types';
import { formatSource, formatTarget } from './loader';

export function Reader({
  book,
  initialEntryId,
  encounterLabel,
  onBackToPicker,
  onClose,
}: {
  book: Book;
  initialEntryId?: string;
  encounterLabel?: string;
  onBackToPicker?: () => void;
  onClose: () => void;
}) {
  const entryIds = useMemo(() => Object.keys(book.entries).sort(naturalCompare), [book]);
  const [currentId, setCurrentId] = useState<string>(
    initialEntryId ?? entryIds[0] ?? '',
  );
  const [jumpInput, setJumpInput] = useState('');
  const articleRef = useRef<HTMLElement>(null);

  const current = book.entries[currentId];

  useEffect(() => {
    articleRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [currentId]);

  function goto(id: string) {
    if (!book.entries[id]) return;
    setCurrentId(id);
  }

  function handleJump(ev: React.FormEvent) {
    ev.preventDefault();
    const target = jumpInput.trim();
    if (book.entries[target]) {
      goto(target);
      setJumpInput('');
    }
  }

  if (!current) {
    return (
      <main className="reader">
        <p className="error">This book has no entries.</p>
        <button onClick={onClose}>Back</button>
      </main>
    );
  }

  return (
    <main className="reader">
      <header className="reader-header">
        {onBackToPicker ? (
          <button className="link-button" onClick={onBackToPicker}>
            ← Encounter picker
          </button>
        ) : (
          <button className="link-button" onClick={onClose}>
            ← Library
          </button>
        )}
        <div className="reader-title">
          <h1>
            {book.manifest.title}
            {book.manifest.aiGenerated && <span className="ai-badge">AI Generated</span>}
          </h1>
          <span className="reader-source">{formatSource(book.source)}</span>
        </div>
      </header>

      <nav className="reader-nav">
        <form onSubmit={handleJump} className="jump-form">
          <label htmlFor="jump">Go to entry</label>
          <input
            id="jump"
            list="entry-list"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder="e.g. 1234"
          />
          <datalist id="entry-list">
            {entryIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <button type="submit">Go</button>
        </form>
      </nav>

      <article className="entry" ref={articleRef}>
        <div className="entry-heading">
          <span className="entry-id">{current.id ?? currentId}</span>
          {encounterLabel && <h2>{encounterLabel}</h2>}
          {current.romantic && (
            <span className="romantic-badge" title="Romantic content">
              ✦ Romantic
            </span>
          )}
        </div>

        {current.retinue && (
          <div className={`retinue-notice retinue-${current.retinue}`}>
            {retinueText(current.retinue)}
          </div>
        )}

        <Prose body={current.body} />

        {current.responses && current.responses.length > 0 && (
          <ResponseList responses={current.responses} onGoto={goto} />
        )}

        {current.resolutions && current.resolutions.length > 0 && (
          <ResolutionList resolutions={current.resolutions} onGoto={goto} />
        )}

        {current.rewards && <RewardBlock reward={current.rewards} />}

        {current.goto && (
          <div className="continue-block">
            <button onClick={() => goto(current.goto!)} className="continue-button">
              Continue → #{current.goto}
            </button>
          </div>
        )}
      </article>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------

function Prose({ body }: { body: string }) {
  return (
    <div className="entry-body">
      {body.split(/\n\n+/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Response list — narrative choices
// ---------------------------------------------------------------------------

function ResponseList({
  responses,
  onGoto,
}: {
  responses: ResponseOption[];
  onGoto: (id: string) => void;
}) {
  return (
    <section className="responses">
      <h3 className="section-heading">Responses</h3>
      <ul>
        {responses.map((r, i) => (
          <li key={i} className={r.romantic ? 'response response--romantic' : 'response'}>
            <button onClick={() => onGoto(r.goto)}>
              {r.romantic && (
                <span className="asterisk" title="Romantic content">
                  *
                </span>
              )}
              <span className="response-label">{r.label}</span>
              <span className="response-goto">→ #{r.goto}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Resolution list — skill checks with inline success/failure
// ---------------------------------------------------------------------------

function ResolutionList({
  resolutions,
  onGoto,
}: {
  resolutions: ResolutionOption[];
  onGoto: (id: string) => void;
}) {
  return (
    <section className="resolutions">
      <h3 className="section-heading">How do you resolve this?</h3>
      <div className="resolution-cards">
        {resolutions.map((r, i) => (
          <ResolutionCard key={i} resolution={r} onGoto={onGoto} />
        ))}
      </div>
    </section>
  );
}

function ResolutionCard({
  resolution,
  onGoto,
}: {
  resolution: ResolutionOption;
  onGoto: (id: string) => void;
}) {
  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState<'success' | 'failure' | null>(null);

  return (
    <div
      className={`resolution-card${resolution.romantic ? ' resolution-card--romantic' : ''}`}
    >
      <div className="resolution-header">
        {resolution.romantic && (
          <span className="asterisk" title="Romantic content">
            *
          </span>
        )}
        <span className="resolution-using">{resolution.using.join(' / ')}</span>
        {resolution.label && (
          <span className="resolution-action"> — {resolution.label}</span>
        )}
      </div>

      {!committed ? (
        <button className="commit-button" onClick={() => setCommitted(true)}>
          Commit & reveal target
        </button>
      ) : (
        <>
          <div className="resolution-target-row">
            <span className="target-label">Target:</span>
            <span className="check-target">{formatTarget(resolution.target)}</span>
          </div>

          <div className="outcomes">
            <OutcomeCard
              kind="success"
              outcome={resolution.success}
              open={revealed === 'success'}
              onReveal={() => setRevealed('success')}
              onGoto={onGoto}
            />
            <OutcomeCard
              kind="failure"
              outcome={resolution.failure}
              open={revealed === 'failure'}
              onReveal={() => setRevealed('failure')}
              onGoto={onGoto}
            />
          </div>
        </>
      )}
    </div>
  );
}

function OutcomeCard({
  kind,
  outcome,
  open,
  onReveal,
  onGoto,
}: {
  kind: 'success' | 'failure';
  outcome: ResolutionOutcome;
  open: boolean;
  onReveal: () => void;
  onGoto: (id: string) => void;
}) {
  return (
    <div className={`outcome outcome--${kind}${open ? ' outcome--open' : ''}`}>
      {!open ? (
        <button className={`reveal-button reveal-${kind}`} onClick={onReveal}>
          {kind === 'success' ? 'Success' : 'Failure'}
        </button>
      ) : (
        <>
          <div className="outcome-header">
            {kind === 'success' ? '✓ Success' : '✗ Failure'}
          </div>
          <Prose body={outcome.body} />
          {outcome.rewards && <RewardBlock reward={outcome.rewards} />}
          {outcome.goto && (
            <button className="continue-button small" onClick={() => onGoto(outcome.goto!)}>
              Continue → #{outcome.goto}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reward block
// ---------------------------------------------------------------------------

function RewardBlock({ reward }: { reward: Reward }) {
  const items = buildRewardLines(reward);
  if (items.length === 0) return null;

  return (
    <div className="reward-block">
      <span className="reward-bracket">[</span>
      <span className="reward-inner">
        {items.map((line, i) => (
          <span key={i} className="reward-item">
            {line}
            {i < items.length - 1 && <span className="reward-sep"> | </span>}
          </span>
        ))}
      </span>
      <span className="reward-bracket">]</span>
    </div>
  );
}

function buildRewardLines(reward: Reward): string[] {
  const lines: string[] = [];

  if (reward.destiny !== undefined) {
    if (reward.destiny === 'location_number') {
      lines.push('Gain Destiny = Location #');
    } else if (reward.destiny < 0) {
      lines.push(`Lose ${Math.abs(reward.destiny)} Destiny`);
    } else {
      lines.push(`Gain ${reward.destiny} Destiny`);
    }
  }

  for (const r of reward.renown ?? []) lines.push(formatRenown(r));
  for (const s of reward.skills ?? []) lines.push(formatSkill(s));

  if (reward.treasures !== undefined) {
    if (typeof reward.treasures === 'string') {
      lines.push(`Gain Treasure: ${reward.treasures}`);
    } else {
      lines.push(`Gain ${reward.treasures} Treasure${reward.treasures !== 1 ? 's' : ''}`);
    }
  }

  for (const s of reward.statuses ?? []) lines.push(formatStatus(s));
  if (reward.storyToken) lines.push(`Gain Story Token: ${reward.storyToken}`);

  if (reward.movement !== undefined) {
    if (reward.movement === 'free') lines.push('Gain bonus movement');
    else lines.push(`Gain ${reward.movement} bonus movement`);
  }

  return lines;
}

function formatRenown(r: RenownDelta): string {
  const abs = Math.abs(r.delta);
  const ranks = `${abs} Rank${abs !== 1 ? 's' : ''}`;
  if (r.type === 'Any') {
    return r.delta >= 0 ? `Gain ${ranks} of Renown (your choice)` : `Lose ${ranks} of Renown (your choice)`;
  }
  return r.delta >= 0 ? `Gain ${ranks} of ${r.type}` : `Lose ${ranks} of ${r.type}`;
}

function formatSkill(s: SkillReward): string {
  const count = s.count ?? 1;
  const plural = count !== 1 ? 's' : '';
  if ('name' in s) return `Gain ${count} ${s.name} Skill${plural}`;
  return `Gain ${count} ${s.category} Skill${plural} of your choice`;
}

function formatStatus(s: StatusEffect): string {
  return s.action === 'gain' ? `Become ${s.name}` : `Lose ${s.name}`;
}

// ---------------------------------------------------------------------------
// Retinue notice
// ---------------------------------------------------------------------------

function retinueText(presence: 'beside' | 'nearby' | 'absent'): string {
  switch (presence) {
    case 'beside':
      return '⚔ Your retinue is right beside you.';
    case 'nearby':
      return '🏕 Your retinue is nearby but not at your side.';
    case 'absent':
      return '🔭 You are scouting ahead — your retinue is elsewhere.';
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function naturalCompare(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}
