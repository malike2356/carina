import { describe, expect, it } from 'vitest';
import {
  PACK_NPM_PACKAGES,
  npmPackageForSlug,
  resolvePackDirectory,
  loadPackModule,
} from './pack-discovery.js';
import { PACK_MANIFESTS } from './pack-manifests.js';
import { clearPackResolverCacheForTests, resolvePack } from './pack-resolver.js';

describe('npm pack discovery', () => {
  it('maps extracted pack slugs to npm package names', () => {
    expect(PACK_NPM_PACKAGES['property-uk']).toBe('@verlox/pack-property');
    expect(PACK_NPM_PACKAGES.healthcare).toBe('@verlox/pack-health');
    expect(npmPackageForSlug('property-uk')).toBe('@verlox/pack-property');
  });

  it('manifests include npmPackage for extracted packs', () => {
    expect(PACK_MANIFESTS['property-uk'].npmPackage).toBe('@verlox/pack-property');
    expect(PACK_MANIFESTS.healthcare.npmPackage).toBe('@verlox/pack-health');
  });

  it('resolves property-uk from monorepo packages in dev/test', () => {
    const dir = resolvePackDirectory('property-uk');
    expect(dir).toBeTruthy();
    expect(dir).toMatch(/packages\/packs\/property-uk/);
  });

  it('loads property-uk skills when workspace pack is present', async () => {
    clearPackResolverCacheForTests();
    const mod = await loadPackModule('property-uk');
    expect(mod.skills.length).toBeGreaterThan(0);
    expect(mod.systemSuffix.length).toBeGreaterThan(0);

    const pack = await resolvePack('property-uk');
    expect(pack.manifest.name).toBe('property-uk');
    expect(pack.skills.length).toBe(mod.skills.length);
  });

  it('loads healthcare skills when workspace pack is present', async () => {
    clearPackResolverCacheForTests();
    const mod = await loadPackModule('healthcare');
    expect(mod.skills.length).toBeGreaterThan(0);
  });
});
