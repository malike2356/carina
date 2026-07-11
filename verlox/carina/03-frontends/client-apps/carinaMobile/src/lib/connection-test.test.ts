import { describe, expect, it, vi, afterEach } from 'vitest';
import { testGatewayConnection } from './connection-test';

describe('connection-test', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports online when health returns ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, mode: 'server' }),
      }),
    );

    const result = await testGatewayConnection('http://localhost:3000');
    expect(result.status).toBe('online');
    expect(result.health?.ok).toBe(true);
  });

  it('reports auth-error on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const result = await testGatewayConnection('http://localhost:3000', {
      apiKey: 'bad-key',
    });
    expect(result.status).toBe('auth-error');
  });
});
