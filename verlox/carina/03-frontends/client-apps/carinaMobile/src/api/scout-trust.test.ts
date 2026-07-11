import { describe, expect, it, vi } from 'vitest';
import { fetchPublicTrust } from './scout-trust';

describe('fetchPublicTrust', () => {
  it('returns parsed trust payload from the public Scout API', async () => {
    const payload = {
      generated_at: '2026-06-12T12:00:00.000Z',
      risk_score: 8,
      risk_tier: 'low',
      source: 'labyrinth-scout',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => payload,
      })),
    );

    await expect(fetchPublicTrust('https://scout.test/api/public/trust')).resolves.toEqual(payload);
  });

  it('throws on non-200 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        text: async () => 'down',
      })),
    );

    await expect(fetchPublicTrust('https://scout.test/api/public/trust')).rejects.toThrow(
      /503/,
    );
  });
});
