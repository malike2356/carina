import chalk from 'chalk';
import {
  evaluateBuiltOnCarina,
  evaluatePoweredByCarina,
  type CertificationLevel,
} from '../../certification/built-on-carina.js';

export async function runCertifyCommand(args: string[]): Promise<void> {
  const level = (args[0] ?? 'built-on') as CertificationLevel | 'built-on' | 'powered-by';
  const json = args.includes('--json');
  const rest = args.filter((a) => a !== '--json');
  const projectPath = rest[1] && !rest[1].startsWith('--') ? rest[1] : process.cwd();

  let report;
  if (level === 'powered-by' || level === 'powered-by-carina') {
    report = evaluatePoweredByCarina(projectPath);
  } else {
    report = evaluateBuiltOnCarina(projectPath);
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exit(1);
    return;
  }

  console.log(chalk.bold(`\nCarina certification: ${report.level}\n`));
  console.log(`  Project: ${report.projectPath}`);
  console.log(`  Score:   ${report.score}%`);
  console.log(`  Result:  ${report.passed ? chalk.green('PASS') : chalk.red('FAIL')}\n`);

  for (const check of report.checks) {
    const icon = check.passed ? chalk.green('ok') : check.severity === 'required' ? chalk.red('FAIL') : chalk.yellow('WARN');
    console.log(`  ${icon}  ${check.label}`);
    console.log(chalk.gray(`       ${check.detail}`));
  }

  if (report.nextSteps.length > 0) {
    console.log(chalk.bold('\nNext steps\n'));
    for (const step of report.nextSteps) console.log(`  - ${step}`);
  }
  console.log('');

  if (!report.passed) process.exit(1);
}
