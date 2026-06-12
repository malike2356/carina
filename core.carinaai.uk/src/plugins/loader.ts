import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import type { ProviderPlugin } from './types.js';
import { normalisePlugin } from './types.js';
import { registerPluginProviders, type ProviderDefinition } from '../brain/provider-registry.js';
import type { LLMProvider } from '../types/index.js';

const PLUGIN_PROVIDERS_DIR = 'plugins/providers';

/* loader.ts is at src/plugins/loader.ts; project root is two levels up */
const DEFAULT_PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');

const providerFactories = new Map<string, (def: ProviderDefinition) => LLMProvider | null>();
const loadedPluginFiles: string[] = [];
let _pluginsLoaded = false;

export function listProviderPluginFiles(projectRoot: string = DEFAULT_PROJECT_ROOT): string[] {
  const dir = path.join(projectRoot, PLUGIN_PROVIDERS_DIR);
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js')))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export function getLoadedProviderPluginFiles(): string[] {
  return [...loadedPluginFiles];
}

export function getProviderFactory(name: string): ((def: ProviderDefinition) => LLMProvider | null) | undefined {
  return providerFactories.get(name);
}

/**
 * Discover and load all provider plugin modules from the project root.
 * Each plugin file must export a default that satisfies ProviderPlugin.
 *
 * Plugins can be .ts (source, preferred) or .js (compiled).
 * They live in the project-root plugins/providers/ directory.
 */
export async function loadProviderPlugins(projectRoot: string = DEFAULT_PROJECT_ROOT): Promise<string[]> {
  if (_pluginsLoaded) return [];
  _pluginsLoaded = true;
  const dir = path.join(projectRoot, PLUGIN_PROVIDERS_DIR);
  const loaded: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Directory doesn't exist yet — not an error, just no plugins
    return loaded;
  }

  const files = entries
    .filter((e) => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js')))
    .sort();

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    try {
      // Dynamic import with cache bust for dev reloads
      const mod = await import(`${fileURLToPath(new URL(String(fullPath)))}?t=${Date.now()}`);
      const plugin: ProviderPlugin | null = normalisePlugin(mod.default ?? mod);

      if (!plugin) {
        console.warn(chalk.yellow(`[plugins] ${file.name}: does not export a valid ProviderPlugin (missing providerDefinitions)`));
        continue;
      }

      // Register definitions into the global catalog
      const names = registerPluginProviders(plugin.providerDefinitions);

      // Register factory if provided
      if (plugin.providerFactory) {
        for (const def of plugin.providerDefinitions) {
          providerFactories.set(def.name, plugin.providerFactory);
        }
      }

      loaded.push(...names);
      loadedPluginFiles.push(file.name);
      console.log(chalk.gray(`[plugins] ${file.name}: registered ${names.join(', ')}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`[plugins] ${file.name}: failed to load (${msg})`));
    }
  }

  return loaded;
}

/**
 * Check if a provider has a plugin-registered factory.
 */
export function hasProviderFactory(name: string): boolean {
  return providerFactories.has(name);
}
