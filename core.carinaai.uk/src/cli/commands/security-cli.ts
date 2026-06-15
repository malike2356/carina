import chalk from 'chalk';
import fs from 'fs/promises';
import { loadLocalEnv } from '../config/env.js';
import { runSecurityAudit } from '../../ops/security-audit.js';
import { buildSecurityTrustState, formatTrustStateSummary } from '../../security/trust-state.js';
import {
  buildTrustComplianceReport,
  formatTrustComplianceMarkdown,
} from '../../security/trust-compliance-report.js';
import { searchSecurityAudit } from '../../security/security-audit.js';

export async function runSecurityCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'audit';

  if (action === 'trust') {
    const state = await buildSecurityTrustState();
    if (args.includes('--json')) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    console.log(chalk.bold('\nSecurity trust state\n'));
    console.log(formatTrustStateSummary(state));
    if (state.recentSecurityAudit.length > 0) {
      console.log(chalk.gray('\nRecent security audit events:'));
      for (const row of state.recentSecurityAudit.slice(-5)) {
        console.log(`  ${row.at} [${row.category}] ${row.action}: ${row.detail}`);
      }
    }
    console.log('');
    return;
  }

  if (action === 'events') {
    const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
    const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '30');
    const rows = searchSecurityAudit({
      category: categoryArg as 'prompt_injection' | undefined,
      limit,
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nSecurity audit events (${rows.length})\n`));
    for (const row of rows) {
      const ref = row.metadata?.shield_ref ? ` ref=${String(row.metadata.shield_ref)}` : '';
      console.log(`  ${row.at} [${row.category}] ${row.action}${ref}: ${row.detail}`);
    }
    console.log('');
    return;
  }

  if (action === 'report') {
    const report = await buildTrustComplianceReport();
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const markdown = formatTrustComplianceMarkdown(report);
    const outputArg = args.find((a) => a.startsWith('--output='))?.split('=')[1];
    if (outputArg) {
      await fs.writeFile(outputArg, markdown, 'utf8');
      console.log(chalk.green(`Compliance report written to ${outputArg}`));
      return;
    }
    console.log(markdown);
    return;
  }

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

  console.error('Usage: carina security <audit|status|trust|events|report> [--json] [--category=prompt_injection] [--limit=N] [--output=path.md]');
  process.exit(1);
}
