import chalk from 'chalk';
import { buildOperatorStatus } from '../../ops/operator-status.js';
import { buildControlStatus, formatControlStatus } from '../../ops/control-status.js';
import {
  buildExtensibilityStatus,
  formatExtensibilityStatus,
} from '../../ops/extensibility-status.js';
import { getHostServiceStatus } from '../../infrastructure/host-service.js';

export async function runStatusCommand(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const skipHealth = args.includes('--quick');
  const control = args.includes('--control');
  const extensibility = args.includes('--extensibility');

  if (extensibility) {
    const report = await buildExtensibilityStatus();
    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(chalk.bold('\nCarina extensibility status\n'));
    console.log(formatExtensibilityStatus(report));
    console.log('');
    return;
  }

  if (control) {
    const host = await getHostServiceStatus();
    const ctrl = await buildControlStatus({ hostRunning: host.running });
    if (json) {
      console.log(JSON.stringify(ctrl, null, 2));
      return;
    }
    console.log(chalk.bold('\nCarina control status\n'));
    console.log(formatControlStatus(ctrl));
    console.log('');
    return;
  }

  const report = await buildOperatorStatus({
    includeUpdate: !args.includes('--no-update'),
    skipHealth,
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    if (report.health.fail > 0) process.exit(1);
    return;
  }

  console.log(chalk.bold(`\nCarina status (${report.hostname})\n`));
  console.log(`  version:   ${report.version}`);
  console.log(`  home:      ${report.carinaHome}`);
  console.log(
    `  health:    ${chalk.green(report.health.ok)} ok, `
    + `${chalk.yellow(String(report.health.warn))} warn, `
    + `${report.health.fail ? chalk.red(String(report.health.fail)) : '0'} fail`,
  );
  console.log(
    `  gateway:   ${report.gateway.webRunning ? chalk.green('running') : chalk.gray('stopped')} `
    + `: ${report.gateway.port}`,
  );
  console.log(
    `  /api/health: ${report.healthEndpoint.ok ? chalk.green('ok') : chalk.gray('unreachable')} `
    + `${report.healthEndpoint.detail ? chalk.gray(`(${report.healthEndpoint.detail.slice(0, 60)})`) : ''}`,
  );
  console.log(`  sessions:  ${report.sessions.localCount} local file(s)`);
  console.log(
    `  backups:   ${report.backups.count}`
    + (report.backups.latest ? ` (latest: ${report.backups.latest})` : ''),
  );
  console.log(
    `  secrets:   ${report.secrets.ok} ok, ${report.secrets.warn} warn, ${report.secrets.fail} fail`,
  );
  if (report.update) {
    const up = report.update.updateAvailable
      ? chalk.yellow(`update available (${report.update.latest})`)
      : chalk.green('latest');
    console.log(`  package:   ${report.update.current} (${up})`);
  }
  if (report.operatorHints.length > 0) {
    console.log(chalk.cyan('\nNext steps:'));
    for (const h of report.operatorHints) console.log(`  ${h}`);
  }
  console.log('');
  if (report.health.fail > 0) process.exit(1);
}
