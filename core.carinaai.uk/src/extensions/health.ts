import fs from 'fs/promises';
import path from 'path';
import { extensionDir } from '../config/paths.js';
import { readExtensionStore, type ExtensionRecord } from './store.js';
import { validateExtensionBundle } from './validator.js';

export type ExtensionHealthRow = ExtensionRecord & {
  bundle_present: boolean;
  capabilities?: string[];
  risk?: string;
};

export async function listExtensionHealth(): Promise<ExtensionHealthRow[]> {
  const rows = await readExtensionStore();
  const out: ExtensionHealthRow[] = [];

  for (const row of rows) {
    const dir = extensionDir(row.id);
    let bundle_present = false;
    let capabilities: string[] | undefined;
    let risk: string | undefined;
    let health = row.health ?? 'ok';
    let health_message = row.health_message ?? '';

    try {
      await fs.access(path.join(dir, 'extension.json'));
      bundle_present = true;
      const validation = await validateExtensionBundle(dir, { allowHighRisk: true });
      capabilities = validation.manifest.capabilities;
      risk = validation.risk;
      if (!validation.ok) {
        health = 'fail';
        health_message = validation.errors.join('; ');
      } else if (validation.warnings.length > 0) {
        health = health === 'fail' ? 'fail' : 'warn';
        health_message = validation.warnings.join('; ');
      }
    } catch (err) {
      bundle_present = false;
      health = 'fail';
      health_message = err instanceof Error ? err.message : String(err);
    }

    out.push({
      ...row,
      bundle_present,
      capabilities,
      risk,
      health,
      health_message,
    });
  }

  return out;
}
