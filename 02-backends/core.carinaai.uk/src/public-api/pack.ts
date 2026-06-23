// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.

export type { PackManifest } from '../skills/pack-loader.js';
export {
  validatePackManifest,
  readPackManifest,
  listBuiltinPackNames,
} from '../skills/pack-loader.js';

export { PACK_MANIFESTS, listKnownPackNames } from '../skills/pack-manifests.js';
export {
  resolvePack,
  PackNotInstalledError,
} from '../skills/pack-resolver.js';
export type { PackDefinition as ResolvedPackDefinition } from '../skills/pack-resolver.js';

/** Stable API surface version (matches @verlox/carina-core semver at introduction). */
export const PACK_API_VERSION = '0.2.0';
