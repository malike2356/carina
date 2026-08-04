import { describe, expect, it } from 'vitest';
import { isCorsOriginAllowed, resolveAllowedCorsOrigins } from './cors-origins.js';

describe('cors-origins', () => {
  it('allows production app origin in hosted mode', () => {
    const prev = process.env.HOSTED_MODE;
    process.env.HOSTED_MODE = 'true';
    const allowed = resolveAllowedCorsOrigins();
    expect(isCorsOriginAllowed('https://app.carinaai.uk', allowed)).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example', allowed)).toBe(false);
    process.env.HOSTED_MODE = prev;
  });

  it('honours explicit CORS_ORIGIN list', () => {
    const prev = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'https://custom.example';
    const allowed = resolveAllowedCorsOrigins();
    expect(allowed).toEqual(['https://custom.example']);
    process.env.CORS_ORIGIN = prev;
  });
});
