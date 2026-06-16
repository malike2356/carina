import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { isInteractiveTerminal, printFirstRunGuide } from '../first-run.js';
import { runDoctor } from './doctor.js';

export async function runOnboardCommand(args: string[]): Promise<void> {
  const skipSetup = args.includes('--skip-setup');
  const skipDoctor = args.includes('--skip-doctor');
  const json = args.includes('--json');

  printFirstRunGuide();

  if (!isInteractiveTerminal()) {
    if (!skipSetup) {
      const { runContainerBootstrap } = await import('../../setup/container-bootstrap.js');
      await runContainerBootstrap();
    }
    if (!skipDoctor) {
      await runDoctor(json ? ['--json'] : ['--quiet']);
    }
    return;
  }

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
