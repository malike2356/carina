import { describe, expect, it } from 'vitest';
import { loginRedirectTarget, safeCallbackUrl } from './callback-url.js';

describe('safeCallbackUrl', () => {
  it('allows same-origin relative paths', () => {
    expect(safeCallbackUrl('/scout')).toBe('/scout');
    expect(safeCallbackUrl('/scout?v=20260621e')).toBe('/scout?v=20260621e');
  });

  it('rejects open redirects and auth loops', () => {
    expect(safeCallbackUrl('https://evil.example/scout')).toBe('/');
    expect(safeCallbackUrl('//evil.example/scout')).toBe('/');
    expect(safeCallbackUrl('/login')).toBe('/');
    expect(safeCallbackUrl('/login?x=1')).toBe('/');
  });
});

describe('loginRedirectTarget', () => {
  it('appends ui version only for home redirect', () => {
    expect(loginRedirectTarget('/', '20260621e')).toBe('/?v=20260621e');
    expect(loginRedirectTarget('/scout', '20260621e')).toBe('/scout');
    expect(loginRedirectTarget('/scout?v=20260621e', '20260621e')).toBe('/scout?v=20260621e');
  });
});
