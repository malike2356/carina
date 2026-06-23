import { describe, expect, it } from 'vitest';
import {
  buildOtpAuthUrl,
  decodeBase32,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from './web-totp.js';

describe('web-totp', () => {
  it('generates a base32 secret and valid 6-digit codes', () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(10);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies the current code and rejects invalid tokens', () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(false);
    expect(verifyTotpCode(secret, 'abc')).toBe(false);
  });

  it('decodes base32 and builds otpauth URLs', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const decoded = decodeBase32(secret);
    expect(decoded.length).toBeGreaterThan(0);
    const url = buildOtpAuthUrl(secret, 'Carina');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(`secret=${secret}`);
  });
});
