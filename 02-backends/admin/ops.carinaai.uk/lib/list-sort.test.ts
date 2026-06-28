import { describe, expect, it } from 'vitest';
import {
  buildMemoriesQuery,
  buildPageWindow,
  buildRagQuery,
  memoriesOrderBy,
  nextSortDir,
  parseMemorySort,
  parsePageSize,
  parseRagEmbedded,
  parseRagSort,
  parseSortDir,
  ragOrderBy,
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

describe('rag list sort', () => {
  it('defaults to newest-first time sort', () => {
    expect(parseRagSort(undefined)).toBe('time');
    expect(parseRagEmbedded(undefined)).toBe('all');
    expect(parsePageSize('99')).toBe(50);
    expect(ragOrderBy('time', 'desc')).toContain('DESC');
  });

  it('builds query strings with filters, sort, and page size', () => {
    const href = buildRagQuery({
      page: 3,
      q: 'lease',
      pack: 'property-uk',
      embedded: 'no',
      sort: 'source',
      dir: 'asc',
      limit: 25,
    });
    expect(href).toContain('page=3');
    expect(href).toContain('q=lease');
    expect(href).toContain('pack=property-uk');
    expect(href).toContain('embedded=no');
    expect(href).toContain('sort=source');
    expect(href).toContain('limit=25');
  });

  it('builds compact page windows for long lists', () => {
    expect(buildPageWindow(1, 1)).toEqual([1]);
    expect(buildPageWindow(5, 12)).toContain('ellipsis');
    expect(buildPageWindow(5, 12)[0]).toBe(1);
    expect(buildPageWindow(5, 12).at(-1)).toBe(12);
  });
});
