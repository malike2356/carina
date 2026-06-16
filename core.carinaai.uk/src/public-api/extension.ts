// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.

export {
  EXTENSION_MANIFEST_VERSION,
  validateExtensionManifest,
  type ExtensionCapability,
  type ExtensionDependencies,
  type ExtensionEntryPoints,
  type ExtensionEvalConfig,
  type ExtensionManifest,
  type ExtensionRisk,
  type ExtensionSafety,
} from '../extensions/manifest.js';

export const EXTENSION_API_VERSION = '0.2.0';
