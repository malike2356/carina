import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { CARINA_HOME } from '../../config/paths.js';
import {
  bundleImportReport,
  exportCarinaBundle,
  formatMigrationReport,
  importCarinaBundle,
  runMigration,
  saveMigrationReport,
  scanMigrationSources,
  type MigrationSource,
} from '../../ops/migration/index.js';

const SOURCES: MigrationSource[] = ['claude', 'agent-type-1', 'agent-type-2'];

function parseCsvFlag(args: string[], name: string): string[] | undefined {
  const raw = parseFlag(args, name);
  if (!raw) return undefined;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseBoolFlag(args: string[], name: string): boolean | undefined {
  const raw = parseFlag(args, name);
  if (raw === undefined) return undefined;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}

function parseFlag(args: string[], name: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(name);
  if (idx >= 0) return args[idx + 1];
  return undefined;
}

function positionalArgs(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      if (a === '--from') i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

export async function runMigrateCommand(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const skipBackup = args.includes('--no-backup');
  const from = parseFlag(args, '--from');
  const action = positionalArgs(args)[0] ?? 'status';

  if (action === 'status') {
    const scans = (await scanMigrationSources()).filter((scan) => SOURCES.includes(scan.source) || scan.source === 'carina-bundle');
    if (json) {
      console.log(JSON.stringify(scans, null, 2));
      return;
    }
    console.log(chalk.bold('\nMigration sources\n'));
    for (const scan of scans) {
      const tag = scan.found ? chalk.green('found') : chalk.gray('not found');
      const hints = scan.hints.length > 0 ? ` (${scan.hints.join(', ')})` : '';
      console.log(`  ${scan.source.padEnd(14)} ${tag}  ${scan.dir}${hints}`);
    }
    console.log('\nRun: carina migrate <claude|agent-type-1|agent-type-2> [--dry-run] [--force]\n');
    return;
  }

  if (action === 'export') {
    const label = positionalArgs(args)[1];
    const filters = {
      items: parseCsvFlag(args, '--items'),
      profiles: parseCsvFlag(args, '--profiles'),
      includeSessions: parseBoolFlag(args, '--sessions'),
      includeMemory: parseBoolFlag(args, '--memory'),
      includeWorkspaces: parseBoolFlag(args, '--workspaces'),
    };
    const hasFilters = Object.values(filters).some((v) => v !== undefined);
    const result = await exportCarinaBundle({
      label,
      dryRun,
      filters: hasFilters ? filters : undefined,
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (dryRun) {
      console.log(chalk.cyan(`Would export ${result.manifest.items.length} item(s) to ${result.path}`));
      return;
    }
    console.log(chalk.green(`Export bundle: ${result.path}`));
    console.log(chalk.gray(`  ${result.manifest.items.length} items in interop-manifest.json`));
    return;
  }

  if (action === 'import') {
    const bundlePath = from ?? positionalArgs(args)[1];
    if (!bundlePath) {
      console.error('Usage: carina migrate import <bundle-path> [--force] [--dry-run]');
      process.exit(1);
    }
    if (!dryRun && !force) {
      console.error('Import requires --force (preview with --dry-run first)');
      process.exit(1);
    }
    if (!dryRun && force) {
      const ok = await confirm({
        message: `Import Carina bundle into ${CARINA_HOME}?`,
        default: false,
      });
      if (!ok) {
        console.log('Import cancelled.');
        return;
      }
    }
    const result = await importCarinaBundle(bundlePath, { force, dryRun });
    const report = bundleImportReport(bundlePath, CARINA_HOME, result, dryRun);
    if (!dryRun) report.reportFile = await saveMigrationReport(report);
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log(formatMigrationReport(report));
    return;
  }

  if (!SOURCES.includes(action as MigrationSource)) {
    console.error('Usage: carina migrate <status|claude|agent-type-1|agent-type-2|export|import> [--from PATH] [--dry-run] [--force] [--no-backup]');
    console.error('  export filters: --items=a,b --profiles=name --sessions=true --memory=true --workspaces=true');
    process.exit(1);
  }

  if (!dryRun && !force) {
    console.log(chalk.yellow('Preview mode: showing plan only. Re-run with --force to apply (creates backup first).'));
    console.log(chalk.gray('  Or use --dry-run explicitly.\n'));
  }

  if (!dryRun && force) {
    const ok = await confirm({
      message: `Migrate ${action} into ${CARINA_HOME}? A backup will be created unless --no-backup is set.`,
      default: false,
    });
    if (!ok) {
      console.log('Migration cancelled.');
      return;
    }
  }

  const report = await runMigration(action as MigrationSource, {
    sourceDir: from,
    dryRun: dryRun || !force,
    force,
    skipBackup,
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatMigrationReport(report));
  }

  const failed = report.items.filter((i) => i.status === 'failed').length;
  if (failed > 0) process.exit(1);

  if (!report.dryRun) {
    console.log('\nNext: carina doctor --repair && carina secrets audit');
  } else {
    console.log(chalk.cyan('\nDry run complete. Re-run with --force to apply.'));
  }
}
