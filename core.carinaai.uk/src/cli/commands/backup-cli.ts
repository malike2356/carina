import chalk from 'chalk';
import {
  createBackup,
  exportBackupArchive,
  listBackups,
  planRestore,
  restoreBackupWithOptions,
  verifyBackup,
} from '../../ops/backup-restore.js';

export async function runBackupCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const json = args.includes('--json');

  if (action === 'list') {
    const labels = await listBackups();
    if (json) {
      console.log(JSON.stringify({ backups: labels }, null, 2));
      return;
    }
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
    const label = args.find((a) => !a.startsWith('--') && a !== 'create');
    const result = await createBackup(label ? { label } : {});
    if (json) {
      console.log(JSON.stringify({
        label: result.label,
        path: result.path,
        manifest: result.manifest,
      }, null, 2));
      return;
    }
    console.log(chalk.green(`Backup created: ${result.path}`));
    console.log(chalk.gray(`  ${result.manifest.files.length} files in manifest`));
    return;
  }

  if (action === 'archive') {
    const label = args[1];
    if (!label) {
      console.error('Usage: carina backup archive <label>');
      process.exit(1);
    }
    const { archivePath } = await exportBackupArchive(label);
    console.log(chalk.green(`Archive: ${archivePath}`));
    return;
  }

  if (action === 'plan') {
    const label = args[1];
    if (!label) {
      console.error('Usage: carina backup plan <label>');
      process.exit(1);
    }
    const plan = await planRestore(label);
    console.log(`Restore plan: ${plan.label}`);
    console.log(`  items: ${plan.items.join(', ') || '(none)'}`);
    console.log(`  will overwrite: ${plan.willOverwrite.join(', ') || '(none)'}`);
    for (const w of plan.warnings) console.log(chalk.yellow(`  warning: ${w}`));
    return;
  }

  if (action === 'restore') {
    const label = args[1];
    if (!label) {
      console.error('Usage: carina backup restore <label> [--force] [--dry-run]');
      process.exit(1);
    }
    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');
    try {
      const result = await restoreBackupWithOptions(label, { force, dryRun });
      if (dryRun) {
        console.log(chalk.cyan('Dry run; no files changed.'));
        for (const w of result.plan.warnings) console.log(chalk.yellow(`  ${w}`));
        console.log(`Would restore: ${result.plan.items.join(', ')}`);
        return;
      }
      console.log(chalk.green(`Restored backup: ${result.label} (${result.restored.length} items)`));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  if (action === 'verify') {
    const label = args.find((a) => !a.startsWith('--') && a !== 'verify');
    if (!label) {
      console.error('Usage: carina backup verify <label>');
      process.exit(1);
    }
    const result = await verifyBackup(label);
    if (json) {
      console.log(JSON.stringify({ label, ...result }, null, 2));
      if (!result.ok) process.exit(1);
      return;
    }
    if (result.ok) {
      console.log(chalk.green(`Backup verified: ${label}`));
      return;
    }
    for (const err of result.errors) console.log(`  - ${err}`);
    process.exit(1);
  }

  console.error('Usage: carina backup <list|create|archive|plan|restore|verify> [label] [--force] [--dry-run]');
  process.exit(1);
}
