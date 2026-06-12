import chalk from 'chalk';
import {
  disableExtension,
  enableExtension,
  extensionStatus,
  installExtension,
  listExtensions,
  reconcileExtensionStore,
  removeExtension,
  rollbackExtension,
  validateInstalledExtension,
} from '../../extensions/manager.js';

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export async function runExtensionsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const id = args[1];
  const rest = args.slice(2);

  if (action === 'list') {
    const rows = await listExtensions();
    if (rows.length === 0) {
      const added = await reconcileExtensionStore();
      if (added > 0) {
        console.log(chalk.gray(`Reconciled ${added} extension(s) from disk.`));
        return runExtensionsCommand(['list']);
      }
      console.log('No extension bundles installed.');
      console.log(chalk.gray('Install: carina extensions install <path|git-url|archive>'));
      return;
    }
    console.log(chalk.bold('\nExtension bundles\n'));
    for (const row of rows) {
      const health = row.health === 'ok'
        ? chalk.green('ok')
        : row.health === 'warn'
          ? chalk.yellow('warn')
          : chalk.red('fail');
      console.log(
        `  ${row.id.padEnd(20)} ${row.version.padEnd(8)} ${row.status.padEnd(10)} ${health}  ${row.name}`,
      );
      if (row.health_message) {
        console.log(chalk.gray(`    ${row.health_message}`));
      }
    }
    console.log('');
    return;
  }

  if (action === 'install') {
    const source = id ?? rest[0];
    if (!source) {
      console.error('Usage: carina extensions install <local-path|git-url|archive.tgz>');
      process.exit(1);
    }
    const result = await installExtension(source, {
      allowDangerous: hasFlag(args, '--allow-dangerous'),
    });
    console.log(chalk.green(`Installed ${result.id}@${result.version}`));
    console.log(chalk.gray(`  path: ${result.path}`));
    console.log(chalk.gray('  Run: carina extensions enable ' + result.id));
    return;
  }

  if (action === 'enable') {
    if (!id) {
      console.error('Usage: carina extensions enable <id> [--allow-dangerous] [--bypass-eval]');
      process.exit(1);
    }
    const result = await enableExtension(id, {
      allowDangerous: hasFlag(args, '--allow-dangerous'),
      bypassEval: hasFlag(args, '--bypass-eval'),
    });
    console.log(chalk.green(result.message));
    return;
  }

  if (action === 'disable') {
    if (!id) {
      console.error('Usage: carina extensions disable <id>');
      process.exit(1);
    }
    await disableExtension(id);
    console.log(chalk.yellow(`Disabled extension: ${id}`));
    return;
  }

  if (action === 'remove') {
    if (!id) {
      console.error('Usage: carina extensions remove <id>');
      process.exit(1);
    }
    await removeExtension(id);
    console.log(chalk.yellow(`Removed extension: ${id}`));
    return;
  }

  if (action === 'rollback') {
    if (!id) {
      console.error('Usage: carina extensions rollback <id> [snapshot-id]');
      process.exit(1);
    }
    const snapshot = rest[0];
    const restored = await rollbackExtension(id, snapshot);
    console.log(chalk.green(`Rolled back ${id} to snapshot ${restored}`));
    console.log(chalk.gray('Re-enable after rollback: carina extensions enable ' + id));
    return;
  }

  if (action === 'validate') {
    if (!id) {
      console.error('Usage: carina extensions validate <id>');
      process.exit(1);
    }
    const result = await validateInstalledExtension(id);
    if (result.ok) {
      console.log(chalk.green(`Valid: ${result.manifest.id}@${result.manifest.version}`));
    } else {
      console.log(chalk.red('Validation failed:'));
      for (const err of result.errors) console.log(`  - ${err}`);
      process.exit(1);
    }
    for (const warn of result.warnings) {
      console.log(chalk.yellow(`  warn: ${warn}`));
    }
    return;
  }

  if (action === 'status') {
    if (!id) {
      console.error('Usage: carina extensions status <id>');
      process.exit(1);
    }
    const row = await extensionStatus(id);
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  console.error(
    'Usage: carina extensions <list|install|enable|disable|remove|rollback|validate|status> [args]',
  );
  process.exit(1);
}
