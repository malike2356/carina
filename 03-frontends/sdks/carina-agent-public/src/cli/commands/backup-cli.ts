import chalk from 'chalk';
import {
  createBackup,
  listBackups,
  restoreBackup,
  verifyBackup,
} from '../../ops/backup-restore.js';

export async function runBackupCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';

  if (action === 'list') {
    const labels = await listBackups();
    if (labels.length === 0) {
      console.log('No backups.');
      return;
    }
    for (const label of labels) {
      console.log(`  ${label}`);
    }
    return;
  }

  if (action === 'create') {
    const label = args[1];
    const result = await createBackup(label ? { label } : {});
    console.log(chalk.green(`Backup created: ${result.path}`));
    return;
  }

  if (action === 'restore') {
    const label = args[1];
    if (!label) {
      console.error('Usage: carina backup restore <label>');
      process.exit(1);
    }
    const result = await restoreBackup(label);
    console.log(chalk.green(`Restored backup: ${result.label} (${result.restored.length} items)`));
    return;
  }

  if (action === 'verify') {
    const label = args[1];
    if (!label) {
      console.error('Usage: carina backup verify <label>');
      process.exit(1);
    }
    const result = await verifyBackup(label);
    if (result.ok) {
      console.log(chalk.green(`Backup verified: ${label}`));
      return;
    }
    for (const err of result.errors) console.log(`  - ${err}`);
    process.exit(1);
  }

  console.error('Usage: carina backup <list|create|restore|verify> [label]');
  process.exit(1);
}
