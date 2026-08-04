import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAivaConfigFile } from './config-path.js';
import { resolveDepthFeaturesPath, loadDepthFeatures } from './features.js';
import { resolveProductToolsCatalogPath, loadProductToolsCatalog } from './catalog.js';

describe('resolveAivaConfigFile', () => {
  it('finds package-root config from this module url', () => {
    const features = resolveAivaConfigFile(undefined, 'depth-features.json', import.meta.url);
    const catalog = resolveAivaConfigFile(undefined, 'product-tools.catalog.json', import.meta.url);
    expect(features.endsWith(path.join('config', 'aiva', 'depth-features.json'))).toBe(true);
    expect(catalog.endsWith(path.join('config', 'aiva', 'product-tools.catalog.json'))).toBe(true);
    expect(features.includes(`${path.sep}dist${path.sep}config${path.sep}`)).toBe(false);
  });

  it('simulates dist/src/workers/product-tools layout and still finds package root', () => {
    const fakeDistModule = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../dist/src/workers/product-tools/features.js',
    );
    // Prefer walking from a nested path under package: use fake file:// next to real module
    // by calling with a constructed file URL that nests under dist/src/...
    const nestedUrl = pathToFileUrlDeep();
    const resolved = resolveAivaConfigFile(undefined, 'depth-features.json', nestedUrl);
    expect(resolved).toContain(path.join('config', 'aiva', 'depth-features.json'));
    expect(resolved.includes(`${path.sep}dist${path.sep}config${path.sep}`)).toBe(false);
    void fakeDistModule;
  });

  it('loads features and catalog after path fix', () => {
    expect(resolveDepthFeaturesPath()).toContain('depth-features.json');
    expect(resolveProductToolsCatalogPath()).toContain('product-tools.catalog.json');
    expect(loadDepthFeatures(true).orgs.canvasEnabled).toBe(true);
    expect(loadProductToolsCatalog(true).tools.length).toBeGreaterThanOrEqual(35);
  });
});

function pathToFileUrlDeep(): string {
  // Build a file URL that looks like .../dist/src/workers/product-tools/x.js without requiring dist build
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const nested = path.join(pkgRoot, 'dist', 'src', 'workers', 'product-tools', 'features.js');
  return `file://${nested}`;
}
