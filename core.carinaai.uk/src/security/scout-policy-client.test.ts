import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: true,
      url: 'http://scout.test',
      apiKey: 'test-key',
      instanceId: 'inst-1',
      judgeTimeoutMs: 2000,
    },
  },
}));

describe('scout-policy-client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns disabled when labyrinth not enabled', async () => {
    vi.stubEnv('LABYRINTH_ENABLED', 'false');
    const { evaluateScoutToolPolicy } = await import('./scout-policy-client.js');
    const result = await evaluateScoutToolPolicy('shell-exec', {}, 'sess');
    expect(result.source).toBe('disabled');
    expect(result.enforced).toBe(false);
  });

  it('blocks when Scout returns block decision', async () => {
    vi.stubEnv('LABYRINTH_ENABLED', 'true');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        decision: 'block',
        reason: 'Policy denied',
        riskScore: 90,
        shieldMode: 'restrict',
      }),
    }) as typeof fetch;

    const { evaluateScoutToolPolicy } = await import('./scout-policy-client.js');
    const result = await evaluateScoutToolPolicy('shell-exec', { command: 'rm -rf /' }, 'sess');
    expect(result.enforced).toBe(true);
    expect(result.source).toBe('scout');
    expect(result.code).toBe('SCOUT_POLICY_BLOCK');
  });

  it('falls back locally when Scout is unreachable', async () => {
    vi.stubEnv('LABYRINTH_ENABLED', 'true');
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch;

    const { evaluateScoutToolPolicy } = await import('./scout-policy-client.js');
    const result = await evaluateScoutToolPolicy('file-read', {}, 'sess');
    expect(result.source).toBe('local_fallback');
    expect(result.enforced).toBe(false);
  });
});
