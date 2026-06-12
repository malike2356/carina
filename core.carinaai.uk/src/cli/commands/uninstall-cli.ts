import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { CARINA_HOME } from '../../config/paths.js';
import { appendResetAudit } from '../../ops/reset-state.js';

export async function runUninstallCommand(args: string[]): Promise<void> {
  const purge = args.includes('--purge-state');
  const force = args.includes('--force');

  console.log(chalk.bold('\nCarina uninstall\n'));
  console.log('This removes the global npm CLI package. Your data stays unless you purge state.\n');
  console.log('  npm uninstall -g carina-agent\n');

  if (purge) {
    console.log(chalk.yellow(`--purge-state will delete: ${CARINA_HOME}`));
    console.log(chalk.yellow('Backups under ~/.carina/backups are included in that tree.\n'));

    if (!force) {
      console.log(chalk.gray('Add --force to confirm purge after reviewing the path above.'));
      return;
    }

    const ok = await confirm({
      message: `Permanently delete ${CARINA_HOME}?`,
      default: false,
    });
    if (!ok) {
      console.log('Purge cancelled.');
      return;
    }

    await appendResetAudit(CARINA_HOME, {
      id: `uninstall-purge-${Date.now()}`,
      action: 'purge-state',
      home: CARINA_HOME,
    });
    await fs.rm(CARINA_HOME, { recursive: true, force: true });
    console.log(chalk.green('Removed CARINA_HOME.'));
    return;
  }

  console.log(chalk.gray('Keep data: omit --purge-state'));
  console.log(chalk.gray('Optional host service: carina host uninstall'));
  console.log(chalk.gray('Optional node daemon: carina node-host uninstall\n'));
}
