import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { runSecurityAudit } from '../../ops/security-audit.js';

export async function runSecurityCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'audit';

  if (action === 'audit' || action === 'status') {
    const report = await runSecurityAudit();
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(chalk.bold('\nSecurity audit\n'));
    for (const c of report.checks) {
      const icon = c.severity === 'ok'
        ? chalk.green('ok')
        : c.severity === 'fail'
          ? chalk.red('FAIL')
          : chalk.yellow('warn');
      console.log(`  ${icon}  ${c.name}: ${c.detail}`);
    }
    console.log(
      chalk.gray(
        `\n${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail\n`,
      ),
    );
    if (report.summary.fail > 0) process.exit(1);
    return;
  }

  console.error('Usage: carina security <audit|status> [--json]');
  process.exit(1);
}
