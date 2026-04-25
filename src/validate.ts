import type {
  BookManifest,
  BookStructure,
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

export function validateStructure(s: BookStructure, entryIds: Set<string>): void {
  const errors: string[] = [];

  const checkEntry = (where: string, id: string | undefined) => {
    if (!id) return;
    if (!entryIds.has(id)) {
      errors.push(`${where}: points to unknown entry "${id}".`);
    }
  };

  if (!Array.isArray(s.ages) || s.ages.length === 0) {
    errors.push('structure.ages must be a non-empty array.');
  } else {
    for (const a of s.ages) {
      if (!a.id || !a.name) errors.push(`structure.ages: age is missing id or name.`);
      checkEntry(`structure.ages[${a.id}].startPassage`, a.startPassage);
    }
  }

  for (const loc of s.locations ?? []) {
    checkEntry(`structure.locations[${loc.id}].passage`, loc.passage);
    for (const [ageId, passage] of Object.entries(loc.visitPassages ?? {})) {
      checkEntry(`structure.locations[${loc.id}].visitPassages[${ageId}]`, passage);
    }
  }

  for (const q of s.quests ?? []) {
    checkEntry(`structure.quests[${q.id}].passage`, q.passage);
  }

  checkEntry('structure.epiloguePassage', s.epiloguePassage);

  if (errors.length > 0) {
    throw new Error(`Book structure validation failed:\n• ${errors.join('\n• ')}`);
  }
}
