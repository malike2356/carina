import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { executeReset, listResetAudit, planReset, type ResetScope } from '../../ops/reset-state.js';

function parseScope(raw: string | undefined): ResetScope {
  if (raw === 'state' || raw === 'full') return raw;
  return 'soft';
}

export async function runResetCommand(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const scopeArg = args.find((a) => a.startsWith('--scope='))?.split('=')[1]
    ?? (args.includes('--scope') ? args[args.indexOf('--scope') + 1] : undefined);
  const scope = parseScope(scopeArg);

  if (args.includes('audit')) {
    const lines = await listResetAudit();
    if (json) {
      console.log(JSON.stringify(lines.map((l) => JSON.parse(l)), null, 2));
      return;
    }
    if (lines.length === 0) {
      console.log('No reset audit entries.');
      return;
    }
    for (const line of lines) console.log(line);
    return;
  }

  const plan = await planReset(scope);
  if (json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log(chalk.bold(`\nReset plan (${plan.scope})\n`));
  for (const w of plan.warnings) console.log(chalk.yellow(`  ${w}`));
  console.log(`\nWould remove (${plan.items.length}):`);
  for (const item of plan.items) console.log(`  ${item}`);

  if (dryRun) {
    const result = await executeReset(scope, { dryRun: true });
    console.log(chalk.cyan(`\nDry run: ${result.removed.length} path(s) would be removed.`));
    return;
  }

  if (!force) {
    console.log(chalk.gray('\nRe-run with --force to apply, or --dry-run to preview.'));
    return;
  }

  const ok = await confirm({
    message: `Apply ${scope} reset to ${plan.homeDir}?`,
    default: false,
  });
  if (!ok) {
    console.log('Reset cancelled.');
    return;
  }

  const result = await executeReset(scope, { force: true });
  console.log(chalk.green(`\nReset complete (${result.auditId}). Removed ${result.removed.length} path(s).`));
  console.log(chalk.gray('Audit: carina reset audit'));
}
