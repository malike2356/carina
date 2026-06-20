import fs from 'fs/promises';
import chalk from 'chalk';
import { envExists, loadCarinaEnv } from '../config/load-env.js';
import { resolveCarinaHome } from '../config/paths.js';
import { DEFAULT_CLI_CONFIG } from './config/defaults.js';
import { writeConfig } from './config/loader.js';
import { format } from './output/formatter.js';
import { assessFirstRunGaps } from './first-run-onboarding.js';
import { carinaEnvPath } from './provider-bootstrap.js';

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function printFirstRunGuide(): void {
  console.log('');
  console.log(chalk.bold.white('  CARINA'));
  console.log(chalk.gray('  Install once, run carina, answer two questions, start chatting.'));
  console.log('');
  console.log(chalk.white('  First run:'));
  console.log(chalk.gray('    1. npm install -g carina-agent'));
  console.log(chalk.gray('    2. carina'));
  console.log(chalk.gray('    3. Your name, what you are building, optional API key'));
  console.log('');
  console.log(chalk.cyan('  carina setup    re-run onboarding or add a provider key'));
  console.log(chalk.cyan('  carina onboard  guided setup + gateway + doctor'));
  console.log(chalk.cyan('  carina doctor   check install health'));
  console.log('');
}

const MINIMAL_ENV_LINES = [
  '# Carina first-run bootstrap (no API key yet)',
  'CARINA_LOCAL_MODE=true',
  'CARINA_MEMORY_BACKEND=builtin',
  'CARINA_SKIP_POSTGRES=true',
  'DEFAULT_PROVIDER=deepseek',
  'DEFAULT_MODEL=deepseek-chat',
] as const;

export async function writeMinimalBootstrap(): Promise<void> {
  const home = resolveCarinaHome();
  const envPath = carinaEnvPath(home);
  await fs.mkdir(home, { recursive: true });
  await writeConfig({ ...DEFAULT_CLI_CONFIG });
  await fs.writeFile(envPath, `${MINIMAL_ENV_LINES.join('\n')}\n`, { mode: 0o600 });
}

export async function needsFirstRunOnboarding(): Promise<boolean> {
  if (!envExists()) return true;
  const gaps = await assessFirstRunGaps();
  return gaps.needsBootstrap || gaps.needsProfile || gaps.needsProvider;
}

export async function ensureFirstRunReady(): Promise<void> {
  const needsOnboarding = await needsFirstRunOnboarding();
  if (!needsOnboarding) return;

  const skipInkOnboarding =
    process.env.CARINA_TUI_SIMPLE === 'true' ||
    process.env.CARINA_OPS_PTY === '1';

  if (isInteractiveTerminal() && !skipInkOnboarding) {
    const { runInkOnboarding } = await import('./ink-onboarding.js');
    await runInkOnboarding();
    loadCarinaEnv();
    return;
  }

  await writeMinimalBootstrap();
  console.log(format.muted(`Non-interactive first run: wrote ${carinaEnvPath()}`));
  console.log(format.muted('Add an API key to ~/.carina/.env, then run carina again.'));
  console.log(format.muted('Or run: carina setup'));
  loadCarinaEnv();
}
