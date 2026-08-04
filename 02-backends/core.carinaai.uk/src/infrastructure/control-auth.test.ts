import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../ops/ops-config.js', () => ({
  opsToken: () => 'ops-secret',
}));

describe('control-auth scopes', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CARINA_HOME = '/tmp/carina-control-auth-test';
  });

  function mockReq(token?: string, session?: Record<string, unknown>): Request {
    return {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      session,
    } as unknown as Request;
  }

  function mockRes() {
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    return res as unknown as Response & { statusCode: number; body: unknown };
  }

  it('allows ops token for node routes', async () => {
    const { isControlAuthorizedForScope } = await import('./control-auth.js');
    expect(isControlAuthorizedForScope(mockReq('ops-secret'), 'nodes')).toBe(true);
  });

  it('denies chat-only device for node routes', async () => {
    const pairing = await import('./device-pairing.js');
    const pending = pairing.createPairingCode();
    const claimed = pairing.claimPairing({
      code: pending.code,
      name: 'phone',
      platform: 'ios',
      scopes: ['chat'],
    });
    const { isControlAuthorizedForScope, requireControlScope } = await import('./control-auth.js');
    expect(isControlAuthorizedForScope(mockReq(claimed.token), 'nodes')).toBe(false);
    const res = mockRes();
    expect(requireControlScope(mockReq(claimed.token), res, 'nodes')).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('allows nodes scope for node dispatch', async () => {
    const pairing = await import('./device-pairing.js');
    const pending = pairing.createPairingCode();
    const claimed = pairing.claimPairing({
      code: pending.code,
      name: 'ops-phone',
      platform: 'android',
      scopes: ['nodes'],
    });
    const { isControlAuthorizedForScope } = await import('./control-auth.js');
    expect(isControlAuthorizedForScope(mockReq(claimed.token), 'nodes')).toBe(true);
  });
});
