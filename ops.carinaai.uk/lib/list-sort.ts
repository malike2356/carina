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

export function nextSortDir(sort: MemorySortColumn, dir: SortDir, column: MemorySortColumn): SortDir {
  if (sort === column) return dir === 'desc' ? 'asc' : 'desc';
  return column === 'time' ? 'desc' : 'asc';
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
