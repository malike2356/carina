import { afterEach, describe, expect, it, vi } from 'vitest';
import { GotifyAdapter } from './gotify-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GotifyAdapter', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('sendMessage posts JSON to the Gotify message endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const adapter = new GotifyAdapter(true, 'https://gotify.example.com', 'app-token');

    await adapter.sendMessage('ignored', 'Server is down');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gotify.example.com/message');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Gotify-Key': 'app-token',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Carina',
      message: 'Server is down',
      priority: 5,
    });
  });

  it('parseInbound always returns null', () => {
    const adapter = new GotifyAdapter(true, 'https://gotify.example.com', 'app-token');
    expect(adapter.parseInbound({ message: 'test' })).toBeNull();
    expect(adapter.parseInbound({})).toBeNull();
  });

  it('checkConfigured returns false when url or token is missing', () => {
    expect(new GotifyAdapter(true, '', 'app-token').checkConfigured()).toBe(false);
    expect(new GotifyAdapter(true, 'https://gotify.example.com', '').checkConfigured()).toBe(false);
    expect(new GotifyAdapter(true, '', '').checkConfigured()).toBe(false);
  });

  it('checkConfigured returns true when url and token are set', () => {
    const adapter = new GotifyAdapter(true, 'https://gotify.example.com', 'app-token');
    expect(adapter.checkConfigured()).toBe(true);
  });
});
