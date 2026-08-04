import { describe, expect, it } from 'vitest';
import { emailMatchesAutoSendAllowlist } from './social-settings-store.js';

describe('emailMatchesAutoSendAllowlist', () => {
  it('matches exact email', () => {
    expect(
      emailMatchesAutoSendAllowlist('Ada Lovelace <ada@example.com>', ['ada@example.com']),
    ).toBe(true);
  });

  it('matches domain entries', () => {
    expect(
      emailMatchesAutoSendAllowlist('boss@acme.co.uk', ['@acme.co.uk', '*@partner.com']),
    ).toBe(true);
    expect(
      emailMatchesAutoSendAllowlist('other@somewhere.com', ['@acme.co.uk']),
    ).toBe(false);
  });

  it('ignores non-email allowlist phrases', () => {
    expect(
      emailMatchesAutoSendAllowlist('ada@example.com', ['thanks', 'ok']),
    ).toBe(false);
  });
});
