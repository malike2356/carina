import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';

describe('webhook inbound verification', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CARINA_WEBHOOK_INBOUND_SECRET;
  });

  it('allows operator session without signature', async () => {
    vi.doMock('../infrastructure/control-auth.js', () => ({
      isControlAuthorized: vi.fn().mockReturnValue(false),
    }));
    const { verifyInboundTrigger } = await import('./webhook-verify.js');
    const req = { session: { webAuthed: true }, headers: {} } as Request;
    expect(verifyInboundTrigger(req, '{}')).toBe(true);
  });

  it('rejects invalid inbound signature', async () => {
    process.env.CARINA_WEBHOOK_INBOUND_SECRET = 'inbound-secret';
    vi.doMock('../infrastructure/control-auth.js', () => ({
      isControlAuthorized: vi.fn().mockReturnValue(false),
    }));
    const { verifyInboundTrigger } = await import('./webhook-verify.js');
    const req = { session: {}, headers: { 'x-carina-inbound-signature': 'bad' } } as unknown as Request;
    expect(verifyInboundTrigger(req, '{"event":"test"}')).toBe(false);
  });

  it('accepts valid inbound signature', async () => {
    process.env.CARINA_WEBHOOK_INBOUND_SECRET = 'inbound-secret';
    vi.doMock('../infrastructure/control-auth.js', () => ({
      isControlAuthorized: vi.fn().mockReturnValue(false),
    }));
    const { signPayload } = await import('./store.js');
    const body = '{"event":"agent.turn.complete","data":{}}';
    const sig = signPayload('inbound-secret', body);
    const { verifyInboundTrigger } = await import('./webhook-verify.js');
    const req = { session: {}, headers: { 'x-carina-inbound-signature': sig } } as unknown as Request;
    expect(verifyInboundTrigger(req, body)).toBe(true);
  });
});
