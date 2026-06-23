import { describe, expect, it } from 'vitest';
import {
  carinaRuntimeVersion,
  parseSemver,
  satisfiesMinVersion,
} from './version-compat.js';

describe('version-compat', () => {
  it('parses semver triples', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('v0.1.1-beta')).toEqual([0, 1, 1]);
  });

  it('compares minimum version correctly', () => {
    expect(satisfiesMinVersion('0.2.0', '0.1.0')).toBe(true);
    expect(satisfiesMinVersion('0.1.1', '0.1.1')).toBe(true);
    expect(satisfiesMinVersion('0.1.0', '0.2.0')).toBe(false);
    expect(satisfiesMinVersion('1.0.0', '0.9.9')).toBe(true);
  });

  it('reads carina runtime version from package.json', () => {
    const v = carinaRuntimeVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
