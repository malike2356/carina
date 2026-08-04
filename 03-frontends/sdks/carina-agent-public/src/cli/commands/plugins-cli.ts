import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { loadPluginsFromDisk, listPlugins } from '../../plugins/registry.js';
import { CARINA_HOME } from '../../config/paths.js';

const PLUGINS_DIR = process.env.CARINA_PLUGINS_DIR ?? path.join(CARINA_HOME, 'plugins');

export async function runPluginsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  await loadPluginsFromDisk();

  if (action === 'list') {
    const plugins = listPlugins();
    console.log(chalk.bold(`\nPlugins (${plugins.length})\n`));
    for (const p of plugins) {
      const status = p.enabled ? chalk.green('on') : chalk.gray('off');
      console.log(`  ${status}  ${p.name.padEnd(20)} v${p.version}  ${p.description.slice(0, 40)}`);
    }
    console.log(`\nDir: ${PLUGINS_DIR}\n`);
    return;
  }

  if (action === 'enable' || action === 'disable') {
    const name = args[1];
    if (!name) {
      console.error(`Usage: carina plugins ${action} <name>`);
      process.exit(1);
    }
    const manifestPath = path.join(PLUGINS_DIR, name, 'plugin.json');
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    manifest.enabled = action === 'enable';
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Plugin ${name} ${action}d`);
    return;
  }

  console.error('Usage: carina plugins <list|enable|disable> [name]');
  process.exit(1);
}
