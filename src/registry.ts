import type { BookSource } from './types';

export type RegistryBook = {
  repo: string;
  path?: string;
  title: string;
  author: string;
  description?: string;
  tags?: string[];
};

export type Registry = {
  books: RegistryBook[];
};

const REGISTRY_URL =
  'https://raw.githubusercontent.com/RobMcA/library-of-infinite-tales/main/registry.json';

export async function fetchRegistry(): Promise<Registry> {
  try {
    const resp = await fetch(REGISTRY_URL);
    if (!resp.ok) return { books: [] };
    const data = (await resp.json()) as Registry;
    if (!Array.isArray(data?.books)) return { books: [] };
    return data;
  } catch {
    return { books: [] };
  }
}

export function registryBookToSource(book: RegistryBook): BookSource {
  const [owner, repo] = book.repo.split('/');
  return { kind: 'github', owner, repo, path: book.path };
}
