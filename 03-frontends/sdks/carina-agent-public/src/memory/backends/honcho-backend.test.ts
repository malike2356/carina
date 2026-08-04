import { afterEach, describe, expect, it, vi } from 'vitest';
import { honchoBackend } from './honcho-backend.js';

describe('honchoBackend', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.HONCHO_API_KEY;
    delete process.env.HONCHO_URL;
  });

  it('requires API key for cloud', () => {
    expect(honchoBackend.isConfigured()).toBe(false);
    process.env.HONCHO_API_KEY = 'hk_test';
    expect(honchoBackend.isConfigured()).toBe(true);
  });

  it('saves messages to Honcho session API', async () => {
    process.env.HONCHO_API_KEY = 'hk_test';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await honchoBackend.saveMemory('session-1', 'user', 'hello honcho');

    const sessionCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/sessions/session-1/messages'));
    expect(sessionCall).toBeTruthy();
    const body = JSON.parse(String(sessionCall?.[1]?.body));
    expect(body.messages[0].content).toBe('hello honcho');
  });
});
