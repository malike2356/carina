import { describe, expect, it } from 'vitest';
import { applyAuthHeader } from './http-driver.js';

describe('applyAuthHeader', () => {
  it('keeps Bearer and Basic prefixes', () => {
    const headers: Record<string, string> = {};
    applyAuthHeader(headers, 'Bearer {{token}}', { token: 'abc' });
    expect(headers.Authorization).toBe('Bearer abc');

    const basic: Record<string, string> = {};
    applyAuthHeader(basic, 'Basic {{basic}}', { basic: 'dXNlcjpwYXNz' });
    expect(basic.Authorization).toBe('Basic dXNlcjpwYXNz');
  });

  it('does not wrap bare ClickUp/Monday tokens with Bearer', () => {
    const headers: Record<string, string> = {};
    applyAuthHeader(headers, '{{token}}', { token: 'pk_clickup_raw' });
    expect(headers.Authorization).toBe('pk_clickup_raw');
  });

  it('sets Shopify custom header', () => {
    const headers: Record<string, string> = {};
    applyAuthHeader(headers, 'X-Shopify-Access-Token {{token}}', { token: 'shpat_x' });
    expect(headers['X-Shopify-Access-Token']).toBe('shpat_x');
    expect(headers.Authorization).toBeUndefined();
  });
});
