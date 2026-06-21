import { describe, expect, it } from 'vitest';
import { assertDevProfileIsolation, isDevProfile } from './dev-isolation.js';

describe('dev-isolation', () => {
  it('detects dev profile names', () => {
    expect(isDevProfile('dev')).toBe(true);
    expect(isDevProfile('production')).toBe(false);
  });

  it('returns no warnings for non-dev profile', () => {
    const warnings = assertDevProfileIsolation('production');
    expect(warnings).toHaveLength(0);
  });
});
