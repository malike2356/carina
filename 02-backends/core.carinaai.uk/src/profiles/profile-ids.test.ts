import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_PROFILE_IDS, isBuiltinProfileId } from './profile-ids.js';

describe('profile-ids', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the support builtin profile id', () => {
    expect(BUILTIN_PROFILE_IDS.support).toBe('support');
    expect(isBuiltinProfileId('support')).toBe(true);
    expect(isBuiltinProfileId('default')).toBe(false);
  });
});
