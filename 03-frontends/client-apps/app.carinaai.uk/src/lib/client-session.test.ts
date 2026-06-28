import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasClientSessionCookie } from './client-session';

function mockDocumentCookie(value: string) {
  vi.stubGlobal('document', {
    cookie: value,
  });
}

describe('hasClientSessionCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when document is unavailable', () => {
    vi.stubGlobal('document', undefined);
    expect(hasClientSessionCookie()).toBe(false);
  });

  it('returns false when no session cookie is present', () => {
    mockDocumentCookie('theme=dark; carina_lang=en');
    expect(hasClientSessionCookie()).toBe(false);
  });

  it('returns true when better-auth session cookie is present', () => {
    mockDocumentCookie('better-auth.session_token=abc123; theme=dark');
    expect(hasClientSessionCookie()).toBe(true);
  });
});
