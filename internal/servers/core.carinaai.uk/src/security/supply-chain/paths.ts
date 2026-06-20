import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function resolveProjectRoot(customRoot?: string): string {
  if (customRoot) return path.resolve(customRoot);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function sbomOutputPath(projectRoot = resolveProjectRoot()): string {
  return path.join(projectRoot, 'sbom.spdx.json');
}

export function supplyChainCacheDir(): string {
  return path.join(resolveCarinaDataDir(), 'supply-chain');
}
