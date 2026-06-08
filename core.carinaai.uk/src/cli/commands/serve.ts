import { initRouter } from '../../gateway/router.js';
import { initSandbox } from '../../tools/sandbox.js';

export async function runServe(): Promise<void> {
  process.env.WEB_ENABLED = 'true';
  process.env.WEB_PORT = process.env.WEB_PORT ?? '3000';
  process.env.PORT = process.env.PORT ?? process.env.WEB_PORT;
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.SKIP_CLI = 'true';

  await initSandbox();
  initRouter(false);

  const { startWeb } = await import('../../gateway/web.js');
  await startWeb({ localMode: true, host: 'localhost', port: 3000 });
  await new Promise<never>(() => {
    setInterval(() => undefined, 2 ** 30);
  });
}
