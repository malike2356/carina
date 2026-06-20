import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { extensionDir } from '../config/paths.js';
import { readExtensionManifest } from './validator.js';
import { extensionsRuntimeEnabled } from './contributions.js';

export type ExtensionHookHandler = (payload: unknown) => Promise<unknown> | unknown;

type HookRegistration = {
  extensionId: string;
  hook: string;
  handler: ExtensionHookHandler;
};

const hookRegistry: HookRegistration[] = [];

export function listRegisteredExtensionHooks(): Array<{ extensionId: string; hook: string }> {
  return hookRegistry.map((r) => ({ extensionId: r.extensionId, hook: r.hook }));
}

export async function loadExtensionHooks(id: string): Promise<number> {
  if (!extensionsRuntimeEnabled()) return 0;
  await unloadExtensionHooks(id);

  const bundleDir = extensionDir(id);
  const manifest = await readExtensionManifest(bundleDir);
  if (!manifest.capabilities.includes('hooks') || !manifest.entryPoints.hooks) return 0;

  const hooksPath = path.join(bundleDir, manifest.entryPoints.hooks);
  const raw = JSON.parse(await fs.readFile(hooksPath, 'utf-8')) as unknown;
  const hooks = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { hooks?: unknown }).hooks)
      ? (raw as { hooks: unknown[] }).hooks
      : [];

  let loaded = 0;
  for (const entry of hooks) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const hook = String(rec.hook ?? rec.name ?? '').trim();
    const moduleRel = String(rec.module ?? rec.file ?? '').trim();
    if (!hook || !moduleRel) continue;

    const modulePath = pathToFileURL(path.join(bundleDir, moduleRel)).href;
    try {
      const mod = await import(modulePath) as { default?: ExtensionHookHandler; handler?: ExtensionHookHandler };
      const handler = mod.default ?? mod.handler;
      if (typeof handler !== 'function') continue;
      hookRegistry.push({ extensionId: id, hook, handler });
      loaded++;
    } catch (err) {
      console.warn(`[extensions/hooks] ${id}/${hook}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return loaded;
}

export async function unloadExtensionHooks(id: string): Promise<void> {
  for (let i = hookRegistry.length - 1; i >= 0; i--) {
    if (hookRegistry[i]?.extensionId === id) hookRegistry.splice(i, 1);
  }
}

export async function runExtensionHooks(hook: string, payload: unknown): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const reg of hookRegistry) {
    if (reg.hook !== hook) continue;
    try {
      results.push(await reg.handler(payload));
    } catch (err) {
      results.push({ error: err instanceof Error ? err.message : String(err), extensionId: reg.extensionId });
    }
  }
  return results;
}

export async function loadEnabledExtensionHooks(): Promise<number> {
  if (!extensionsRuntimeEnabled()) return 0;
  const { listEnabledExtensionIds } = await import('./store.js');
  const ids = await listEnabledExtensionIds();
  let total = 0;
  for (const id of ids) {
    total += await loadExtensionHooks(id);
  }
  return total;
}

export function resetExtensionHooksForTests(): void {
  hookRegistry.length = 0;
}
