import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushoverAdapter } from './pushover-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PushoverAdapter', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('sendMessage posts form-encoded payload to Pushover API', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const adapter = new PushoverAdapter(true, 'app-token', 'user-key');

    await adapter.sendMessage('ignored', 'Alert body');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.pushover.net/1/messages.json');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(init.body).toBe('token=app-token&user=user-key&message=Alert+body&title=Carina');
  });

  it('parseInbound always returns null', () => {
    const adapter = new PushoverAdapter(true, 'app-token', 'user-key');
    expect(adapter.parseInbound({ message: 'test' })).toBeNull();
    expect(adapter.parseInbound(undefined)).toBeNull();
  });

  it('checkConfigured returns false when token or user is missing', () => {
    expect(new PushoverAdapter(true, '', 'user-key').checkConfigured()).toBe(false);
    expect(new PushoverAdapter(true, 'app-token', '').checkConfigured()).toBe(false);
    expect(new PushoverAdapter(true, '', '').checkConfigured()).toBe(false);
  });

  it('checkConfigured returns true when token and user are set', () => {
    const adapter = new PushoverAdapter(true, 'app-token', 'user-key');
    expect(adapter.checkConfigured()).toBe(true);
  });
});
