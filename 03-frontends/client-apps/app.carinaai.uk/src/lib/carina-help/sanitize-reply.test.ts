import { describe, expect, it } from 'vitest';
import { sanitizeCarinaHelpReply } from './sanitize-reply';

describe('sanitizeCarinaHelpReply', () => {
  it('redacts common secret shapes', () => {
    const input =
      'key sk-abcdefghijklmnopqrstuvwxyz012345 and stripe sk_live_abcdefghijklmnopqrstuv and db postgres://user:pass@host/db';
    const out = sanitizeCarinaHelpReply(input);
    expect(out).toContain('[redacted-key]');
    expect(out).toContain('[redacted-stripe]');
    expect(out).toContain('[redacted-db-url]');
    expect(out).not.toContain('sk-abcdefghijklmnopqrstuvwxyz012345');
    expect(out).not.toContain('sk_live_abcdefghijklmnopqrstuv');
  });
});
