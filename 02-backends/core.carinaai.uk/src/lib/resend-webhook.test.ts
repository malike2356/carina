import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { verifyResendWebhook } from './resend-webhook.js';

describe('verifyResendWebhook', () => {
  it('accepts valid Svix signatures', () => {
    const secret = 'whsec_' + Buffer.from('test-secret-key-32bytes!!!!').toString('base64');
    const body = '{"type":"email.received"}';
    const id = 'msg_123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const keyBytes = Buffer.from('test-secret-key-32bytes!!!!');
    const signed = `${id}.${timestamp}.${body}`;
    const sig = crypto.createHmac('sha256', keyBytes).update(signed).digest('base64');
    const ok = verifyResendWebhook(body, {
      id,
      timestamp,
      signature: `v1,${sig}`,
    }, secret);
    expect(ok).toBe(true);
  });

  it('rejects tampered payloads', () => {
    const secret = 'whsec_' + Buffer.from('test-secret-key-32bytes!!!!').toString('base64');
    const ok = verifyResendWebhook('{"tampered":true}', {
      id: 'msg_123',
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: 'v1,invalid',
    }, secret);
    expect(ok).toBe(false);
  });
});
