import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CarinaClient } from './carina-client';

describe('CarinaClient auth and providers', () => {
  const baseUrl = 'https://app.carinaai.uk';
  let client: CarinaClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CarinaClient({ baseUrl, credentials: 'include' });
  });

  it('registers a cloud account', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, redirect: '/?welcome=1' }), { status: 200 }),
    );

    const result = await client.register('user@example.com', 'password12');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/app/auth/register`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'user@example.com', password: 'password12' }),
      }),
    );
  });

  it('fetches the signed-in profile from /app/auth/me', async () => {
    const profile = {
      id: 'u1',
      email: 'user@example.com',
      tier: 'pro',
      apiKey: 'carina_key',
      scoutActive: true,
      org: null,
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 200 }),
    );

    await expect(client.me()).resolves.toEqual(profile);
  });

  it('switches the active provider', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, active: 'anthropic' }), { status: 200 }),
    );

    const result = await client.switchProvider('anthropic');

    expect(result.active).toBe('anthropic');
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/providers/switch`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'anthropic' }),
      }),
    );
  });

  it('requests password reset email', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await client.forgotPassword('user@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/app/auth/forgot-password`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });
});
