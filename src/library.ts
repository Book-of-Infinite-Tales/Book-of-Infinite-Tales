import type { BookSource } from './types';
import { formatSource } from './loader';

const KEY = 'boit.library.v1';

export type LibraryEntry = {
  source: BookSource;
  title: string;
  addedAt: number;
  aiGenerated?: boolean;
};

export function readLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToLibrary(entry: LibraryEntry): LibraryEntry[] {
  const current = readLibrary();
  const key = formatSource(entry.source);
  const filtered = current.filter((e) => formatSource(e.source) !== key);
  const next = [{ ...entry, addedAt: Date.now() }, ...filtered];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeFromLibrary(source: BookSource): LibraryEntry[] {
  const key = formatSource(source);
  const next = readLibrary().filter((e) => formatSource(e.source) !== key);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
