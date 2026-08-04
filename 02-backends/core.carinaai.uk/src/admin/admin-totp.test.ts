import { describe, expect, it } from 'vitest';
import { generate, generateSecret } from 'otplib';
import { verifyTotpCode, buildTotpOtpauthUrl } from './admin-totp.js';

describe('admin-totp', () => {
  it('builds otpauth URL and verifies a generated code', async () => {
    const secret = generateSecret();
    const url = buildTotpOtpauthUrl('admin@test.local', secret);
    expect(url).toContain('otpauth://totp/');
    const token = await generate({ secret });
    expect(await verifyTotpCode(secret, token)).toBe(true);
  });
});
