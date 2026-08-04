import { afterEach, describe, expect, it, vi } from 'vitest';
import { mem0Backend } from './mem0-backend.js';

describe('mem0Backend', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MEM0_API_KEY;
    delete process.env.MEM0_URL;
    delete process.env.MEM0_MODE;
  });

  it('reports not configured without API key', () => {
    expect(mem0Backend.isConfigured()).toBe(false);
  });

  it('adds memory via cloud API', async () => {
    process.env.MEM0_API_KEY = 'm0-test';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await mem0Backend.saveMemory('sess-1', 'user', 'hello mem0');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mem0.ai/v3/memories/add/',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.user_id).toBe('sess-1');
    expect(body.messages[0].content).toBe('hello mem0');
  });

  it('searches via cloud API', async () => {
    process.env.MEM0_API_KEY = 'm0-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: '1', memory: 'likes tea', user_id: 'u1', created_at: new Date().toISOString() }],
      }),
    }));

    const hits = await mem0Backend.searchMemory('tea', 5);
    expect(hits[0]?.content).toBe('likes tea');
  });
});
