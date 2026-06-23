import chalk from 'chalk';
import { getRouter } from '../../gateway/router.js';

export async function runQueueCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'status';
  const queue = getRouter().getCommandQueue();

  if (action === 'status') {
    const json = args.includes('--json');
    const status = queue.status();
    if (json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    console.log(chalk.bold('\nCommand queue status\n'));
    console.log(`Total entries: ${status.totalEntries}`);
    console.log(`Active lanes: ${status.activeLanes}`);
    console.log(`Idle lanes: ${status.idleLanes}`);
    for (const lane of status.laneStatuses.slice(0, 10)) {
      console.log(`  ${lane.sessionId.slice(0, 8)}  ${lane.state}  ${lane.entries} queued`);
    }
    return;
  }

  if (action === 'config') {
    const cfg = queue.getSessionConfig('default');
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  if (action === 'drain') {
    const sessionId = args[1];
    if (!sessionId) {
      console.error('Usage: carina queue drain <sessionId>');
      process.exit(1);
    }
    queue.drain(sessionId);
    console.log(chalk.green(`Drained queue for session ${sessionId}`));
    return;
  }

  console.error('Usage: carina queue <status|config|drain> [--json]');
  process.exit(1);
}
