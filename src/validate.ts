import type {
  BookManifest,
  BookComponents,
  Entry,
  Formula,
  ResolutionOption,
  ResolutionOutcome,
  ResolutionTarget,
  ResponseOption,
  Reward,
} from './types';
import { SCHEMA_VERSION } from './types';
import { linkTargets } from './links';

const RENOWN_TYPES = ['Divinity', 'Romance', 'Villainy', 'Any'];
const SKILL_CATEGORIES = ['Martial', 'Spiritual', 'Courtly', 'Wilderness'];

/**
 * Every reward block in an entry, with a label for error messages: the
 * entry's own rewards and each resolution's success, partial and failure.
 */
export function rewardSites(entry: Entry): Array<[string, Reward | undefined]> {
  const sites: Array<[string, Reward | undefined]> = [['rewards', entry.rewards]];
  for (const res of entry.resolutions ?? []) {
    sites.push(['resolution success', res.success?.rewards]);
    if (res.partial) sites.push(['resolution partial', res.partial.rewards]);
    sites.push(['resolution failure', res.failure?.rewards]);
  }
  return sites;
}

/** Report every [[link]] in `text` that points to a missing entry. */
function checkLinks(
  where: string,
  text: string | undefined,
  ids: Set<string>,
  errors: string[],
): void {
  for (const id of linkTargets(text ?? '')) {
    if (!ids.has(id)) errors.push(`${where}: link points to unknown entry "${id}".`);
  }
}

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
    } else {
      checkLinks(`Entry "${id}" body`, entry.body, ids, errors);
    }
    for (const r of entry.responses ?? []) {
      validateResponse(id, r, ids, errors);
    }
    for (const r of entry.resolutions ?? []) {
      validateResolution(id, r, ids, errors);
    }
    if (entry.rewards) validateReward(id, entry.rewards, errors);
    for (const [where, reward] of rewardSites(entry)) {
      for (const note of reward?.notes ?? []) {
        checkLinks(`Entry "${id}" ${where} note`, note, ids, errors);
      }
    }
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
  if (r.label && linkTargets(r.label).length > 0) {
    errors.push(
      `Entry "${entryId}": response "${r.label}" contains a [[link]]; a response already leads to its goto.`,
    );
  }
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
  } else if (r.total && !r.using.every((u) => SKILL_CATEGORIES.includes(u))) {
    errors.push(
      `Entry "${entryId}": resolution "${label}" has "total": true, but a total needs skill categories in "using".`,
    );
  }
  if (r.label && linkTargets(r.label).length > 0) {
    errors.push(`Entry "${entryId}": resolution "${label}" label contains a [[link]]; put links in outcome text.`);
  }
  if (r.target === undefined || r.target === null) {
    errors.push(`Entry "${entryId}": resolution "${label}" is missing a target.`);
  } else if (!validTarget(r.target)) {
    errors.push(
      `Entry "${entryId}": resolution "${label}" has an invalid target (must be a number, or { base } with addLocationNumber and/or addAgeNumber set to true).`,
    );
  }
  if (r.partial !== undefined) {
    if (typeof r.partial.min !== 'number' || !Number.isFinite(r.partial.min)) {
      errors.push(`Entry "${entryId}": resolution "${label}" partial outcome needs a numeric "min".`);
    } else if (typeof r.target === 'number' && r.partial.min >= r.target) {
      errors.push(
        `Entry "${entryId}": resolution "${label}" partial "min" (${r.partial.min}) must be below the target (${r.target}).`,
      );
    }
    validateOutcome(entryId, `${label} → partial`, r.partial, ids, errors);
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
  return validFormula(t);
}

/** `{ base }` plus at least one of addLocationNumber / addAgeNumber set to true. */
function validFormula(f: Formula): boolean {
  if (typeof f !== 'object' || f === null || typeof f.base !== 'number') return false;
  const loc = f.addLocationNumber;
  const age = f.addAgeNumber;
  if ((loc !== undefined && loc !== true) || (age !== undefined && age !== true)) return false;
  return loc === true || age === true;
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
  } else {
    checkLinks(`Entry "${entryId}" outcome "${label}"`, o.body, ids, errors);
  }
  if (o.rewards) validateReward(entryId, o.rewards, errors);
  if (o.goto && !ids.has(o.goto)) {
    errors.push(
      `Entry "${entryId}": outcome "${label}" goto points to unknown entry "${o.goto}".`,
    );
  }
}

export function validateReward(entryId: string, reward: Reward, errors: string[]): void {
  const d = reward.destiny;
  if (d !== undefined) {
    const ok =
      d === 'location_number' ||
      (typeof d === 'number' && Number.isFinite(d)) ||
      (typeof d === 'object' && validFormula(d));
    if (!ok) {
      errors.push(
        `Entry "${entryId}": rewards.destiny must be a number, "location_number", or { base } with addLocationNumber and/or addAgeNumber.`,
      );
    }
  }
  if (reward.renown) {
    for (const r of reward.renown) {
      const types = Array.isArray(r.type) ? r.type : [r.type];
      if (types.length === 0) {
        errors.push(`Entry "${entryId}": renown type list is empty.`);
      }
      for (const t of types) {
        if (!RENOWN_TYPES.includes(t)) {
          errors.push(`Entry "${entryId}": unknown renown type "${t}".`);
        }
      }
      if (typeof r.delta !== 'number') {
        errors.push(`Entry "${entryId}": renown delta must be a number.`);
      }
    }
  }
  if (reward.notes !== undefined) {
    if (!Array.isArray(reward.notes) || reward.notes.some((n) => typeof n !== 'string' || !n.trim())) {
      errors.push(`Entry "${entryId}": rewards.notes must be a list of non-empty strings.`);
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
    for (const [where, reward] of rewardSites(entry)) {
      checkSkillReward(id, where, reward, validSkillNames, validCategories, errors);
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
    for (const [where, reward] of rewardSites(entry)) {
      checkStatusReward(id, where, reward, validNames, errors);
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
    for (const [where, reward] of rewardSites(entry)) {
      checkTreasureReward(id, where, reward, validNames, errors);
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
    for (const [where, reward] of rewardSites(entry)) {
      checkTokenReward(id, where, reward, validNumbers, errors);
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
