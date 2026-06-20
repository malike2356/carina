import { describe, expect, it } from 'vitest';
import { listAvailablePacks } from './index.js';
import { listKnownPackNames } from './pack-manifests.js';
import { PackNotInstalledError, clearPackResolverCacheForTests, resolvePack } from './pack-resolver.js';

describe('kernel-only pack loading', () => {
  it('lists pack manifests without loading pack skill modules', () => {
    const packs = listAvailablePacks();
    expect(packs.length).toBe(listKnownPackNames().length);
    expect(packs.map((p) => p.name)).toContain('property-uk');
  });

  it('resolvePack loads property-uk when sources exist in dev tree', async () => {
    clearPackResolverCacheForTests();
    const pack = await resolvePack('property-uk');
    expect(pack.skills.length).toBeGreaterThan(0);
    expect(pack.manifest.name).toBe('property-uk');
  });

  it('resolvePack throws PackNotInstalledError for unknown pack name', async () => {
    clearPackResolverCacheForTests();
    await expect(resolvePack('not-a-real-pack')).rejects.toThrow(/Unknown pack/);
  });
});

describe('PackNotInstalledError', () => {
  it('has a helpful install message', () => {
    const err = new PackNotInstalledError('finance');
    expect(err.message).toContain('finance');
    expect(err.message).toContain('carina pack install');
  });
});
