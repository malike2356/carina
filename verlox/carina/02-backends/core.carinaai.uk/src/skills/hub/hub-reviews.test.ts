import type { AddressInfo } from 'net';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('./migrations.js', () => ({
  hubPool: { query: (...args: unknown[]) => mockQuery(...args) },
  initHubDb: vi.fn(),
}));

vi.mock('./registry.js', () => ({
  getRegistrySummary: vi.fn().mockResolvedValue({ packCount: 0, skillCount: 0, categories: [], totalDownloads: 0 }),
  listHubPacks: vi.fn().mockResolvedValue([]),
  getHubPack: vi.fn().mockResolvedValue(null),
  listHubSkills: vi.fn().mockResolvedValue([]),
  getHubSkill: vi.fn().mockResolvedValue(null),
  getPackArchivePath: vi.fn().mockResolvedValue(null),
  recordPackDownload: vi.fn().mockResolvedValue(undefined),
  listAuthorPacks: vi.fn().mockResolvedValue([]),
}));

import { createSkillsHubApp } from './server.js';

async function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = createSkillsHubApp();
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('skill reviews API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('POST /api/v1/skills/:pack/:name/reviews validates rating', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/skills/property-uk/stamp-duty/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 10, author_id: 'user-1' }),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'rating must be an integer 1-5' });
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  it('POST /api/v1/skills/:pack/:name/reviews inserts a review', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/skills/property-uk/stamp-duty/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, author_id: 'user-1', body: 'Great skill' }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ ok: true });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hub_skill_reviews'),
        ['property-uk', 'stamp-duty', 'user-1', 5, 'Great skill'],
      );
    });
  });

  it('POST returns 429 for duplicate author within 24 hours', async () => {
    await withServer(async (baseUrl) => {
      const url = `${baseUrl}/api/v1/skills/property-uk/stamp-duty/reviews`;
      const body = JSON.stringify({ rating: 4, author_id: 'user-dup', body: 'First' });
      const first = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(first.status).toBe(201);

      const second = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 3, author_id: 'user-dup', body: 'Second' }),
      });
      expect(second.status).toBe(429);
      expect(await second.json()).toMatchObject({
        error: 'You have already submitted a review for this skill recently.',
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  it('GET /api/v1/skills/:pack/:name/reviews returns paginated reviews', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'rev-1',
          author_id: 'user-1',
          rating: 5,
          body: 'Helpful',
          created_at: '2026-01-01T00:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/skills/property-uk/stamp-duty/reviews?limit=10&offset=0`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        reviews: [{
          id: 'rev-1',
          author_id: 'user-1',
          rating: 5,
          body: 'Helpful',
          created_at: '2026-01-01T00:00:00.000Z',
        }],
        total: 1,
        limit: 10,
        offset: 0,
      });
    });
  });
});
