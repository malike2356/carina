import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';
import { envExists } from '../config/load-env.js';
import { DEFAULT_CLI_CONFIG } from './config/defaults.js';
import { writeConfig } from './config/loader.js';
import { format } from './output/formatter.js';

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function printFirstRunGuide(): void {
  console.log('');
  console.log(chalk.bold.white('  CARINA'));
  console.log(chalk.gray('  Direct operator agent · local-first install'));
  console.log('');
  console.log(chalk.white('  Minimum to chat:'));
  console.log(chalk.gray('    1. Add an LLM API key: carina setup'));
  console.log(chalk.gray('    2. Or edit ~/.carina/.env (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, etc.)'));
  console.log('');
  console.log(chalk.white('  Optional:'));
  console.log(chalk.gray('    · Memory/RAG: DATABASE_URL (Postgres + pgvector)'));
  console.log(chalk.gray('    · Hosted app: use app.carinaai.uk (no local install)'));
  console.log(chalk.gray('    · Scout security: LABYRINTH_ENABLED=true (see docs)'));
  console.log('');
  console.log(chalk.cyan('  carina doctor   check install health'));
  console.log(chalk.cyan('  carina setup    guided API key setup'));
  console.log('');
}

const MINIMAL_ENV_LINES = [
  '# Carina first-run bootstrap (no API key yet)',
  'CARINA_LOCAL_MODE=true',
  'CARINA_MEMORY_BACKEND=builtin',
  'DEFAULT_PROVIDER=deepseek',
  'DEFAULT_MODEL=deepseek-chat',
  '# Add your key, then restart: DEEPSEEK_API_KEY=sk-...',
] as const;

export async function writeMinimalBootstrap(): Promise<void> {
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await writeConfig({ ...DEFAULT_CLI_CONFIG });
  await fs.writeFile(CARINA_ENV_PATH, `${MINIMAL_ENV_LINES.join('\n')}\n`, { mode: 0o600 });
}

export async function ensureFirstRunReady(): Promise<void> {
  if (envExists()) return;

  printFirstRunGuide();

  if (isInteractiveTerminal()) {
    const { runCliSetup } = await import('./commands/setup.js');
    await runCliSetup();
    return;
  }

  await writeMinimalBootstrap();
  console.log(format.muted(`Non-interactive first run: wrote ${CARINA_ENV_PATH}`));
  console.log(format.muted('Add an API key to ~/.carina/.env, then run carina again.'));
  console.log(format.muted('Or run: carina setup'));
}
