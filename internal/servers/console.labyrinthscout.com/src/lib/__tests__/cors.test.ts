import { describe, expect, it } from 'vitest';
import { resolveScoutCorsOrigin } from '../cors.js';

describe('resolveScoutCorsOrigin', () => {
  it('returns null when nothing is configured', () => {
    expect(resolveScoutCorsOrigin('', 'https://carinaai.uk')).toBeNull();
  });

  it('returns wildcard when configured', () => {
    expect(resolveScoutCorsOrigin('*', 'https://carinaai.uk')).toBe('*');
  });

  it('returns the matching request origin only when allowed', () => {
    expect(
      resolveScoutCorsOrigin('https://console.labyrinthscout.com,https://carinaai.uk', 'https://carinaai.uk'),
    ).toBe('https://carinaai.uk');
  });

  it('rejects disallowed origins', () => {
    expect(
      resolveScoutCorsOrigin('https://console.labyrinthscout.com,https://carinaai.uk', 'https://evil.example'),
    ).toBeNull();
  });
});

