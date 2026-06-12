import { describe, expect, it } from 'vitest';
import { generateSessionId } from './id';

describe('generateSessionId', () => {
  it('uses the mobile prefix and never falls back to default', () => {
    const id = generateSessionId();
    expect(id.startsWith('mobile-')).toBe(true);
    expect(id).not.toBe('default');
    expect(id.split('-').length).toBeGreaterThanOrEqual(3);
  });

  it('generates unique ids', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});
