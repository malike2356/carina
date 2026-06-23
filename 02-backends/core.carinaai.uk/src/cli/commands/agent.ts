import { ensureFirstRunReady } from '../first-run.js';

export async function runAgent(cliOnly: boolean): Promise<void> {
  await ensureFirstRunReady();
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
