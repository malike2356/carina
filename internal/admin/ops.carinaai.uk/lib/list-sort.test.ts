import { describe, expect, it } from 'vitest';
import {
  buildMemoriesQuery,
  memoriesOrderBy,
  nextSortDir,
  parseMemorySort,
  parseSortDir,
} from './list-sort.js';

describe('memories list sort', () => {
  it('defaults to newest-first time sort', () => {
    expect(parseMemorySort(undefined)).toBe('time');
    expect(parseSortDir(undefined)).toBe('desc');
    expect(memoriesOrderBy('time', 'desc')).toContain('DESC');
  });

  it('toggles sort direction on repeated header click', () => {
    expect(nextSortDir('time', 'desc', 'time')).toBe('asc');
    expect(nextSortDir('time', 'desc', 'time')).toBe('asc');
  });

  it('builds query strings with filters and sort', () => {
    const href = buildMemoriesQuery({
      page: 2,
      q: 'hello',
      role: 'user',
      session: 'abc',
      sort: 'session',
      dir: 'asc',
    });
    expect(href).toContain('page=2');
    expect(href).toContain('q=hello');
    expect(href).toContain('sort=session');
    expect(href).toContain('dir=asc');
  });
});
