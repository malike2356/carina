import chalk from 'chalk';
import type { ScheduledTask } from '../../agents/scheduled-tasks.js';
import { runRemPromotionCycle, isRemAvailable } from './rem-promotion.js';

export function remNightlyEnabled(): boolean {
  if (process.env.CARINA_REM_ENABLED === 'false') return false;
  if (process.env.CARINA_REM_NIGHTLY === 'false') return false;
  return isRemAvailable();
}

export function createRemNightlyTask(): ScheduledTask {
  return {
    name: 'rem-nightly-dreams',
    hour: Number(process.env.CARINA_REM_NIGHTLY_HOUR ?? '3'),
    minute: Number(process.env.CARINA_REM_NIGHTLY_MINUTE ?? '0'),
    timezone: process.env.TZ,
    run: async () => {
      if (!remNightlyEnabled()) return;
      const result = await runRemPromotionCycle();
      console.log(chalk.gray(
        `[rem-dreams] scanned=${result.scanned} enqueued=${result.enqueued} auto=${result.autoPromoted}`,
      ));
    },
  };
}
