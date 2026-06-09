import { describe, expect, it } from 'vitest';
import { isPublicHostedPath } from './web-auth.js';

describe('web-auth', () => {
  it('marks hosted auth paths as public', () => {
    expect(isPublicHostedPath('/hosted-login')).toBe(true);
    expect(isPublicHostedPath('/hosted-register')).toBe(true);
    expect(isPublicHostedPath('/app/auth/login')).toBe(true);
    expect(isPublicHostedPath('/app/auth/register')).toBe(true);
    expect(isPublicHostedPath('/api/chat')).toBe(false);
  });
});
