import { initRouter } from '../../gateway/router.js';
import { initSandbox } from '../../tools/sandbox.js';
import { startWebGateway, webInstallHint } from '../../gateway/load-web-package.js';

export async function runServe(args: string[] = []): Promise<void> {
  if (args[0]?.toLowerCase() === 'mcp') {
    const { runMcpCommand } = await import('./mcp-server-cli.js');
    await runMcpCommand(['server', ...args.slice(1)]);
    return;
  }
  process.env.WEB_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.SKIP_CLI = 'true';

  await initSandbox();
  initRouter(false);

  const { startAcpServer } = await import('../../acp/acp-server.js');
  startAcpServer();

  const started = await startWebGateway({
    localMode: true,
    host: '127.0.0.1',
  });
  if (!started) {
    console.error(webInstallHint());
    process.exit(1);
  }
  await new Promise<never>(() => {
    setInterval(() => undefined, 2 ** 30);
  });
}
