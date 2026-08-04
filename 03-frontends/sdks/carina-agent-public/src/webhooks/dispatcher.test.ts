import { describe, expect, it } from 'vitest';
import { signPayload } from './store.js';

describe('webhook signing', () => {
  it('produces consistent HMAC signatures', () => {
    const sig1 = signPayload('secret', '{"event":"test"}');
    const sig2 = signPayload('secret', '{"event":"test"}');
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64);
  });

  it('differs for different secrets', () => {
    const a = signPayload('secret-a', 'body');
    const b = signPayload('secret-b', 'body');
    expect(a).not.toBe(b);
  });
});
