import { describe, expect, it } from 'vitest';
import { isLocalhostGatewayUrl, isValidGatewayUrl, normalizeGatewayUrl } from './url-utils';

describe('url-utils', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeGatewayUrl('http://192.168.1.1:3000/')).toBe('http://192.168.1.1:3000');
  });

  it('accepts http and https gateway URLs', () => {
    expect(isValidGatewayUrl('https://app.carinaai.uk')).toBe(true);
    expect(isValidGatewayUrl('http://192.168.1.10:3000')).toBe(true);
    expect(isValidGatewayUrl('ftp://bad')).toBe(false);
    expect(isValidGatewayUrl('')).toBe(false);
  });

  it('rejects localhost URLs for device gateways', () => {
    expect(isLocalhostGatewayUrl('http://localhost:3000')).toBe(true);
    expect(isLocalhostGatewayUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isValidGatewayUrl('http://localhost:3000')).toBe(false);
    expect(isValidGatewayUrl('http://127.0.0.1:3000')).toBe(false);
    expect(isValidGatewayUrl('http://localhost:3000', { allowLocalhost: true })).toBe(true);
  });
});
