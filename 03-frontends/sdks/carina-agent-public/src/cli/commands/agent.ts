import { envExists } from '../../config/load-env.js';
import { runCliSetup } from './setup.js';

export async function runAgent(cliOnly: boolean): Promise<void> {
  if (!envExists()) {
    await runCliSetup();
  }
  if (cliOnly) {
    process.env.WEB_ENABLED = 'false';
    process.env.TELEGRAM_BOT_TOKEN = '';
  }
  await import('../../index.js');
}

export async function runChat(): Promise<void> {
  await runAgent(true);
}

export async function runWeb(): Promise<void> {
  process.env.WEB_ENABLED = 'true';
  process.env.SKIP_CLI = 'true';
  await runAgent(false);
}
