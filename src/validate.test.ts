import { describe, it, expect } from 'vitest';
import { validateManifest, validateEntries, validateReward, validateComponents, validateSkillRefs, validateStatusRefs } from './validate';
import { parseGithubInput } from './loader';
import type { BookComponents, BookManifest, Entry, ResolutionOption, Reward } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function manifest(overrides: Partial<BookManifest> = {}): BookManifest {
  return {
    schema: 'book-of-infinite-tales/v1',
    title: 'Test Book',
    entries: [],
    ...overrides,
  };
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return { id: '1', body: 'Hello.', ...overrides };
}

function entryMap(...entries: Entry[]): Record<string, Entry> {
  return Object.fromEntries(entries.map((e) => [e.id, e]));
}

function components(overrides: Partial<BookComponents> = {}): BookComponents {
  return {
    ages: [{ id: '1', name: 'Golden Age', startPassage: '1000' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    expect(() => validateManifest(manifest())).not.toThrow();
  });

  it('accepts a manifest with a string entries reference', () => {
    expect(() => validateManifest(manifest({ entries: 'entries.json' }))).not.toThrow();
  });

  it('accepts a manifest with a components filename', () => {
    expect(() => validateManifest(manifest({ components: 'components.json' }))).not.toThrow();
  });

  it('throws when schema is wrong', () => {
    expect(() =>
      validateManifest({ schema: 'wrong/v99', title: 'Test', entries: [] } as unknown as BookManifest),
    ).toThrow(/Unsupported schema/);
  });

  it('throws when schema is missing', () => {
    expect(() =>
      validateManifest({ title: 'Test', entries: [] } as unknown as BookManifest),
    ).toThrow(/Unsupported schema/);
  });

  it('throws when title is missing', () => {
    expect(() => validateManifest(manifest({ title: '' }))).toThrow(/missing a title/);
  });

  it('throws when entries is missing', () => {
    expect(() =>
      validateManifest({ schema: 'book-of-infinite-tales/v1', title: 'Test' } as unknown as BookManifest),
    ).toThrow(/missing "entries"/);
  });
});

// ---------------------------------------------------------------------------
// validateEntries
// ---------------------------------------------------------------------------

describe('validateEntries', () => {
  it('accepts a valid single entry', () => {
    expect(() => validateEntries(entryMap(entry()))).not.toThrow();
  });

  it('throws when entries map is empty', () => {
    expect(() => validateEntries({})).toThrow(/no entries/i);
  });

  it('throws when entry body is missing', () => {
    const e = { id: '1' } as unknown as Entry;
    expect(() => validateEntries(entryMap(e))).toThrow(/missing a body/);
  });

  it('throws when entry id field mismatches map key', () => {
    const e = entry({ id: 'wrong' });
    const map = { '1': e };
    expect(() => validateEntries(map)).toThrow(/mismatched id/);
  });

  it('throws when a response goto points to unknown entry', () => {
    const e = entry({ responses: [{ label: 'Go', goto: '999' }] });
    expect(() => validateEntries(entryMap(e))).toThrow(/unknown entry "999"/);
  });

  it('accepts a response goto that resolves within the same book', () => {
    const a = entry({ id: '1', responses: [{ label: 'Go', goto: '2' }] });
    const b = entry({ id: '2' });
    expect(() => validateEntries(entryMap(a, b))).not.toThrow();
  });

  it('throws when a resolution is missing "using"', () => {
    const e = entry({
      resolutions: [
        { target: 3, success: { body: 'ok' }, failure: { body: 'fail' } } as unknown as ResolutionOption,
      ],
    });
    expect(() => validateEntries(entryMap(e))).toThrow(/no "using" options/);
  });

  it('throws when a resolution target is invalid', () => {
    const e = entry({
      resolutions: [
        { using: ['Piety'], target: 'bad', success: { body: 'ok' }, failure: { body: 'fail' } } as unknown as ResolutionOption,
      ],
    });
    expect(() => validateEntries(entryMap(e))).toThrow(/invalid target/);
  });

  it('accepts a variable resolution target', () => {
    const e = entry({
      resolutions: [
        {
          using: ['Piety'],
          target: { base: 3, addLocationNumber: true },
          success: { body: 'ok' },
          failure: { body: 'fail' },
        },
      ],
    });
    expect(() => validateEntries(entryMap(e))).not.toThrow();
  });

  it('throws when resolution success is missing', () => {
    const e = entry({
      resolutions: [
        { using: ['Piety'], target: 3, failure: { body: 'fail' } } as unknown as ResolutionOption,
      ],
    });
    expect(() => validateEntries(entryMap(e))).toThrow(/missing a success/);
  });

  it('throws when resolution failure is missing', () => {
    const e = entry({
      resolutions: [
        { using: ['Piety'], target: 3, success: { body: 'ok' } } as unknown as ResolutionOption,
      ],
    });
    expect(() => validateEntries(entryMap(e))).toThrow(/missing a failure/);
  });

  it('throws when outcome goto points to unknown entry', () => {
    const e = entry({
      resolutions: [
        {
          using: ['Piety'],
          target: 3,
          success: { body: 'ok', goto: '999' },
          failure: { body: 'fail' },
        },
      ],
    });
    expect(() => validateEntries(entryMap(e))).toThrow(/unknown entry "999"/);
  });

  it('throws when entry goto points to unknown entry', () => {
    const e = entry({ goto: '999' });
    expect(() => validateEntries(entryMap(e))).toThrow(/unknown entry "999"/);
  });

  it('accepts entry goto that resolves', () => {
    const a = entry({ id: '1', goto: '2' });
    const b = entry({ id: '2' });
    expect(() => validateEntries(entryMap(a, b))).not.toThrow();
  });

  it('collects multiple errors before throwing', () => {
    const a = entry({ id: '1', goto: '99', responses: [{ label: 'Go', goto: '98' }] });
    try {
      validateEntries(entryMap(a));
      expect.fail('should have thrown');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('"99"');
      expect(msg).toContain('"98"');
    }
  });
});

// ---------------------------------------------------------------------------
// validateReward
// ---------------------------------------------------------------------------

describe('validateReward', () => {
  function reward(r: Reward) {
    const errors: string[] = [];
    validateReward('test', r, errors);
    return errors;
  }

  it('accepts an empty reward', () => {
    expect(reward({})).toEqual([]);
  });

  it('accepts numeric destiny', () => {
    expect(reward({ destiny: 3 })).toEqual([]);
  });

  it('accepts "location_number" destiny', () => {
    expect(reward({ destiny: 'location_number' })).toEqual([]);
  });

  it('rejects invalid destiny', () => {
    expect(reward({ destiny: 'wrong' } as unknown as Reward)).toHaveLength(1);
  });

  it('accepts valid renown types', () => {
    for (const type of ['Divinity', 'Romance', 'Villainy', 'Any'] as const) {
      expect(reward({ renown: [{ type, delta: 1 }] })).toEqual([]);
    }
  });

  it('rejects unknown renown type', () => {
    // @ts-expect-error intentional bad type
    expect(reward({ renown: [{ type: 'Glory', delta: 1 }] })).toHaveLength(1);
  });

  it('rejects non-numeric renown delta', () => {
    // @ts-expect-error intentional bad delta
    expect(reward({ renown: [{ type: 'Divinity', delta: 'lots' }] })).toHaveLength(1);
  });

  it('accepts negative renown delta', () => {
    expect(reward({ renown: [{ type: 'Villainy', delta: -2 }] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateComponents
// ---------------------------------------------------------------------------

describe('validateComponents', () => {
  const ids = new Set(['1000', '1500', '2500', '9999']);

  it('accepts valid components', () => {
    expect(() =>
      validateComponents(
        components({
          ages: [{ id: '1', name: 'Golden Age', startPassage: '1000' }],
        }),
        ids,
      ),
    ).not.toThrow();
  });

  it('throws when ages array is empty', () => {
    expect(() => validateComponents(components({ ages: [] }), ids)).toThrow(
      /ages must be a non-empty array/,
    );
  });

  it('throws when ages is missing', () => {
    expect(() =>
      validateComponents({ ages: undefined } as unknown as BookComponents, ids),
    ).toThrow(/ages must be a non-empty array/);
  });

  it('throws when age is missing id', () => {
    expect(() =>
      validateComponents(components({ ages: [{ name: 'Age 1' } as unknown as BookComponents['ages'][0]] }), ids),
    ).toThrow(/age is missing id or name/);
  });

  it('throws when age startPassage references unknown entry', () => {
    expect(() =>
      validateComponents(
        components({ ages: [{ id: '1', name: 'Age 1', startPassage: '9999999' }] }),
        ids,
      ),
    ).toThrow(/unknown entry "9999999"/);
  });

  it('accepts age without startPassage', () => {
    expect(() =>
      validateComponents(components({ ages: [{ id: '1', name: 'Age 1' }] }), ids),
    ).not.toThrow();
  });

  it('accepts locations with passages not yet in the book', () => {
    expect(() =>
      validateComponents(
        components({
          ages: [{ id: '1', name: 'Age 1', startPassage: '1000' }],
          locations: [{ id: 'loc1', name: 'Loc', passage: '9999999', visitPassages: { '1': '8888888' } }],
        }),
        ids,
      ),
    ).not.toThrow();
  });

  it('accepts quests with passages not yet in the book', () => {
    expect(() =>
      validateComponents(
        components({
          ages: [{ id: '1', name: 'Age 1' }],
          quests: [{ id: 'q1', name: 'Quest', passage: '9999999' }],
        }),
        ids,
      ),
    ).not.toThrow();
  });

  it('throws when epiloguePassage references unknown entry', () => {
    expect(() =>
      validateComponents(
        components({
          ages: [{ id: '1', name: 'Age 1' }],
          epiloguePassage: '9999999',
        }),
        ids,
      ),
    ).toThrow(/unknown entry "9999999"/);
  });

  it('accepts valid epiloguePassage', () => {
    expect(() =>
      validateComponents(
        components({
          ages: [{ id: '1', name: 'Age 1' }],
          epiloguePassage: '9999',
        }),
        ids,
      ),
    ).not.toThrow();
  });

  it('error messages use "components." prefix', () => {
    try {
      validateComponents(components({ ages: [] }), ids);
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('components.');
    }
  });
});

// ---------------------------------------------------------------------------
// validateSkillRefs
// ---------------------------------------------------------------------------

describe('validateSkillRefs', () => {
  const names = new Set(['Piety', 'Wisdom', 'Warfare', 'Hunting', 'Diplomacy']);
  const cats  = new Set(['Martial', 'Spiritual', 'Courtly', 'Wilderness']);

  it('passes when no skills are referenced', () => {
    expect(() => validateSkillRefs(entryMap(entry()), names, cats)).not.toThrow();
  });

  it('passes for a known skill name in using', () => {
    const e = entry({
      resolutions: [{ using: ['Piety'], target: 3, success: { body: 'ok' }, failure: { body: 'fail' } }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).not.toThrow();
  });

  it('passes for a skill category in using', () => {
    const e = entry({
      resolutions: [{ using: ['Spiritual'], target: 3, success: { body: 'ok' }, failure: { body: 'fail' } }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).not.toThrow();
  });

  it('passes for a renown type in using', () => {
    const e = entry({
      resolutions: [{ using: ['Divinity'], target: 3, success: { body: 'ok' }, failure: { body: 'fail' } }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).not.toThrow();
  });

  it('passes for "Any" renown in using', () => {
    const e = entry({
      resolutions: [{ using: ['Any'], target: 3, success: { body: 'ok' }, failure: { body: 'fail' } }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).not.toThrow();
  });

  it('throws for an unknown skill name in using', () => {
    const e = entry({
      resolutions: [{ using: ['Jousting' as import('./types').CheckOption], target: 3, success: { body: 'ok' }, failure: { body: 'fail' } }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).toThrow(/unknown skill\/category "Jousting"/);
  });

  it('throws for a misspelled skill in using', () => {
    const e = entry({
      resolutions: [{ using: ['piety' as import('./types').CheckOption], target: 3, success: { body: 'ok' }, failure: { body: 'fail' } }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).toThrow(/unknown skill\/category "piety"/);
  });

  it('passes for a known skill name in a skill reward', () => {
    const e = entry({ rewards: { skills: [{ name: 'Piety' }] } });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).not.toThrow();
  });

  it('throws for an unknown skill name in a skill reward', () => {
    const e = entry({ rewards: { skills: [{ name: 'Jousting' } as unknown as import('./types').SkillReward] } });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).toThrow(/unknown skill name "Jousting"/);
  });

  it('passes for a known category in a skill reward', () => {
    const e = entry({ rewards: { skills: [{ category: 'Martial', count: 1 }] } });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).not.toThrow();
  });

  it('throws for an unknown category in a skill reward', () => {
    const e = entry({ rewards: { skills: [{ category: 'Arcane' } as unknown as import('./types').SkillReward] } });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).toThrow(/unknown skill category "Arcane"/);
  });

  it('validates skill rewards in resolution outcomes', () => {
    const e = entry({
      resolutions: [{
        using: ['Piety'],
        target: 3,
        success: { body: 'ok', rewards: { skills: [{ name: 'Jousting' } as unknown as import('./types').SkillReward] } },
        failure: { body: 'fail' },
      }],
    });
    expect(() => validateSkillRefs(entryMap(e), names, cats)).toThrow(/unknown skill name "Jousting"/);
  });
});

// ---------------------------------------------------------------------------
// validateStatusRefs
// ---------------------------------------------------------------------------

describe('validateStatusRefs', () => {
  const valid = new Set(['Obsessed', 'Unhorsed', 'Blessed', 'Lost']);

  it('passes when no statuses are used', () => {
    expect(() =>
      validateStatusRefs(entryMap(entry({ rewards: { destiny: 1 } })), valid),
    ).not.toThrow();
  });

  it('passes when all used status names are known', () => {
    const e = entry({
      rewards: { statuses: [{ action: 'gain', name: 'Obsessed' }] },
    });
    expect(() => validateStatusRefs(entryMap(e), valid)).not.toThrow();
  });

  it('throws when an entry reward uses an unknown status', () => {
    const e = entry({
      rewards: { statuses: [{ action: 'gain', name: 'Glorious' }] },
    });
    expect(() => validateStatusRefs(entryMap(e), valid)).toThrow(/unknown status "Glorious"/);
  });

  it('throws when a resolution success reward uses an unknown status', () => {
    const e = entry({
      resolutions: [{
        using: ['Piety'],
        target: 3,
        success: { body: 'ok', rewards: { statuses: [{ action: 'gain', name: 'Invincible' }] } },
        failure: { body: 'fail' },
      }],
    });
    expect(() => validateStatusRefs(entryMap(e), valid)).toThrow(/unknown status "Invincible"/);
  });

  it('throws when a resolution failure reward uses an unknown status', () => {
    const e = entry({
      resolutions: [{
        using: ['Piety'],
        target: 3,
        success: { body: 'ok' },
        failure: { body: 'fail', rewards: { statuses: [{ action: 'lose', name: 'Legendary' }] } },
      }],
    });
    expect(() => validateStatusRefs(entryMap(e), valid)).toThrow(/unknown status "Legendary"/);
  });

  it('passes for a lose action on a known status', () => {
    const e = entry({
      rewards: { statuses: [{ action: 'lose', name: 'Lost' }] },
    });
    expect(() => validateStatusRefs(entryMap(e), valid)).not.toThrow();
  });

  it('collects errors across multiple entries', () => {
    const a = entry({ id: '1', rewards: { statuses: [{ action: 'gain', name: 'Glorious' }] } });
    const b = entry({ id: '2', rewards: { statuses: [{ action: 'gain', name: 'Invincible' }] } });
    try {
      validateStatusRefs(entryMap(a, b), valid);
      expect.fail('should have thrown');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('"Glorious"');
      expect(msg).toContain('"Invincible"');
    }
  });
});

// ---------------------------------------------------------------------------
// parseGithubInput
// ---------------------------------------------------------------------------

describe('parseGithubInput', () => {
  it('parses owner/repo shorthand', () => {
    expect(parseGithubInput('alice/my-book')).toEqual({
      kind: 'github', owner: 'alice', repo: 'my-book', ref: undefined, path: undefined,
    });
  });

  it('parses owner/repo@ref', () => {
    expect(parseGithubInput('alice/my-book@main')).toEqual({
      kind: 'github', owner: 'alice', repo: 'my-book', ref: 'main', path: undefined,
    });
  });

  it('parses owner/repo@ref/path', () => {
    expect(parseGithubInput('alice/my-book@main/chapter-one')).toEqual({
      kind: 'github', owner: 'alice', repo: 'my-book', ref: 'main', path: 'chapter-one',
    });
  });

  it('parses a full github.com URL', () => {
    expect(parseGithubInput('https://github.com/alice/my-book')).toEqual({
      kind: 'github', owner: 'alice', repo: 'my-book', ref: undefined, path: undefined,
    });
  });

  it('parses a github.com URL with tree/ref', () => {
    expect(parseGithubInput('https://github.com/alice/my-book/tree/main')).toEqual({
      kind: 'github', owner: 'alice', repo: 'my-book', ref: 'main', path: undefined,
    });
  });

  it('parses a github.com URL with tree/ref/path', () => {
    expect(parseGithubInput('https://github.com/alice/my-book/tree/main/chapter-one')).toEqual({
      kind: 'github', owner: 'alice', repo: 'my-book', ref: 'main', path: 'chapter-one',
    });
  });

  it('strips .git suffix', () => {
    expect(parseGithubInput('alice/my-book.git')).toMatchObject({ repo: 'my-book' });
  });

  it('trims whitespace', () => {
    expect(parseGithubInput('  alice/my-book  ')).toMatchObject({ owner: 'alice', repo: 'my-book' });
  });

  it('returns null for empty input', () => {
    expect(parseGithubInput('')).toBeNull();
  });

  it('returns null for plain text with no slash', () => {
    expect(parseGithubInput('notarepo')).toBeNull();
  });
});
