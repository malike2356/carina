import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';

export async function runScoutCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';
  const scoutUrl = process.env.SCOUT_BASE_URL ?? process.env.LABYRINTH_SCOUT_URL ?? 'http://localhost:4444';
  const enabled = process.env.LABYRINTH_ENABLED === 'true' || process.env.SCOUT_ENABLED === 'true';

  if (action === 'status') {
    console.log(chalk.bold('\nLabyrinth Scout\n'));
    console.log(`  enabled:  ${enabled ? chalk.green('yes') : chalk.gray('no')}`);
    console.log(`  url:      ${scoutUrl}`);
    console.log(`  api key:  ${process.env.LABYRINTH_API_KEY ? 'set' : 'not set'}`);
    let healthy = false;
    try {
      const res = await fetch(`${scoutUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      healthy = res.ok;
    } catch {
      healthy = false;
    }
    console.log(`  health:   ${healthy ? chalk.green('ok') : chalk.yellow('unreachable')}`);
    console.log('');
    return;
  }

  if (action === 'test') {
    if (!process.env.LABYRINTH_API_KEY) {
      console.error('LABYRINTH_API_KEY not set');
      process.exit(1);
    }
    const { reportEvent } = await import('../../security/scout-client.js');
    await reportEvent({
      severity: 'info',
      source: 'carina-cli',
      event_type: 'cli_test',
      description: 'carina scout test',
    });
    console.log(chalk.green('Test event sent to Scout'));
    return;
  }

  if (action === 'pair') {
    console.log('Scout pairing: run carina setup or use the ops panel / Carina Cloud security tab.');
    console.log(`Set LABYRINTH_ENABLED=true and LABYRINTH_API_KEY in ${process.env.CARINA_HOME ?? '~/.carina'}/.env`);
    return;
  }

  console.error('Usage: carina scout <status|test|pair>');
  process.exit(1);
}
