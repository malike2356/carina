import { describe, expect, it } from 'vitest';
import { isValidGatewayUrl, normalizeGatewayUrl } from './url-utils';

describe('url-utils', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeGatewayUrl('http://192.168.1.1:3000/')).toBe('http://192.168.1.1:3000');
  });

  it('accepts http and https gateway URLs', () => {
    expect(isValidGatewayUrl('http://localhost:3000')).toBe(true);
    expect(isValidGatewayUrl('https://app.carinaai.uk')).toBe(true);
    expect(isValidGatewayUrl('ftp://bad')).toBe(false);
    expect(isValidGatewayUrl('')).toBe(false);
  });
});
