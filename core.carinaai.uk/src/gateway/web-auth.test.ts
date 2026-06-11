import { describe, expect, it } from 'vitest';
import { isOpsMachineApiPath, isPublicHostedPath } from './web-auth.js';

describe('web-auth', () => {
  it('marks hosted auth paths as public', () => {
    expect(isPublicHostedPath('/hosted-login')).toBe(true);
    expect(isPublicHostedPath('/hosted-register')).toBe(true);
    expect(isPublicHostedPath('/app/auth/login')).toBe(true);
    expect(isPublicHostedPath('/app/auth/register')).toBe(true);
    expect(isPublicHostedPath('/api/chat')).toBe(false);
  });

  it('allows ops bearer on machine-readable API paths', () => {
    expect(isOpsMachineApiPath('/api/providers', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/health', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/ops/skill-packs', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/ops/skill-packs', 'PUT')).toBe(true);
    expect(isOpsMachineApiPath('/api/chat/stream', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/chat/send', 'POST')).toBe(false);
    expect(isOpsMachineApiPath('/', 'GET')).toBe(false);
  });
});
