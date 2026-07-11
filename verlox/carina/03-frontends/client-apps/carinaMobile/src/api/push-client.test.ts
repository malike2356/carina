import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerPushToken, unregisterPushToken } from './push-client';

describe('push-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers tokens at the hosted push route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await registerPushToken('https://app.carinaai.uk', {
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      taskAlerts: true,
      scoutAlerts: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/app/auth/push/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          token: 'ExponentPushToken[abc]',
          platform: 'android',
          taskAlerts: true,
          scoutAlerts: false,
        }),
      }),
    );
  });

  it('unregisters tokens at the hosted push route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await unregisterPushToken('https://app.carinaai.uk', 'ExponentPushToken[abc]');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/app/auth/push/unregister',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        body: JSON.stringify({ token: 'ExponentPushToken[abc]' }),
      }),
    );
  });
});
