import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { loadPluginsFromDisk, listPlugins } from '../../plugins/registry.js';
import { CARINA_HOME } from '../../config/paths.js';

export async function runHooksCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  await loadPluginsFromDisk();

  if (action === 'list') {
    const hooks = new Set<string>();
    for (const plugin of listPlugins()) {
      for (const hook of plugin.hooks ?? []) hooks.add(hook);
    }
    const builtinDir = path.join(CARINA_HOME, 'hooks');
    try {
      const files = await fs.readdir(builtinDir);
      for (const f of files.filter((x) => x.endsWith('.js') || x.endsWith('.ts'))) {
        hooks.add(f.replace(/\.(js|ts)$/, ''));
      }
    } catch {
      // optional
    }
    console.log(chalk.bold('\nHooks\n'));
    for (const hook of [...hooks].sort()) {
      console.log(`  ${hook}`);
    }
    console.log('');
    return;
  }

  console.error('Usage: carina hooks list');
  process.exit(1);
}
