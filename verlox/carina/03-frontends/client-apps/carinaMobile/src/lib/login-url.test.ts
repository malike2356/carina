import { describe, expect, it } from 'vitest';
import { extractLoginTokenFromUrl, isLoginQrPayload } from './login-url';

describe('login-url', () => {
  it('parses carina login deep links', () => {
    expect(extractLoginTokenFromUrl('carina://login?token=abc123456789012345')).toBe( // gitleaks:allow
      'abc123456789012345', // gitleaks:allow
    );
  });

  it('accepts raw tokens', () => {
    expect(extractLoginTokenFromUrl('abcdefghijklmnop')).toBe('abcdefghijklmnop');
  });

  it('detects login QR payloads', () => {
    expect(isLoginQrPayload('carina://login?token=x')).toBe(true);
    expect(isLoginQrPayload('carina://pair?token=x')).toBe(false);
  });
});
