import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthClientBaseUrl } from './auth-client-origin';

const signOutMock = vi.fn(async ({ fetchOptions }: { fetchOptions?: { onSuccess?: () => void } } = {}) => {
  fetchOptions?.onSuccess?.();
});

vi.mock('better-auth/react', () => ({
  createAuthClient: vi.fn(() => ({
    signOut: signOutMock,
  })),
}));

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

describe('signOutAndRedirect', () => {
  beforeEach(() => {
    signOutMock.mockClear();
    vi.stubGlobal('window', {
      location: {
        assign: vi.fn(),
      },
    });
  });

  it('redirects to the requested destination after sign-out succeeds', async () => {
    const { signOutAndRedirect } = await import('./auth-client');

    await signOutAndRedirect('/logouts');

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        fetchOptions: expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      }),
    );

    const assign = (window.location.assign as unknown as ReturnType<typeof vi.fn>);
    expect(assign).toHaveBeenCalledWith('/logouts');
  });
});
