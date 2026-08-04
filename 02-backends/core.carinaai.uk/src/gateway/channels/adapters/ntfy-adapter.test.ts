import { afterEach, describe, expect, it, vi } from 'vitest';
import { NtfyAdapter } from './ntfy-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('NtfyAdapter', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('sendMessage posts plain text to the topic URL', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const adapter = new NtfyAdapter(true, 'https://ntfy.sh', 'alerts', 'secret-token');

    await adapter.sendMessage('ignored', 'Hello from Carina');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ntfy.sh/alerts');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'text/plain',
      Authorization: 'Bearer secret-token',
    });
    expect(init.body).toBe('Hello from Carina');
  });

  it('sendMessage omits Authorization when token is not set', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const adapter = new NtfyAdapter(true, 'https://ntfy.sh', 'alerts', '');

    await adapter.sendMessage('ignored', 'No auth');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain' });
  });

  it('parseInbound always returns null', () => {
    const adapter = new NtfyAdapter(true, 'https://ntfy.sh', 'alerts');
    expect(adapter.parseInbound({ message: 'test' })).toBeNull();
    expect(adapter.parseInbound(null)).toBeNull();
  });

  it('checkConfigured returns false when topic is missing', () => {
    const adapter = new NtfyAdapter(true, 'https://ntfy.sh', '');
    expect(adapter.checkConfigured()).toBe(false);
  });

  it('checkConfigured returns true when topic is set', () => {
    const adapter = new NtfyAdapter(true, 'https://ntfy.sh', 'alerts');
    expect(adapter.checkConfigured()).toBe(true);
  });
});
