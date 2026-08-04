/** Postgres ORDER By for tables with updated_at and created_at. */
export const ORDER_BY_RECENT_ACTIVITY = 'COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC';

/** Postgres ORDER By for tables with created_at only. */
export const ORDER_BY_CREATED_RECENT = 'created_at DESC NULLS LAST, id DESC';

export type MemorySortColumn = 'time' | 'session' | 'role';
export type SortDir = 'asc' | 'desc';

const MEMORY_SORT_COLUMNS = new Set<MemorySortColumn>(['time', 'session', 'role']);

export function parseMemorySort(raw: unknown): MemorySortColumn {
  const value = String(raw ?? 'time').trim().toLowerCase();
  return MEMORY_SORT_COLUMNS.has(value as MemorySortColumn) ? (value as MemorySortColumn) : 'time';
}

export function parseSortDir(raw: unknown, fallback: SortDir = 'desc'): SortDir {
  const value = String(raw ?? fallback).trim().toLowerCase();
  return value === 'asc' ? 'asc' : 'desc';
}

/** SQL ORDER By for ops memories list. Default: newest first. */
export function memoriesOrderBy(sort: MemorySortColumn, dir: SortDir): string {
  const desc = dir === 'desc';
  const tieBreak = desc ? 'created_at DESC, id DESC' : 'created_at ASC, id ASC';

  switch (sort) {
    case 'session':
      return desc
        ? `session_id DESC NULLS LAST, ${tieBreak}`
        : `session_id ASC NULLS LAST, ${tieBreak}`;
    case 'role':
      return desc
        ? `role DESC, ${tieBreak}`
        : `role ASC, ${tieBreak}`;
    case 'time':
    default:
      return desc
        ? ORDER_BY_RECENT_ACTIVITY
        : 'COALESCE(updated_at, created_at) ASC NULLS FIRST, id ASC';
  }
}

export function memorySortArrow(sort: MemorySortColumn, dir: SortDir, column: MemorySortColumn): string {
  if (sort !== column) return '';
  return dir === 'desc' ? ' (newest)' : ' (oldest)';
}

export function nextSortDir<T extends string>(
  sort: T,
  dir: SortDir,
  column: T,
  defaultDescColumn: T = 'time' as T,
): SortDir {
  if (sort === column) return dir === 'desc' ? 'asc' : 'desc';
  return column === defaultDescColumn ? 'desc' : 'asc';
}

export function buildMemoriesQuery(params: {
  page?: number;
  q?: string;
  role?: string;
  session?: string;
  sort?: MemorySortColumn;
  dir?: SortDir;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.role && params.role !== 'all') search.set('role', params.role);
  if (params.session) search.set('session', params.session);
  if (params.sort && params.sort !== 'time') search.set('sort', params.sort);
  if (params.dir && !(params.sort === 'time' && params.dir === 'desc')) search.set('dir', params.dir);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export type RagSortColumn = 'time' | 'pack' | 'source' | 'embedding';
export type RagEmbeddedFilter = 'all' | 'yes' | 'no';

const RAG_SORT_COLUMNS = new Set<RagSortColumn>(['time', 'pack', 'source', 'embedding']);

export function parseRagSort(raw: unknown): RagSortColumn {
  const value = String(raw ?? 'time').trim().toLowerCase();
  return RAG_SORT_COLUMNS.has(value as RagSortColumn) ? (value as RagSortColumn) : 'time';
}

export function parseRagEmbedded(raw: unknown): RagEmbeddedFilter {
  const value = String(raw ?? 'all').trim().toLowerCase();
  return value === 'yes' || value === 'no' ? value : 'all';
}

export function parsePageSize(raw: unknown, fallback = 50): number {
  const value = Number(raw);
  if (value === 25 || value === 50 || value === 100) return value;
  return fallback;
}

/** SQL ORDER BY for ops RAG chunk list. Default: newest first. */
export function ragOrderBy(sort: RagSortColumn, dir: SortDir): string {
  const desc = dir === 'desc';
  const tieBreak = desc ? 'created_at DESC, id DESC' : 'created_at ASC, id ASC';

  switch (sort) {
    case 'pack':
      return desc ? `pack DESC, ${tieBreak}` : `pack ASC, ${tieBreak}`;
    case 'source':
      return desc ? `source DESC, ${tieBreak}` : `source ASC, ${tieBreak}`;
    case 'embedding':
      return desc
        ? `(CASE WHEN embedding IS NULL THEN 0 ELSE 1 END) DESC, ${tieBreak}`
        : `(CASE WHEN embedding IS NULL THEN 0 ELSE 1 END) ASC, ${tieBreak}`;
    case 'time':
    default:
      return desc ? ORDER_BY_CREATED_RECENT : 'created_at ASC NULLS FIRST, id ASC';
  }
}

export function ragSortArrow(sort: RagSortColumn, dir: SortDir, column: RagSortColumn): string {
  if (sort !== column) return '';
  return dir === 'desc' ? ' ↓' : ' ↑';
}

export function buildRagQuery(params: {
  page?: number;
  q?: string;
  pack?: string;
  embedded?: RagEmbeddedFilter;
  sort?: RagSortColumn;
  dir?: SortDir;
  limit?: number;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.pack && params.pack !== 'all') search.set('pack', params.pack);
  if (params.embedded && params.embedded !== 'all') search.set('embedded', params.embedded);
  if (params.sort && params.sort !== 'time') search.set('sort', params.sort);
  if (params.dir && !(params.sort === 'time' && params.dir === 'desc')) search.set('dir', params.dir);
  if (params.limit && params.limit !== 50) search.set('limit', String(params.limit));
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function buildPageWindow(
  current: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const window: Array<number | 'ellipsis'> = [];

  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0 && sorted[index]! - sorted[index - 1]! > 1) window.push('ellipsis');
    window.push(sorted[index]!);
  }

  return window;
}

export function sortByIsoRecent<T>(
  items: T[],
  getTimestamp: (item: T) => string | undefined,
): T[] {
  return [...items].sort((a, b) => {
    const aTs = getTimestamp(a) ?? '';
    const bTs = getTimestamp(b) ?? '';
    return bTs.localeCompare(aTs);
  });
}
