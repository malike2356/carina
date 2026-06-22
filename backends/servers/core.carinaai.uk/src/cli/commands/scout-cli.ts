import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import {
  formatScoutCliError,
  runScoutConnectCommand,
  runScoutDeepScanCommand,
  runScoutInvestigateCommand,
  runScoutPullCommand,
  runScoutReportCommand,
  runScoutWatchCommand,
  ScoutCliConfigError,
} from './scout-findings-cli.js';

import {
  formatScoutProductCliError,
  runScoutAgentsCommand,
  runScoutAlertsCommand,
  runScoutComplianceCommand,
  runScoutFindingDetailCommand,
  runScoutScoreCommand,
  runScoutTargetsCommand,
} from './scout-product-cli.js';

export async function runScoutCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';
  const scoutUrl = process.env.SCOUT_API_URL ?? process.env.SCOUT_BASE_URL ?? process.env.LABYRINTH_URL ?? process.env.LABYRINTH_SCOUT_URL ?? 'http://localhost:4444';
  const enabled = process.env.LABYRINTH_ENABLED === 'true' || process.env.SCOUT_ENABLED === 'true';

  if (action === 'score') {
    try {
      await runScoutScoreCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutProductCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'targets') {
    try {
      await runScoutTargetsCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutProductCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'findings' && args[1] && !args[1].startsWith('--')) {
    try {
      await runScoutFindingDetailCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutProductCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'agents') {
    try {
      await runScoutAgentsCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutProductCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'alerts') {
    try {
      await runScoutAlertsCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutProductCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'compliance') {
    try {
      await runScoutComplianceCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutProductCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'pull') {
    try {
      await runScoutPullCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'investigate') {
    try {
      await runScoutInvestigateCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'connect') {
    try {
      await runScoutConnectCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'watch') {
    try {
      await runScoutWatchCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'deep-scan') {
    try {
      await runScoutDeepScanCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutCliError(err)));
      process.exit(1);
    }
    return;
  }

  if (action === 'report') {
    try {
      await runScoutReportCommand(args.slice(1));
    } catch (err) {
      console.error(chalk.red(formatScoutCliError(err)));
      process.exit(1);
    }
    return;
  }

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

  if (action === 'enable') {
    console.log(chalk.bold('\nEnable Labyrinth Scout\n'));
    console.log('Scout is a separate commercial security product. It is not bundled with MIT Carina core.');
    console.log('');
    console.log('1. Deploy or subscribe to a Scout server: https://labyrinthscout.com');
    console.log('2. Install the client SDK:  npm install @verlox/carina-scout');
    console.log('3. Configure Carina:');
    console.log('     LABYRINTH_ENABLED=true');
    console.log('     LABYRINTH_URL=<your-scout-server-url>');
    console.log('     LABYRINTH_API_KEY=<your-api-key>');
    console.log('');
    console.log('See docs/kernel/COMMERCIAL_BOUNDARIES.md for product boundaries.');
    return;
  }

  if (action === 'pair') {
    console.log('Scout pairing: run carina scout connect --api-key <key> [--url URL]');
    console.log('Or use carina setup / the ops panel / Carina Cloud security tab.');
    console.log(`Env file: ${process.env.CARINA_HOME ?? '~/.carina'}/.env`);
    return;
  }

  console.error('Usage: carina scout <status|connect|pull|investigate|watch|deep-scan|report|score|targets|findings|agents|alerts|compliance|enable|test|pair>');
  process.exit(1);
}

export { ScoutCliConfigError };
