import { afterEach, describe, expect, it } from 'vitest';
import { decryptCredentials, encryptCredentials } from './credential-store.js';

describe('credential-store', () => {
  const previous = process.env.CHANNEL_CREDENTIAL_KEY;

  afterEach(() => {
    if (previous === undefined) delete process.env.CHANNEL_CREDENTIAL_KEY;
    else process.env.CHANNEL_CREDENTIAL_KEY = previous;
  });

  it('round-trips credentials', () => {
    process.env.CHANNEL_CREDENTIAL_KEY = 'a'.repeat(64);
    const raw = { bot_token: 'xoxb-test', signing_secret: 'abc' };
    const blob = encryptCredentials(raw);
    expect(decryptCredentials(blob)).toEqual(raw);
  });
});
