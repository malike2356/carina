import { describe, expect, it } from 'vitest';
import { applyRelayRedaction, isWithinPrivacyHours } from '@/lib/relay-redaction';

describe('relay-redaction', () => {
  it('redacts PIN patterns before relay', () => {
    expect(applyRelayRedaction('Your PIN: 1234 is ready')).toBe(
      'Your [PIN_REDACTED] is ready',
    );
  });

  it('redacts card numbers', () => {
    expect(applyRelayRedaction('Card 4111 1111 1111 1111')).toBe('Card [CARD_REDACTED]');
  });

  it('respects privacy hour windows', () => {
    expect(isWithinPrivacyHours(12, 7, 22)).toBe(true);
    expect(isWithinPrivacyHours(23, 7, 22)).toBe(false);
    expect(isWithinPrivacyHours(1, 22, 7)).toBe(true);
  });
});
