import { describe, expect, it } from 'vitest';
import { listAvailablePacks } from './index.js';
import { validatePackManifest } from './pack-loader.js';

describe('validatePackManifest', () => {
  it('accepts valid manifest', () => {
    const m = validatePackManifest({
      name: 'test',
      version: '1.0.0',
      description: 'Test pack',
      author: 'Test',
      skillCount: 3,
      optional: true,
    }, 'test');
    expect(m.name).toBe('test');
    expect(m.optional).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(() => validatePackManifest({ name: 'x' }, 'x')).toThrow('missing');
  });
});

describe('listAvailablePacks', () => {
  it('lists all builtin packs including domain packs', () => {
    const packs = listAvailablePacks();
    const names = packs.map((p) => p.name);
    expect(names).toContain('property-uk');
    expect(names).toContain('healthcare');
    expect(names).toContain('finance');
    expect(names).toContain('creative-basics');
    expect(names).toContain('productivity');
  });
});
