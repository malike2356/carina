import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface CarinaPlugin {
  name: string;
  version: string;
  description: string;
  path: string;
  enabled: boolean;
  hooks?: string[];
}

const plugins = new Map<string, CarinaPlugin>();

export function registerPlugin(plugin: CarinaPlugin): void {
  plugins.set(plugin.name, plugin);
}

export function listPlugins(): CarinaPlugin[] {
  return [...plugins.values()];
}

export function getPlugin(name: string): CarinaPlugin | undefined {
  return plugins.get(name);
}

export async function loadPluginsFromDisk(): Promise<number> {
  const dir = process.env.CARINA_PLUGINS_DIR ?? path.join(os.homedir(), '.carina', 'plugins');
  let loaded = 0;

  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const manifestPath = path.join(dir, entry, 'plugin.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw) as {
          name: string;
          version?: string;
          description?: string;
          hooks?: string[];
          enabled?: boolean;
        };
        registerPlugin({
          name: manifest.name,
          version: manifest.version ?? '0.0.0',
          description: manifest.description ?? '',
          path: path.join(dir, entry),
          enabled: manifest.enabled !== false,
          hooks: manifest.hooks,
        });
        loaded++;
      } catch {
        // skip invalid plugin dirs
      }
    }
  } catch {
    // plugins dir optional
  }

  return loaded;
}

export async function runPluginHook(hook: string, payload: unknown): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const plugin of plugins.values()) {
    if (!plugin.enabled || !plugin.hooks?.includes(hook)) continue;
    const hookPath = path.join(plugin.path, 'hooks', `${hook}.js`);
    try {
      const mod = await import(hookPath);
      if (typeof mod.default === 'function') {
        results.push(await mod.default(payload));
      }
    } catch {
      // hook optional
    }
  }
  return results;
}
