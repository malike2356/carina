import fs from 'fs/promises';
import path from 'path';
import { extensionDir, CARINA_EXTENSIONS_DIR } from '../config/paths.js';
import { installExtensionBundle } from './installer.js';
import { runExtensionEvalGate } from './gate.js';
import { validateExtensionBundle } from './validator.js';
import {
  getExtensionRecord,
  removeExtensionRecord,
  upsertExtensionRecord,
  readExtensionStore,
} from './store.js';
import { createExtensionSnapshot, rollbackExtensionSnapshot } from './snapshot.js';
import {
  clearStagedExtensionContributions,
  stageExtensionContributions,
} from './contributions.js';
import { validateExtensionDependencies } from './dependencies.js';
import { listExtensionHealth } from './health.js';

export type EnableExtensionOptions = {
  allowDangerous?: boolean;
  bypassEval?: boolean;
};

export async function listExtensions() {
  return listExtensionHealth();
}

export async function installExtension(
  source: string,
  options: { allowDangerous?: boolean } = {},
) {
  return installExtensionBundle({
    source,
    allowHighRisk: options.allowDangerous,
  });
}

export async function enableExtension(
  id: string,
  options: EnableExtensionOptions = {},
): Promise<{ id: string; status: string; message: string }> {
  const bundleDir = extensionDir(id);
  await fs.access(bundleDir);

  const validation = await validateExtensionBundle(bundleDir, {
    allowHighRisk: options.allowDangerous,
  });
  if (!validation.ok) {
    throw new Error(validation.errors.join('; '));
  }

  const depErrors = await validateExtensionDependencies(validation.manifest);
  if (depErrors.length > 0) {
    throw new Error(depErrors.join('; '));
  }

  if (!options.bypassEval) {
    const gate = await runExtensionEvalGate(validation.manifest);
    if (gate.blocked) {
      throw new Error(gate.message ?? 'Extension eval gate failed');
    }
  }

  const snapshot = await createExtensionSnapshot(id);
  await stageExtensionContributions(id);

  const now = new Date().toISOString();
  await upsertExtensionRecord(validation.manifest, {
    status: 'enabled',
    enabled_at: now,
    disabled_at: undefined,
    last_snapshot: snapshot,
    eval_passed: true,
    health: 'ok',
    health_message: 'Enabled',
  });

  let runtimeNote = '';
  const { extensionsRuntimeEnabled, reloadExtensionRuntimeContributions } = await import('./contributions.js');
  if (extensionsRuntimeEnabled()) {
    const reloaded = await reloadExtensionRuntimeContributions(id);
    runtimeNote = ` Runtime loaded ${reloaded.toolsRegistered} tool(s), ${reloaded.skillsLoaded} skill(s).`;
  }

  const baseMessage = options.bypassEval
    ? 'Enabled (eval bypassed).'
    : 'Enabled.';
  const flagHint = extensionsRuntimeEnabled()
    ? ''
    : ' Set CARINA_EXTENSIONS_ENABLED=true and restart to load contributions.';

  return {
    id,
    status: 'enabled',
    message: `${baseMessage}${runtimeNote}${flagHint}`,
  };
}

export async function disableExtension(id: string): Promise<void> {
  const record = await getExtensionRecord(id);
  if (!record) throw new Error(`Extension not installed: ${id}`);

  const bundleDir = extensionDir(id);
  const manifest = await validateExtensionBundle(bundleDir, { allowHighRisk: true });

  const { extensionsRuntimeEnabled, unloadExtensionRuntimeContributions } = await import('./contributions.js');
  if (extensionsRuntimeEnabled()) {
    await unloadExtensionRuntimeContributions(id);
  } else {
    await clearStagedExtensionContributions(id);
    const { unregisterExtensionTools } = await import('./tools.js');
    unregisterExtensionTools(id);
  }

  await upsertExtensionRecord(manifest.manifest, {
    status: 'disabled',
    disabled_at: new Date().toISOString(),
    health: 'ok',
    health_message: 'Disabled',
  });
}

export async function removeExtension(id: string): Promise<void> {
  const record = await getExtensionRecord(id);
  if (!record) throw new Error(`Extension not installed: ${id}`);

  await clearStagedExtensionContributions(id);
  await fs.rm(extensionDir(id), { recursive: true, force: true });
  await removeExtensionRecord(id);
}

export async function rollbackExtension(
  id: string,
  snapshotId?: string,
): Promise<string> {
  const record = await getExtensionRecord(id);
  if (!record) throw new Error(`Extension not installed: ${id}`);

  const restored = await rollbackExtensionSnapshot(id, snapshotId);
  const bundleDir = extensionDir(id);
  const validation = await validateExtensionBundle(bundleDir, { allowHighRisk: true });

  await upsertExtensionRecord(validation.manifest, {
    status: record.status === 'enabled' ? 'disabled' : record.status,
    health: validation.ok ? 'warn' : 'fail',
    health_message: `Rolled back to snapshot ${restored}`,
  });

  return restored;
}

export async function validateInstalledExtension(id: string) {
  const bundleDir = extensionDir(id);
  return validateExtensionBundle(bundleDir, { allowHighRisk: true });
}

export async function extensionStatus(id: string) {
  const rows = await listExtensionHealth();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`Extension not installed: ${id}`);
  return row;
}

export async function ensureExtensionsLayout(): Promise<void> {
  await fs.mkdir(CARINA_EXTENSIONS_DIR, { recursive: true });
}

export async function listInstalledExtensionDirs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CARINA_EXTENSIONS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function reconcileExtensionStore(): Promise<number> {
  const dirs = await listInstalledExtensionDirs();
  const rows = await readExtensionStore();
  const known = new Set(rows.map((r) => r.id));
  let added = 0;

  for (const id of dirs) {
    if (known.has(id)) continue;
    const validation = await validateExtensionBundle(extensionDir(id), { allowHighRisk: true });
    await upsertExtensionRecord(validation.manifest, {
      status: 'installed',
      health: validation.ok ? 'warn' : 'fail',
      health_message: 'Found on disk; not registered in store',
    });
    added++;
  }

  return added;
}
