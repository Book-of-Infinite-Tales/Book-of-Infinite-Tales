import { describe, it, expect } from 'vitest';
import { parseLinks, linkTargets } from './links';
import { formatFormula, formatTarget } from './loader';
import {
  rewardSites,
  validateEntries,
  validateReward,
  validateStatusRefs,
  validateStoryTokenRefs,
} from './validate';
import type { Entry, ResolutionOption, Reward } from './types';

// Tests for passage links, formula targets and destiny, category totals,
// partial outcomes, multi-track renown and reward notes.

function entry(overrides: Partial<Entry> = {}): Entry {
  return { id: '1', body: 'Hello.', ...overrides };
}

function entryMap(...entries: Entry[]): Record<string, Entry> {
  return Object.fromEntries(entries.map((e) => [e.id, e]));
}

function resolution(overrides: Partial<ResolutionOption> = {}): ResolutionOption {
  return {
    using: ['Piety'],
    target: 4,
    success: { body: 'ok' },
    failure: { body: 'fail' },
    ...overrides,
  };
}

function rewardErrors(r: Reward): string[] {
  const errors: string[] = [];
  validateReward('test', r, errors);
  return errors;
}

// ---------------------------------------------------------------------------
// Passage links
// ---------------------------------------------------------------------------

describe('parseLinks', () => {
  it('returns plain text unchanged', () => {
    expect(parseLinks('No links here.')).toEqual(['No links here.']);
  });

  it('splits a bare link out of the text', () => {
    expect(parseLinks('Turn immediately to [[1976]].')).toEqual([
      'Turn immediately to ',
      { id: '1976', text: '1976' },
      '.',
    ]);
  });

  it('uses custom link text after a pipe', () => {
    expect(parseLinks('[[2615|the war council]]')).toEqual([{ id: '2615', text: 'the war council' }]);
  });

  it('handles several links and trims whitespace', () => {
    expect(parseLinks('[[ 1 ]] or [[2| two ]]')).toEqual([
      { id: '1', text: '1' },
      ' or ',
      { id: '2', text: 'two' },
    ]);
  });

  it('leaves single-bracket reward text alone', () => {
    expect(parseLinks('[Gain 1 Destiny]')).toEqual(['[Gain 1 Destiny]']);
  });

  it('lists link targets', () => {
    expect(linkTargets('If so, [[10]]; otherwise [[20|read on]].')).toEqual(['10', '20']);
  });
});

describe('validateEntries: links', () => {
  it('accepts a body link to an existing entry', () => {
    const a = entry({ id: '1', body: 'If you have Story Token #14, turn to [[2]].' });
    const b = entry({ id: '2' });
    expect(() => validateEntries(entryMap(a, b))).not.toThrow();
  });

  it('rejects a body link to a missing entry', () => {
    const a = entry({ body: 'Turn to [[999]].' });
    expect(() => validateEntries(entryMap(a))).toThrow(/link points to unknown entry "999"/);
  });

  it('checks links in outcome bodies', () => {
    const a = entry({
      resolutions: [resolution({ failure: { body: 'You may go after him ([[998]]).' } })],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/unknown entry "998"/);
  });

  it('checks links in partial outcome bodies', () => {
    const a = entry({
      resolutions: [resolution({ partial: { min: 2, body: 'Turn to [[997]].' } })],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/unknown entry "997"/);
  });

  it('checks links in reward notes', () => {
    const a = entry({ rewards: { notes: ['On your next turn, turn to [[996]].'] } });
    expect(() => validateEntries(entryMap(a))).toThrow(/note: link points to unknown entry "996"/);
  });

  it('rejects links in response labels', () => {
    const a = entry({ id: '1', responses: [{ label: 'You may go to [[2]].', goto: '2' }] });
    const b = entry({ id: '2' });
    expect(() => validateEntries(entryMap(a, b))).toThrow(/contains a \[\[link\]\]/);
  });

  it('rejects links in resolution labels', () => {
    const a = entry({ id: '1', resolutions: [resolution({ label: 'see [[2]]' })] });
    const b = entry({ id: '2' });
    expect(() => validateEntries(entryMap(a, b))).toThrow(/label contains a \[\[link\]\]/);
  });
});

// ---------------------------------------------------------------------------
// Formula targets and destiny
// ---------------------------------------------------------------------------

describe('formula targets', () => {
  it('accepts a target that adds the Age #', () => {
    const a = entry({ resolutions: [resolution({ target: { base: 5, addAgeNumber: true } })] });
    expect(() => validateEntries(entryMap(a))).not.toThrow();
  });

  it('accepts a target that adds both Location # and Age #', () => {
    const a = entry({
      resolutions: [resolution({ target: { base: 1, addLocationNumber: true, addAgeNumber: true } })],
    });
    expect(() => validateEntries(entryMap(a))).not.toThrow();
  });

  it('rejects a formula with neither flag', () => {
    const a = entry({
      resolutions: [resolution({ target: { base: 3 } as unknown as ResolutionOption['target'] })],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/invalid target/);
  });

  it('rejects a flag set to false', () => {
    const a = entry({
      resolutions: [
        resolution({
          target: { base: 3, addLocationNumber: false } as unknown as ResolutionOption['target'],
        }),
      ],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/invalid target/);
  });

  it('formats targets and formulas', () => {
    expect(formatTarget(4)).toBe('≥ 4');
    expect(formatTarget({ base: 3, addLocationNumber: true })).toBe('≥ 3 + Location #');
    expect(formatTarget({ base: 5, addAgeNumber: true })).toBe('≥ 5 + Age #');
    expect(formatFormula({ base: 0, addLocationNumber: true })).toBe('Location #');
    expect(formatFormula({ base: 1, addLocationNumber: true, addAgeNumber: true })).toBe(
      '1 + Location # + Age #',
    );
  });
});

describe('formula destiny', () => {
  it('accepts "1 + Location #"', () => {
    expect(rewardErrors({ destiny: { base: 1, addLocationNumber: true } })).toEqual([]);
  });

  it('accepts "= Age #"', () => {
    expect(rewardErrors({ destiny: { base: 0, addAgeNumber: true } })).toEqual([]);
  });

  it('rejects a formula with no flag', () => {
    expect(rewardErrors({ destiny: { base: 2 } } as unknown as Reward)).toHaveLength(1);
  });

  it('still accepts numbers and "location_number"', () => {
    expect(rewardErrors({ destiny: 2 })).toEqual([]);
    expect(rewardErrors({ destiny: 'location_number' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Category totals
// ---------------------------------------------------------------------------

describe('category totals', () => {
  it('accepts a total over a skill category', () => {
    const a = entry({ resolutions: [resolution({ using: ['Martial'], total: true, target: 9 })] });
    expect(() => validateEntries(entryMap(a))).not.toThrow();
  });

  it('rejects a total over a single skill', () => {
    const a = entry({ resolutions: [resolution({ using: ['Piety'], total: true })] });
    expect(() => validateEntries(entryMap(a))).toThrow(/total needs skill categories/);
  });

  it('rejects a total over a renown type', () => {
    const a = entry({ resolutions: [resolution({ using: ['Romance'], total: true })] });
    expect(() => validateEntries(entryMap(a))).toThrow(/total needs skill categories/);
  });
});

// ---------------------------------------------------------------------------
// Partial outcomes
// ---------------------------------------------------------------------------

describe('partial outcomes', () => {
  it('accepts a renown band below the target', () => {
    const a = entry({
      resolutions: [
        resolution({
          using: ['Romance'],
          target: 4,
          partial: { min: 2, body: 'You do well enough.', rewards: { destiny: 1 } },
        }),
      ],
    });
    expect(() => validateEntries(entryMap(a))).not.toThrow();
  });

  it('rejects a min at or above a fixed target', () => {
    const a = entry({ resolutions: [resolution({ target: 4, partial: { min: 4, body: 'x' } })] });
    expect(() => validateEntries(entryMap(a))).toThrow(/must be below the target/);
  });

  it('rejects a missing min', () => {
    const a = entry({
      resolutions: [resolution({ partial: { body: 'x' } as unknown as ResolutionOption['partial'] })],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/needs a numeric "min"/);
  });

  it('rejects a partial outcome without a body', () => {
    const a = entry({
      resolutions: [resolution({ partial: { min: 2 } as unknown as ResolutionOption['partial'] })],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/partial" is missing body text/);
  });

  it('validates partial rewards', () => {
    const a = entry({
      resolutions: [
        resolution({ partial: { min: 2, body: 'x', rewards: { destiny: 'lots' } as unknown as Reward } }),
      ],
    });
    expect(() => validateEntries(entryMap(a))).toThrow(/rewards.destiny/);
  });

  it('checks statuses and story tokens in partial rewards', () => {
    const a = entry({
      resolutions: [
        resolution({
          partial: {
            min: 2,
            body: 'x',
            rewards: { statuses: [{ action: 'gain', name: 'Glorious' }], storyToken: 99 },
          },
        }),
      ],
    });
    expect(() => validateStatusRefs(entryMap(a), new Set(['Scorned']))).toThrow(
      /resolution partial: unknown status "Glorious"/,
    );
    expect(() => validateStoryTokenRefs(entryMap(a), new Set([1, 2]))).toThrow(
      /resolution partial: unknown story token number 99/,
    );
  });

  it('lists partial rewards among the reward sites', () => {
    const e = entry({
      rewards: { destiny: 1 },
      resolutions: [resolution({ partial: { min: 2, body: 'x', rewards: { destiny: 1 } } })],
    });
    expect(rewardSites(e).map(([where]) => where)).toEqual([
      'rewards',
      'resolution success',
      'resolution partial',
      'resolution failure',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Multi-track renown and reward notes
// ---------------------------------------------------------------------------

describe('renown track choice', () => {
  it('accepts a list of tracks', () => {
    expect(rewardErrors({ renown: [{ type: ['Divinity', 'Romance'], delta: 2 }] })).toEqual([]);
  });

  it('rejects an empty list', () => {
    expect(rewardErrors({ renown: [{ type: [], delta: 1 }] })).toHaveLength(1);
  });

  it('rejects an unknown track in the list', () => {
    expect(
      // @ts-expect-error intentional bad type
      rewardErrors({ renown: [{ type: ['Divinity', 'Glory'], delta: 1 }] }),
    ).toHaveLength(1);
  });
});

describe('reward notes', () => {
  it('accepts a list of strings', () => {
    expect(
      rewardErrors({ notes: ['Place a Hunting Skill Marker on your Accompanied Status Card'] }),
    ).toEqual([]);
  });

  it('rejects a non-list', () => {
    expect(rewardErrors({ notes: 'Draw 1 Quest Card' } as unknown as Reward)).toHaveLength(1);
  });

  it('rejects empty strings', () => {
    expect(rewardErrors({ notes: ['  '] })).toHaveLength(1);
  });
});
