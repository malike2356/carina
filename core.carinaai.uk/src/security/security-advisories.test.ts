import { describe, expect, it } from 'vitest';
import { listSecurityAdvisories } from './security-advisories.js';

describe('security-advisories', () => {
  it('includes builtin advisories', () => {
    const rows = listSecurityAdvisories('/tmp/carina-advisories-test');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.id.startsWith('CARINA-'))).toBe(true);
  });
});
