/**
 * Passage links inside prose.
 *
 * `[[1234]]` links to entry 1234 and shows "1234"; `[[1234|the old mill]]`
 * links to entry 1234 and shows "the old mill". Links let a passage offer a
 * conditional jump the way the printed book does ("If you have Story Token
 * #14, turn immediately to 1976") — the player decides whether it applies.
 */

export type ProseSegment = string | { id: string; text: string };

const LINK = /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g;

/** Split text into plain strings and link segments, in order. */
export function parseLinks(text: string): ProseSegment[] {
  const out: ProseSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const id = m[1].trim();
    out.push({ id, text: (m[2] ?? id).trim() });
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Every entry id linked from the text. */
export function linkTargets(text: string): string[] {
  return [...text.matchAll(LINK)].map((m) => m[1].trim());
}
