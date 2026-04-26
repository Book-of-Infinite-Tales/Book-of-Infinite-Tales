import type {
  BookManifest,
  BookComponents,
  Entry,
  ResolutionOption,
  ResolutionOutcome,
  ResolutionTarget,
  ResponseOption,
  Reward,
} from './types';
import { SCHEMA_VERSION } from './types';

export function validateManifest(m: BookManifest): void {
  if (m.schema !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema: "${m.schema ?? '(missing)'}". Expected "${SCHEMA_VERSION}".`,
    );
  }
  if (!m.title) throw new Error('book.json is missing a title.');
  if (!m.entries) throw new Error('book.json is missing "entries".');
}

export function validateEntries(entries: Record<string, Entry>): void {
  const ids = new Set(Object.keys(entries));
  if (ids.size === 0) throw new Error('Book has no entries.');

  const errors: string[] = [];

  for (const [id, entry] of Object.entries(entries)) {
    if (entry.id && entry.id !== id) {
      errors.push(`Entry "${id}" has mismatched id field "${entry.id}".`);
    }
    if (typeof entry.body !== 'string') {
      errors.push(`Entry "${id}" is missing a body.`);
    }
    for (const r of entry.responses ?? []) {
      validateResponse(id, r, ids, errors);
    }
    for (const r of entry.resolutions ?? []) {
      validateResolution(id, r, ids, errors);
    }
    if (entry.rewards) validateReward(id, entry.rewards, errors);
    if (entry.goto && !ids.has(entry.goto)) {
      errors.push(`Entry "${id}": goto points to unknown entry "${entry.goto}".`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Book validation failed:\n• ${errors.join('\n• ')}`);
  }
}

function validateResponse(
  entryId: string,
  r: ResponseOption,
  ids: Set<string>,
  errors: string[],
): void {
  if (!r.label) errors.push(`Entry "${entryId}": a response is missing a label.`);
  if (!r.goto) {
    errors.push(`Entry "${entryId}": response "${r.label}" is missing goto.`);
  } else if (!ids.has(r.goto)) {
    errors.push(
      `Entry "${entryId}": response "${r.label}" points to unknown entry "${r.goto}".`,
    );
  }
}

function validateResolution(
  entryId: string,
  r: ResolutionOption,
  ids: Set<string>,
  errors: string[],
): void {
  const label = r.label ?? r.using?.join(' / ') ?? '(unnamed)';
  if (!Array.isArray(r.using) || r.using.length === 0) {
    errors.push(`Entry "${entryId}": resolution "${label}" has no "using" options.`);
  }
  if (r.target === undefined || r.target === null) {
    errors.push(`Entry "${entryId}": resolution "${label}" is missing a target.`);
  } else if (!validTarget(r.target)) {
    errors.push(
      `Entry "${entryId}": resolution "${label}" has an invalid target (must be a number or { base, addLocationNumber: true }).`,
    );
  }
  if (!r.success) {
    errors.push(`Entry "${entryId}": resolution "${label}" is missing a success outcome.`);
  } else {
    validateOutcome(entryId, `${label} → success`, r.success, ids, errors);
  }
  if (!r.failure) {
    errors.push(`Entry "${entryId}": resolution "${label}" is missing a failure outcome.`);
  } else {
    validateOutcome(entryId, `${label} → failure`, r.failure, ids, errors);
  }
}

function validTarget(t: ResolutionTarget): boolean {
  if (typeof t === 'number') return Number.isFinite(t);
  return (
    typeof t === 'object' &&
    typeof t.base === 'number' &&
    t.addLocationNumber === true
  );
}

function validateOutcome(
  entryId: string,
  label: string,
  o: ResolutionOutcome,
  ids: Set<string>,
  errors: string[],
): void {
  if (typeof o.body !== 'string') {
    errors.push(`Entry "${entryId}": outcome "${label}" is missing body text.`);
  }
  if (o.rewards) validateReward(entryId, o.rewards, errors);
  if (o.goto && !ids.has(o.goto)) {
    errors.push(
      `Entry "${entryId}": outcome "${label}" goto points to unknown entry "${o.goto}".`,
    );
  }
}

export function validateReward(entryId: string, reward: Reward, errors: string[]): void {
  if (reward.destiny !== undefined) {
    if (reward.destiny !== 'location_number' && typeof reward.destiny !== 'number') {
      errors.push(
        `Entry "${entryId}": rewards.destiny must be a number or "location_number".`,
      );
    }
  }
  if (reward.renown) {
    for (const r of reward.renown) {
      if (!['Divinity', 'Romance', 'Villainy', 'Any'].includes(r.type)) {
        errors.push(`Entry "${entryId}": unknown renown type "${r.type}".`);
      }
      if (typeof r.delta !== 'number') {
        errors.push(`Entry "${entryId}": renown delta must be a number.`);
      }
    }
  }
}

export function validateComponents(s: BookComponents, entryIds: Set<string>): void {
  const errors: string[] = [];

  const checkEntry = (where: string, id: string | undefined) => {
    if (!id) return;
    if (!entryIds.has(id)) {
      errors.push(`${where}: points to unknown entry "${id}".`);
    }
  };

  if (!Array.isArray(s.ages) || s.ages.length === 0) {
    errors.push('components.ages must be a non-empty array.');
  } else {
    for (const a of s.ages) {
      if (!a.id || !a.name) errors.push(`components.ages: age is missing id or name.`);
      checkEntry(`components.ages[${a.id}].startPassage`, a.startPassage);
    }
  }

  // Location and quest passages are optional implementations — a book may
  // cover only a subset of the game's locations and quests. The picker
  // disables buttons for passages not present in the book, mirroring the
  // same pattern used for milieu terrain offsets.

  checkEntry('components.epiloguePassage', s.epiloguePassage);

  if (errors.length > 0) {
    throw new Error(`Book components validation failed:\n• ${errors.join('\n• ')}`);
  }
}

/**
 * When the components file declares skills, validate that every skill name
 * and category used in resolution "using" arrays and skill rewards is known.
 * Renown types (Divinity, Romance, Villainy, Any) are always valid in "using".
 */
export function validateSkillRefs(
  entries: Record<string, Entry>,
  validSkillNames: Set<string>,
  validCategories: Set<string>,
): void {
  const errors: string[] = [];
  const validUsing = new Set([...validSkillNames, ...validCategories, 'Divinity', 'Romance', 'Villainy', 'Any']);

  for (const [id, entry] of Object.entries(entries)) {
    for (const res of entry.resolutions ?? []) {
      for (const u of res.using ?? []) {
        if (!validUsing.has(u)) {
          errors.push(`Entry "${id}": resolution uses unknown skill/category "${u}".`);
        }
      }
    }
    checkSkillReward(id, 'rewards', entry.rewards, validSkillNames, validCategories, errors);
    for (const res of entry.resolutions ?? []) {
      checkSkillReward(id, 'resolution success', res.success?.rewards, validSkillNames, validCategories, errors);
      checkSkillReward(id, 'resolution failure', res.failure?.rewards, validSkillNames, validCategories, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unknown skill references:\n• ${errors.join('\n• ')}`);
  }
}

function checkSkillReward(
  entryId: string,
  location: string,
  reward: Reward | undefined,
  validNames: Set<string>,
  validCategories: Set<string>,
  errors: string[],
): void {
  for (const s of reward?.skills ?? []) {
    if ('name' in s && !validNames.has(s.name)) {
      errors.push(`Entry "${entryId}" ${location}: unknown skill name "${s.name}".`);
    }
    if ('category' in s && !validCategories.has(s.category)) {
      errors.push(`Entry "${entryId}" ${location}: unknown skill category "${s.category}".`);
    }
  }
}

/**
 * When the components file declares a fixed set of status cards, validate
 * that every status name used in rewards across all entries is in that set.
 */
export function validateStatusRefs(
  entries: Record<string, Entry>,
  validNames: Set<string>,
): void {
  const errors: string[] = [];

  for (const [id, entry] of Object.entries(entries)) {
    checkStatusReward(id, 'rewards', entry.rewards, validNames, errors);
    for (const res of entry.resolutions ?? []) {
      checkStatusReward(id, 'resolution success', res.success?.rewards, validNames, errors);
      checkStatusReward(id, 'resolution failure', res.failure?.rewards, validNames, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unknown status names:\n• ${errors.join('\n• ')}`);
  }
}

/**
 * When the components file declares treasures, validate that every named
 * treasure string in rewards refers to a declared treasure name.
 */
export function validateTreasureRefs(
  entries: Record<string, Entry>,
  validNames: Set<string>,
): void {
  const errors: string[] = [];

  for (const [id, entry] of Object.entries(entries)) {
    checkTreasureReward(id, 'rewards', entry.rewards, validNames, errors);
    for (const res of entry.resolutions ?? []) {
      checkTreasureReward(id, 'resolution success', res.success?.rewards, validNames, errors);
      checkTreasureReward(id, 'resolution failure', res.failure?.rewards, validNames, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unknown treasure names:\n• ${errors.join('\n• ')}`);
  }
}

function checkTreasureReward(
  entryId: string,
  location: string,
  reward: Reward | undefined,
  validNames: Set<string>,
  errors: string[],
): void {
  if (typeof reward?.treasures === 'string' && !validNames.has(reward.treasures)) {
    errors.push(`Entry "${entryId}" ${location}: unknown treasure "${reward.treasures}".`);
  }
}

/**
 * When the components file declares story tokens, validate that every token
 * number used in rewards is in the declared set.
 */
export function validateStoryTokenRefs(
  entries: Record<string, Entry>,
  validNumbers: Set<number>,
): void {
  const errors: string[] = [];

  for (const [id, entry] of Object.entries(entries)) {
    checkTokenReward(id, 'rewards', entry.rewards, validNumbers, errors);
    for (const res of entry.resolutions ?? []) {
      checkTokenReward(id, 'resolution success', res.success?.rewards, validNumbers, errors);
      checkTokenReward(id, 'resolution failure', res.failure?.rewards, validNumbers, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unknown story token numbers:\n• ${errors.join('\n• ')}`);
  }
}

function checkTokenReward(
  entryId: string,
  location: string,
  reward: Reward | undefined,
  validNumbers: Set<number>,
  errors: string[],
): void {
  if (reward?.storyToken === undefined) return;
  if (!validNumbers.has(reward.storyToken)) {
    errors.push(`Entry "${entryId}" ${location}: unknown story token number ${reward.storyToken}.`);
  }
}

function checkStatusReward(
  entryId: string,
  location: string,
  reward: Reward | undefined,
  validNames: Set<string>,
  errors: string[],
): void {
  for (const s of reward?.statuses ?? []) {
    if (!validNames.has(s.name)) {
      errors.push(`Entry "${entryId}" ${location}: unknown status "${s.name}".`);
    }
  }
}
