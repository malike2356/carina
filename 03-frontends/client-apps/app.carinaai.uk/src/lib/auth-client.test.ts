import { describe, expect, it, vi } from 'vitest';
import { resolveAuthClientBaseUrl } from './auth-client-origin';

describe('resolveAuthClientBaseUrl', () => {
  it('uses the browser origin when window is available', () => {
    vi.stubGlobal('window', { location: { origin: 'https://admin.hireaiva.co.uk' } });
    expect(resolveAuthClientBaseUrl()).toBe('https://admin.hireaiva.co.uk');
    vi.unstubAllGlobals();
  });

  it('returns undefined during SSR', () => {
    vi.stubGlobal('window', undefined);
    expect(resolveAuthClientBaseUrl()).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
