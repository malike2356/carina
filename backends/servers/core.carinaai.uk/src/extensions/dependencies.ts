import { getActivePackNames } from '../skills/index.js';
import type { ExtensionManifest } from './manifest.js';
import { getExtensionRecord } from './store.js';

export async function validateExtensionDependencies(
  manifest: ExtensionManifest,
): Promise<string[]> {
  const errors: string[] = [];
  const deps = manifest.dependencies;
  if (!deps) return errors;

  if (deps.extensions?.length) {
    for (const extId of deps.extensions) {
      const record = await getExtensionRecord(extId);
      if (!record) {
        errors.push(`Missing dependency extension: ${extId}`);
      } else if (record.status !== 'enabled') {
        errors.push(`Dependency extension "${extId}" must be enabled first (status: ${record.status})`);
      }
    }
  }

  if (deps.packs?.length) {
    const active = new Set(getActivePackNames());
    for (const pack of deps.packs) {
      if (!active.has(pack)) {
        errors.push(`Dependency skill pack "${pack}" is not active`);
      }
    }
  }

  return errors;
}
