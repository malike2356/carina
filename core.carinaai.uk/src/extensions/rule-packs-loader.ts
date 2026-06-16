import fs from 'fs/promises';
import path from 'path';
import { extensionDir } from '../config/paths.js';
import { extensionsRuntimeEnabled } from './contributions.js';
import { listEnabledExtensionIds } from './store.js';
import { parseDomainRulePackFile } from '../plugin-sdk/types.js';
import {
  clearExtensionRulePacks,
  registerExtensionRulePacks,
  unregisterExtensionRulePacks,
} from '../domain-rules/registry.js';

const RULE_FILE_CANDIDATES = ['rules/rules.json', 'rules.json'];

async function readRulePackFile(bundleDir: string, rel: string) {
  const full = path.join(bundleDir, rel);
  const raw = JSON.parse(await fs.readFile(full, 'utf-8')) as unknown;
  return parseDomainRulePackFile(raw, rel);
}

export async function loadExtensionRulePacksFromBundle(id: string): Promise<number> {
  const bundleDir = extensionDir(id);
  unregisterExtensionRulePacks(id);

  for (const rel of RULE_FILE_CANDIDATES) {
    try {
      const packs = await readRulePackFile(bundleDir, rel);
      registerExtensionRulePacks(packs, id);
      return packs.length;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extensions/rules] ${id}/${rel}: ${msg}`);
    }
  }

  return 0;
}

export async function loadEnabledExtensionRulePacks(): Promise<number> {
  if (!extensionsRuntimeEnabled()) {
    clearExtensionRulePacks();
    return 0;
  }

  clearExtensionRulePacks();
  const ids = await listEnabledExtensionIds();
  let total = 0;
  for (const id of ids) {
    total += await loadExtensionRulePacksFromBundle(id);
  }
  return total;
}

export async function reloadExtensionRulePacks(id: string): Promise<number> {
  if (!extensionsRuntimeEnabled()) return 0;
  return loadExtensionRulePacksFromBundle(id);
}

export async function unloadExtensionRulePacks(id: string): Promise<void> {
  unregisterExtensionRulePacks(id);
}
