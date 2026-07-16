import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UTILITY_PLUGIN_IDS } from '../plugins/utilities/utility-plugins.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export function builtinExtensionsRoot(): string {
  return path.join(PROJECT_ROOT, 'builtin-extensions');
}

export function resolveBuiltinExtensionPath(id: string): string | null {
  const dir = path.join(builtinExtensionsRoot(), id);
  if (fs.existsSync(path.join(dir, 'extension.json'))) return dir;
  return null;
}

export function listBuiltinExtensionIds(): string[] {
  const root = builtinExtensionsRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && UTILITY_PLUGIN_IDS.includes(e.name))
    .map((e) => e.name)
    .sort();
}

export function isBuiltinUtilityExtension(id: string): boolean {
  return UTILITY_PLUGIN_IDS.includes(id);
}
