import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeSessionFtsDbForTests, openSessionFtsDbForTests } from './session-fts-db.js';
import { indexSession } from './session-fts-indexer.js';
import { recallAcrossSessions, sanitizeFtsQuery, searchSessionsFts5 } from './session-fts-search.js';

vi.mock('../brain/auxiliary-client.js', () => ({
  callAuxiliaryModel: vi.fn().mockResolvedValue('Discussed Rightmove listing strategy last week.'),
}));

describe('session-fts-search', () => {
  beforeEach(() => {
    openSessionFtsDbForTests(':memory:');
  });

  afterEach(() => {
    closeSessionFtsDbForTests();
    vi.clearAllMocks();
  });

  function seed(profileId: string, sessionId: string, title: string, fullText: string): void {
    const now = Date.now();
    indexSession({
      sessionId,
      title,
      summary: title,
      fullText,
      createdAt: now,
      updatedAt: now,
      profileId,
    });
  }

  it('indexes and finds the right session by keyword', () => {
    seed('default', 'sess-rightmove', 'Rightmove research', 'user: We discussed Rightmove API limits');
    seed('default', 'sess-docker', 'Docker setup', 'user: docker compose up failed');
    seed('default', 'sess-email', 'Email triage', 'user: inbox rules for support');

    const results = searchSessionsFts5('rightmove', { profileId: 'default', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.sessionId).toBe('sess-rightmove');
    expect(results[0]?.snippet.toLowerCase()).toContain('rightmove');
  });

  it('returns empty results for empty query without crash', () => {
    seed('default', 'sess-a', 'Alpha', 'user: hello world');
    expect(searchSessionsFts5('')).toEqual([]);
    expect(searchSessionsFts5('   ')).toEqual([]);
  });

  it('isolates sessions by profile id', () => {
    seed('alice', 'alice-session', 'Alice topic', 'user: alice rightmove notes');
    seed('bob', 'bob-session', 'Bob topic', 'user: bob rightmove notes');

    const aliceHits = searchSessionsFts5('rightmove', { profileId: 'alice', limit: 10 });
    const bobHits = searchSessionsFts5('rightmove', { profileId: 'bob', limit: 10 });

    expect(aliceHits).toHaveLength(1);
    expect(aliceHits[0]?.sessionId).toBe('alice-session');
    expect(bobHits).toHaveLength(1);
    expect(bobHits[0]?.sessionId).toBe('bob-session');
  });

  it('sanitizes FTS special characters', () => {
    expect(sanitizeFtsQuery('rightmove "quoted" *bad')).toBe('rightmove quoted bad');
    expect(sanitizeFtsQuery('keyword-alpha')).toBe('keyword alpha');
  });

  it('recallAcrossSessions returns summarized text', async () => {
    seed('default', 'sess-recall', 'Property valuation', 'user: property valuation for Rightmove listing');
    const text = await recallAcrossSessions('property valuation', 'default');
    expect(text).toContain('Rightmove');
  });

  it('recallAcrossSessions returns friendly empty message when no hits', async () => {
    const text = await recallAcrossSessions('missing-topic', 'default');
    expect(text).toContain('No past sessions found');
  });

  it('search across 1000 sessions completes within 50ms', () => {
    const now = Date.now();
    for (let i = 0; i < 1000; i += 1) {
      indexSession({
        sessionId: `perf-${i}`,
        title: `Session ${i}`,
        summary: `Summary ${i}`,
        fullText: `user: discussion about topic-${i % 17} and keyword-alpha`,
        createdAt: now - i,
        updatedAt: now - i,
        profileId: 'default',
      });
    }

    const start = performance.now();
    const results = searchSessionsFts5('keyword alpha', { profileId: 'default', limit: 10 });
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});
