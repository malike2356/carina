import { beforeEach, describe, expect, it, vi } from 'vitest';

const keprixApiFetch = vi.fn();
vi.mock('./keprix-api.js', () => ({
  isKeprixApiConfigured: vi.fn(() => true),
  keprixApiFetch,
  readKeprixConfig: vi.fn(() => ({ apiBaseUrl: 'http://keprix.test', studioBaseUrl: 'http://keprix.test', serviceToken: 'token', handoffSecret: '' })),
}));

describe('Keprix health probe', () => {
  beforeEach(async () => {
    keprixApiFetch.mockReset();
    const { clearKeprixHealthCacheForTests } = await import('./keprix-health.js');
    clearKeprixHealthCacheForTests();
  });

  it('records a healthy configured provider', async () => {
    keprixApiFetch.mockResolvedValue({ ok: true, status: 200 });
    const { probeKeprixHealth } = await import('./keprix-health.js');
    const result = await probeKeprixHealth(true);
    expect(result.healthy).toBe(true);
    expect(result.reason).toContain('passed');
  });

  it('records an unavailable provider without throwing', async () => {
    keprixApiFetch.mockRejectedValue(new Error('connection refused'));
    const { probeKeprixHealth } = await import('./keprix-health.js');
    const result = await probeKeprixHealth(true);
    expect(result.healthy).toBe(false);
    expect(result.reason).toContain('connection refused');
  });
});
