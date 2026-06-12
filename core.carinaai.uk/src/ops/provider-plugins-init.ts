import path from 'path';
import { fileURLToPath } from 'url';

export async function initProviderPluginsIfEnabled(): Promise<string[]> {
  if (process.env.CARINA_PROVIDER_PLUGINS !== 'true') return [];
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const { loadProviderPlugins } = await import('../plugins/loader.js');
  return loadProviderPlugins(root);
}
