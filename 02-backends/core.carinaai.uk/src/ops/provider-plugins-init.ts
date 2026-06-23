import path from 'path';
import { fileURLToPath } from 'url';

export function providerPluginsEnabled(): boolean {
  return process.env.CARINA_PROVIDER_PLUGINS !== 'false';
}

export async function initProviderPluginsIfEnabled(): Promise<string[]> {
  if (!providerPluginsEnabled()) return [];
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const { loadProviderPlugins } = await import('../plugins/loader.js');
  return loadProviderPlugins(root);
}
