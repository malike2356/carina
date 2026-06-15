import { CATALOG_ENTRIES } from './catalog-data.js';
import type { CatalogEntry } from './types.js';

export const CATALOG_VERSION = '2026-06-15';

export function getCatalog(): CatalogEntry[] {
  return CATALOG_ENTRIES;
}

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG_ENTRIES.find((e) => e.id === id);
}

export function searchCatalog(query: string): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG_ENTRIES;
  return CATALOG_ENTRIES.filter((entry) => {
    const haystack = [
      entry.id,
      entry.displayName,
      entry.family,
      entry.paramCount,
      entry.quantization,
      entry.format,
      ...entry.strengths,
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function validateCatalog(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of CATALOG_ENTRIES) {
    if (ids.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.serveVia.length) errors.push(`empty serveVia: ${entry.id}`);
    if (entry.vramRequiredGb <= 0) errors.push(`invalid vramRequiredGb: ${entry.id}`);
    if (entry.ramRequiredGb <= 0) errors.push(`invalid ramRequiredGb: ${entry.id}`);
  }
  return errors;
}
