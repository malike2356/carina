import { describe, expect, it } from 'vitest';
import { assertNavigationAllowed } from './nav-guard.js';

describe('assertNavigationAllowed', () => {
  it('allows public https URLs', async () => {
    const url = await assertNavigationAllowed('https://example.com');
    expect(url.hostname).toBe('example.com');
  });

  it('blocks localhost', async () => {
    await expect(assertNavigationAllowed('http://127.0.0.1/admin')).rejects.toThrow('blocked');
  });

  it('blocks private IPs', async () => {
    await expect(assertNavigationAllowed('http://10.0.0.1/internal')).rejects.toThrow('blocked');
    await expect(assertNavigationAllowed('http://192.168.1.1/')).rejects.toThrow('blocked');
    await expect(assertNavigationAllowed('http://172.16.0.1/')).rejects.toThrow('blocked');
  });

  it('blocks file protocol', async () => {
    await expect(assertNavigationAllowed('file:///etc/passwd')).rejects.toThrow('Blocked protocol');
  });
});
