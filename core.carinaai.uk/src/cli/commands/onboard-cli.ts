import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { printFirstRunGuide } from '../first-run.js';
import { runDoctor } from './doctor.js';

export async function runOnboardCommand(args: string[]): Promise<void> {
  const skipSetup = args.includes('--skip-setup');
  const skipDoctor = args.includes('--skip-doctor');

  printFirstRunGuide();

  if (!skipSetup) {
    const runSetup = await confirm({
      message: 'Run guided setup now?',
      default: true,
    });
    if (runSetup) {
      const { runCliSetup } = await import('./setup.js');
      await runCliSetup();
    }
  }

  if (!skipDoctor) {
    console.log(chalk.cyan('\nRunning health check...\n'));
    await runDoctor(args.includes('--json') ? ['--json'] : []);
  } else {
    console.log(chalk.gray('\nSkipped doctor. Run: carina doctor\n'));
  }
}
