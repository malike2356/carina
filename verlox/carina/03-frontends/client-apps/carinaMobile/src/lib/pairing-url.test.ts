import { describe, expect, it } from 'vitest';
import { extractPairingTokenFromUrl } from '@/lib/pairing-url';

describe('extractPairingTokenFromUrl', () => {
  it('reads token query params from carina deep links', () => {
    expect(extractPairingTokenFromUrl('carina://pair?token=abc123&host=10.0.0.4&port=7430')).toBe(
      'abc123',
    );
  });

  it('reads token query params from https pairing URLs', () => {
    expect(extractPairingTokenFromUrl('https://app.carinaai.uk/pair?token=xyz789')).toBe('xyz789');
  });

  it('reads token path segments', () => {
    expect(extractPairingTokenFromUrl('carina://pair/hex-token-value')).toBe('hex-token-value');
  });

  it('accepts raw token strings', () => {
    expect(extractPairingTokenFromUrl('0123456789abcdef0123456789abcdef')).toBe(
      '0123456789abcdef0123456789abcdef',
    );
  });
});
