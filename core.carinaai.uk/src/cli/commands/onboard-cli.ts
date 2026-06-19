import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { isInteractiveTerminal, printFirstRunGuide } from '../first-run.js';
import { runDoctor } from './doctor.js';

async function installAndStartDaemon(): Promise<void> {
  const { installHostService, startHostService, defaultGatewayCommand } = await import('../../host/daemon.js');
  await installHostService(defaultGatewayCommand());
  const started = await startHostService(defaultGatewayCommand());
  console.log(chalk.green(`\nGateway daemon started (PID ${started.pid})`));
  console.log(chalk.gray(`URL: ${started.url}`));
}

async function runOnboardGatewayStep(installDaemonFlag: boolean): Promise<void> {
  const { assessFirstRunGaps } = await import('../first-run-onboarding.js');
  const gaps = await assessFirstRunGaps();

  if (gaps.needsBootstrap || gaps.needsProfile || gaps.needsProvider) {
    if (installDaemonFlag) await installAndStartDaemon();
    return;
  }

  if (installDaemonFlag) {
    await installAndStartDaemon();
  }

  const { runGatewayOnboardingStep, printGatewayNextSteps } = await import('../onboarding-gateway.js');

  if (installDaemonFlag) {
    await runGatewayOnboardingStep();
    return;
  }

  const runGateway = await confirm({
    message: 'Configure gateway daemon and first channel?',
    default: true,
  });

  if (runGateway) {
    await runGatewayOnboardingStep();
    return;
  }

  printGatewayNextSteps();
}

export async function runOnboardCommand(args: string[]): Promise<void> {
  const skipSetup = args.includes('--skip-setup');
  const skipDoctor = args.includes('--skip-doctor');
  const skipGateway = args.includes('--skip-gateway');
  const installDaemon = args.includes('--install-daemon');
  const json = args.includes('--json');

  printFirstRunGuide();

  if (!isInteractiveTerminal()) {
    if (!skipSetup) {
      const { runContainerBootstrap } = await import('../../setup/container-bootstrap.js');
      await runContainerBootstrap();
    }
    if (installDaemon) await installAndStartDaemon();
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

  if (!skipGateway) {
    await runOnboardGatewayStep(installDaemon);
  } else if (installDaemon) {
    await installAndStartDaemon();
  }

  if (!skipDoctor) {
    console.log(chalk.cyan('\nRunning health check...\n'));
    await runDoctor(args.includes('--json') ? ['--json'] : []);
  } else {
    console.log(chalk.gray('\nSkipped doctor. Run: carina doctor\n'));
  }
}
