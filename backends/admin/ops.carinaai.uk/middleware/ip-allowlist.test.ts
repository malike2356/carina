import { describe, expect, it } from 'vitest';
import { parseAllowedIps } from '../middleware/ip-allowlist.js';

describe('ops IP allowlist', () => {
  it('parses comma-separated allowlist entries', () => {
    expect(parseAllowedIps('127.0.0.1, 10.0.0.5 ,')).toEqual(['127.0.0.1', '10.0.0.5']);
  });

  it('returns empty list when unset', () => {
    expect(parseAllowedIps(undefined)).toEqual([]);
    expect(parseAllowedIps('   ')).toEqual([]);
  });
});
