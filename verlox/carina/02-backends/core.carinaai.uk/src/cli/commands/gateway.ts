import chalk from 'chalk';
import { channelRegistry } from '../../gateway/channels/channel-registry.js';
import { runChannelsCommand } from './channels.js';

export async function runGatewayCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'status';

  if (action === 'setup') {
    await runChannelsCommand('setup', args[1] ?? '');
    return;
  }

  if (action === 'channels') {
    await runChannelsCommand(args[1] ?? 'list', ...args.slice(2));
    return;
  }

  if (action === 'status') {
    const active = channelRegistry.listActive();
    const webPort = process.env.WEB_PORT ?? '3000';
    let webOk = false;
    try {
      const res = await fetch(`http://127.0.0.1:${webPort}/api/health`, { signal: AbortSignal.timeout(2000) });
      webOk = res.ok;
    } catch {
      webOk = false;
    }
    console.log(chalk.bold('\nGateway status\n'));
    console.log(`  web:       ${webOk ? chalk.green('running') : chalk.gray('stopped')}  :${webPort}`);
    console.log(`  channels:  ${active.length} active (${active.join(', ') || 'none'})`);
    console.log('\nStart: carina gateway start  or  carina web\n');
    return;
  }

  if (action === 'start') {
    const { runWeb } = await import('./agent.js');
    await runWeb();
    return;
  }

  if (action === 'stop') {
    console.log('Stop the gateway process (Ctrl+C) or systemd unit on the host.');
    return;
  }

  console.error('Usage: carina gateway <status|start|stop|setup|channels> [args]');
  process.exit(1);
}
