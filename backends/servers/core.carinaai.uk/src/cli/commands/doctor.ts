import os from 'os';
import chalk from 'chalk';
import { applyHealthRepairs, runHealthCheck } from '../../ops/health-check.js';

export async function runDoctor(args: string[] = []): Promise<void> {
  const json = args.includes('--json');
  const repair = args.includes('--repair');
  const quiet = args.includes('--quiet');
  const deep = args.includes('--deep');

  const report = await runHealthCheck({ deep });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!quiet) {
    console.log(chalk.bold(`\nCarina doctor (${os.hostname()})\n`));
    for (const c of report.checks) {
      const icon = c.status === 'ok'
        ? chalk.green('ok')
        : c.status === 'warn'
          ? chalk.yellow('WARN')
          : chalk.red('FAIL');
      console.log(`  ${icon}  [${c.category}] ${c.name}: ${c.detail}`);
      if (c.guidance && c.status !== 'ok') {
        console.log(chalk.gray(`       -> ${c.guidance}`));
      }
    }
    if (report.configDrift.length > 0) {
      console.log(chalk.yellow('\nConfig drift:'));
      for (const d of report.configDrift) console.log(`  - ${d}`);
    }
    console.log(
      chalk.gray(
        `\n${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail\n`,
      ),
    );
  } else if (report.summary.fail > 0) {
    console.log(`doctor: ${report.summary.fail} fail, ${report.summary.warn} warn`);
  }

  if (repair) {
    const result = await applyHealthRepairs(report);
    if (!json && !quiet) {
      if (result.applied.length > 0) {
        console.log(chalk.green('Repairs applied:'));
        for (const a of result.applied) console.log(`  - ${a}`);
      }
      if (result.skipped.length > 0) {
        console.log(chalk.gray(`Skipped: ${result.skipped.join(', ')}`));
      }
    } else if (quiet && result.applied.length > 0) {
      console.log(`doctor repair: ${result.applied.length} applied`);
    }
  }

  if (report.summary.fail > 0) process.exit(1);
}
